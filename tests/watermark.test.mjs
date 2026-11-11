// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../src/js/watermark.js', import.meta.url), 'utf8');
const ctx = {};
vm.runInNewContext(`${src}\nthis.Watermark = Watermark;`, ctx);
const { Watermark } = ctx;

test('top positions use the font size as a number, not as text', () => {
  // The page passes the range input's value, which is a string.
  assert.deepEqual({ ...Watermark.position('top-left', 800, 600, 100, '28') }, { x: 12, y: 40 });
  assert.deepEqual({ ...Watermark.position('top-right', 800, 600, 100, '28') }, { x: 688, y: 40 });
});

test('every position keeps the text on the canvas', () => {
  const [w, h, tw, size] = [640, 480, 200, '48'];
  for (const pos of ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center']) {
    const { x, y } = Watermark.position(pos, w, h, tw, size);
    assert.ok(x >= 0 && x + tw <= w, `${pos}: x=${x}`);
    // textBaseline is 'bottom', so the text spans y - size .. y.
    assert.ok(y - 48 >= 0 && y <= h, `${pos}: y=${y}`);
  }
  assert.deepEqual({ ...Watermark.position('center', w, h, tw, size) }, { x: 220, y: 264 });
  assert.deepEqual({ ...Watermark.position('nonsense', w, h, tw, size) },
    { ...Watermark.position('bottom-right', w, h, tw, size) });
});

test('hex colours', () => {
  assert.deepEqual({ ...Watermark.hexToRgb('#ff8000') }, { r: 255, g: 128, b: 0 });
  assert.deepEqual({ ...Watermark.hexToRgb('#0f8') }, { r: 0, g: 255, b: 136 });
  assert.deepEqual({ ...Watermark.hexToRgb('ABCDEF') }, { r: 171, g: 205, b: 239 });
  for (const bad of ['', null, '#12', '#zzzzzz', '#1234567']) assert.equal(Watermark.hexToRgb(bad), null, String(bad));
});
