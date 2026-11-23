// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// ui.js auto-inits a toast container on load; a tiny document stub lets it run under Node.
const src = readFileSync(new URL('../src/js/ui.js', import.meta.url), 'utf8');
const ctx = {
  document: { readyState: 'complete', querySelector: () => null, createElement: () => ({ className: '', appendChild() {} }), body: { appendChild() {} } },
};
vm.runInNewContext(`${src}\nthis.UI = UI;`, ctx);
const { UI } = ctx;

test('formatBytes picks the right unit', () => {
  assert.equal(UI.formatBytes(0), '0 Bytes');
  assert.equal(UI.formatBytes(512), '512 Bytes');
  assert.equal(UI.formatBytes(1024), '1 KB');
  assert.equal(UI.formatBytes(1536), '1.5 KB');
  assert.equal(UI.formatBytes(5 * 1024 * 1024), '5 MB');
});

test('formatBytes never shows an undefined unit past terabytes', () => {
  // A size beyond 1 TB used to overflow the unit table and print "... undefined".
  assert.equal(UI.formatBytes(5 * 1024 ** 4), '5 TB');
  assert.equal(UI.formatBytes(3 * 1024 ** 5), '3072 TB');
  assert.ok(!/undefined/.test(UI.formatBytes(1024 ** 6)));
});
