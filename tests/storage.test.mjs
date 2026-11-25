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

test('a save that fails part way never leaves a mismatched key pair', () => {
  const storage = memoryStorage();
  const KeyVault = vault({ sessionStorage: storage });
  assert.equal(KeyVault.saveKeys('rsa', 'OLD_PUB', 'OLD_PRIV'), true);
  // The quota fills up after the new public key is written.
  const setItem = storage.setItem;
  storage.setItem = (k, v) => { if (k.endsWith('priv')) throw new Error('QuotaExceededError'); setItem(k, v); };
  assert.equal(KeyVault.saveKeys('rsa', 'NEW_PUB', 'NEW_PRIV'), false);
  assert.deepEqual({ ...KeyVault.getKeys('rsa') }, { publicKey: null, privateKey: null });
  assert.equal(KeyVault.hasKeys('rsa'), false);
});

test('saving one half clears the other half of the old pair', () => {
  const KeyVault = vault({ sessionStorage: memoryStorage() });
  KeyVault.saveKeys('webcrypto', 'OLD_PUB', 'OLD_PRIV');
  assert.equal(KeyVault.saveKeys('webcrypto', 'NEW_PUB', null), true);
  assert.deepEqual({ ...KeyVault.getKeys('webcrypto') }, { publicKey: 'NEW_PUB', privateKey: null });
  assert.equal(KeyVault.hasKeys('webcrypto'), false);
});
