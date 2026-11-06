// Run with: npm test (node --test tests/rsa.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../src/js/rsa.js', import.meta.url), 'utf8');
const ctx = { crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, BigInt };
vm.runInNewContext(`${src}\nthis.RSA = RSA;`, ctx);
const { RSA } = ctx;

const bitLength = (n) => BigInt(n).toString(2).length;

test('random numbers have exactly the requested bit length and are odd', () => {
  for (const bits of [16, 61, 256, 512]) {
    for (let i = 0; i < 50; i++) {
      const n = RSA.randomBigInt(bits);
      assert.equal(bitLength(n), bits);
      assert.equal(n % 2n, 1n);
    }
  }
});

test('the modulus has the full key size', () => {
  for (let i = 0; i < 5; i++) {
    assert.equal(bitLength(RSA.generateKeyPair(512).publicKey.n), 512);
  }
});

test('primes avoid p = 1 mod e', () => {
  for (let i = 0; i < 20; i++) {
    const p = RSA.generatePrime(24, 3n);
    assert.notEqual((p - 1n) % 3n, 0n);
    assert.ok(RSA.millerRabin(p));
  }
});

test('encrypt then decrypt round-trips UTF-8 text', () => {
  const { publicKey, privateKey } = RSA.generateKeyPair(512);
  for (const msg of ['', 'hello', 'नमस्ते 🔐', 'a'.repeat(40)]) {
    assert.equal(RSA.decrypt(RSA.encrypt(msg, publicKey), privateKey), msg);
  }
});

test('PEM helpers round-trip keys', () => {
  const { publicKey, privateKey } = RSA.generateKeyPair(512);
  assert.deepEqual({ ...RSA.parsePublicKeyPEM(RSA.formatPublicKeyPEM(publicKey)) }, { ...publicKey });
  assert.deepEqual({ ...RSA.parsePrivateKeyPEM(RSA.formatPrivateKeyPEM(privateKey)) }, { ...privateKey });
});

test('the pages load the same scripts that are tested here', () => {
  // src/html/assets/ holds the copies the site actually serves.
  for (const name of ['rsa', 'stego', 'storage', 'ui', 'webcrypto']) {
    const tested = readFileSync(new URL(`../src/js/${name}.js`, import.meta.url), 'utf8');
    const served = readFileSync(new URL(`../src/html/assets/${name}.js`, import.meta.url), 'utf8');
    assert.equal(served, tested, `src/html/assets/${name}.js differs from src/js/${name}.js`);
  }
});
