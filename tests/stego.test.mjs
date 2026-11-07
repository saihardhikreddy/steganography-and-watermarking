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
