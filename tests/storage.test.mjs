// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../src/js/storage.js', import.meta.url), 'utf8');

function vault(window) {
  const ctx = { window };
  vm.runInNewContext(`${src}\nthis.KeyVault = KeyVault;`, ctx);
  return ctx.KeyVault;
}

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('keys round-trip per mode and can be cleared', () => {
  const KeyVault = vault({ sessionStorage: memoryStorage() });
  assert.equal(KeyVault.saveKeys('rsa', 'PUB', 'PRIV'), true);
  assert.deepEqual({ ...KeyVault.getKeys('rsa') }, { publicKey: 'PUB', privateKey: 'PRIV' });
  assert.equal(KeyVault.hasKeys('webcrypto'), false);
  KeyVault.clearKeys('rsa');
  assert.equal(KeyVault.hasKeys('rsa'), false);
});

test('blocked storage does not throw', () => {
  // As in a browser with site storage blocked: even reading window.sessionStorage throws.
  const blocked = {};
  Object.defineProperty(blocked, 'sessionStorage', { get() { throw new Error('SecurityError'); } });
  const quotaFull = { sessionStorage: { ...memoryStorage(), setItem() { throw new Error('QuotaExceededError'); } } };
  for (const window of [blocked, quotaFull, {}]) {
    const KeyVault = vault(window);
    assert.equal(KeyVault.saveKeys('rsa', 'PUB', 'PRIV'), false);
    assert.equal(KeyVault.hasKeys('rsa'), false);
    assert.doesNotThrow(() => KeyVault.clearKeys('rsa'));
  }
});
