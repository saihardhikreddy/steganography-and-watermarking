// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// A canvas that behaves like a browser's: pixels are stored premultiplied by alpha,
// so putImageData rounds the colour of any pixel that isn't fully opaque.
function fakeCanvas(store) {
  return {
    width: 0, height: 0,
    getContext: () => ({
      drawImage: (img) => { store.pixels = Uint8ClampedArray.from(img.pixels); },
      getImageData: () => ({ data: Uint8ClampedArray.from(store.pixels) }),
      putImageData: (imageData) => {
        const d = Uint8ClampedArray.from(imageData.data);
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3];
          for (let c = 0; c < 3; c++) {
            d[i + c] = a === 0 ? 0 : Math.round(Math.round(d[i + c] * a / 255) * 255 / a);
          }
        }
        store.pixels = d;
      },
    }),
  };
}

function load() {
  const store = {};
  const ctx = { TextEncoder, TextDecoder, document: { createElement: () => fakeCanvas(store) } };
  const src = readFileSync(new URL('../src/js/stego.js', import.meta.url), 'utf8');
  vm.runInNewContext(`${src}\nthis.Stego = Stego;`, ctx);
  return { Stego: ctx.Stego, store, canvas: fakeCanvas(store) };
}

function image(w, h, alpha) {
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = (i * 7) % 256; pixels[i + 1] = (i * 13) % 256; pixels[i + 2] = (i * 29) % 256; pixels[i + 3] = alpha;
  }
  return { width: w, height: h, pixels };
}

test('a message round-trips through an opaque image', () => {
  const { Stego, store, canvas } = load();
  assert.equal(Stego.embedData(canvas, image(32, 32, 255), 'hello, नमस्ते').ok, true);
  assert.equal(Stego.extractData({ width: 32, height: 32, pixels: store.pixels }), 'hello, नमस्ते');
});

test('a message survives a semi-transparent image', () => {
  const { Stego, store, canvas } = load();
  assert.equal(Stego.embedData(canvas, image(32, 32, 100), 'secret').ok, true);
  assert.equal(Stego.extractData({ width: 32, height: 32, pixels: store.pixels }), 'secret');
});

test('too long a message is refused', () => {
  const { Stego, canvas } = load();
  const r = Stego.embedData(canvas, image(4, 4, 255), 'x'.repeat(10));
  assert.equal(r.ok, false);
});

test('the bit layout stays readable by older versions', () => {
  // MSB first through the LSBs of R, G, B (alpha skipped): "STG1", a 32-bit big-endian length,
  // then the UTF-8 payload. Images made before the byte-level rewrite must still decode.
  const { Stego, store, canvas } = load();
  Stego.embedData(canvas, image(16, 16, 255), 'Hi');
  const lsbs = [];
  for (let i = 0; i < store.pixels.length && lsbs.length < 80; i++) {
    if (i % 4 !== 3) lsbs.push(store.pixels[i] & 1);
  }
  const bytes = [];
  for (let k = 0; k < 10; k++) bytes.push(parseInt(lsbs.slice(k * 8, k * 8 + 8).join(''), 2));
  assert.deepEqual(bytes, [0x53, 0x54, 0x47, 0x31, 0, 0, 0, 2, 0x48, 0x69]);
});

test('a corrupted length is refused, not read past the image', () => {
  const { Stego, store, canvas } = load();
  Stego.embedData(canvas, image(8, 8, 255), 'ok');
  for (let n = 32; n < 40; n++) store.pixels[n + Math.floor(n / 3)] |= 1;  // length's top byte -> 0xFF
  assert.throws(() => Stego.extractData({ width: 8, height: 8, pixels: store.pixels }), /exceeds image capacity/);
  assert.throws(() => Stego.extractData({ width: 2, height: 2, pixels: new Uint8ClampedArray(16) }), /too small/);
});

test('a damaged payload is reported, not decoded into garbage', () => {
  const { Stego, store, canvas } = load();
  Stego.embedData(canvas, image(16, 16, 255), 'héllo');
  // Flip the top bit of the first payload byte ('h' = 0x68 -> 0xE8, a lone UTF-8 lead byte).
  const bit = 64;  // payload starts after the 8-byte header
  store.pixels[bit + Math.floor(bit / 3)] ^= 1;
  assert.throws(() => Stego.extractData({ width: 16, height: 16, pixels: store.pixels }), /hidden data is damaged/);
});
