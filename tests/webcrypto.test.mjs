// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

// webcrypto.js is a browser script; give it the same globals a page would.
const src = readFileSync(new URL('../src/js/webcrypto.js', import.meta.url), 'utf8');
const ctx = {
  window: { crypto: webcrypto }, crypto: webcrypto, performance,
  TextEncoder, TextDecoder, Uint8Array, btoa, atob,
};
vm.runInNewContext(`${src}\nthis.WebCrypto = WebCrypto;`, ctx);
const WebCrypto = ctx.WebCrypto;

const rsa = await WebCrypto.generateRSAKeyPair(2048);

test('hybrid encryption round-trips a long message', async () => {
  const message = 'Meet at the old fort at dawn. '.repeat(200) + 'నమస్తే 🔐';
  const payload = await WebCrypto.hybridEncrypt(message, rsa.publicKey);
  assert.equal(await WebCrypto.hybridDecrypt(payload, rsa.privateKey), message);
});

test('keys survive a PEM export and import', async () => {
  const pub = await WebCrypto.importPublicKeyPEM(await WebCrypto.exportPublicKeyPEM(rsa.publicKey));
  const priv = await WebCrypto.importPrivateKeyPEM(await WebCrypto.exportPrivateKeyPEM(rsa.privateKey));
  assert.equal(await WebCrypto.rsaDecrypt(await WebCrypto.rsaEncrypt('hi', pub), priv), 'hi');
});

test('file packages round-trip and reject tampering', async () => {
  const file = new Uint8Array(5000).map((_, i) => (i * 31) % 256);
  const pkg = new Uint8Array(await WebCrypto.encryptFile(file.buffer, rsa.publicKey));
  const back = new Uint8Array(await WebCrypto.decryptFile(pkg.buffer, rsa.privateKey));
  assert.deepEqual(back, file);

  pkg[pkg.length - 1] ^= 1; // flip one bit of the ciphertext: AES-GCM must notice
  await assert.rejects(WebCrypto.decryptFile(pkg.buffer, rsa.privateKey));
  await assert.rejects(WebCrypto.decryptFile(new Uint8Array([1, 0, 0]).buffer, rsa.privateKey),
    /corrupted or truncated/);
});

test('signatures verify and catch a changed message', async () => {
  const keys = await WebCrypto.generateSigningKeyPair(2048);
  const sig = await WebCrypto.sign('pay 100', keys.privateKey);
  assert.equal(await WebCrypto.verify('pay 100', sig, keys.publicKey), true);
  assert.equal(await WebCrypto.verify('pay 900', sig, keys.publicKey), false);
});

test('sha256 matches the standard test vector', async () => {
  assert.equal(await WebCrypto.sha256('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('pasting the wrong key says which key was expected', async () => {
  const pub = await WebCrypto.exportPublicKeyPEM(rsa.publicKey);
  const priv = await WebCrypto.exportPrivateKeyPEM(rsa.privateKey);
  await assert.rejects(WebCrypto.importPublicKeyPEM(priv), /private key; paste the public key here/);
  await assert.rejects(WebCrypto.importPrivateKeyPEM(pub), /public key; paste the private key here/);
  await assert.rejects(WebCrypto.importPublicKeyPEM('  '), /Paste a public key first/);
  await assert.rejects(WebCrypto.importPublicKeyPEM('-----BEGIN RSA PUBLIC KEY-----\nAAAA\n-----END RSA PUBLIC KEY-----'),
    /educational RSA tool/);
  await assert.rejects(WebCrypto.importPrivateKeyPEM('not a key!'), /Not a valid private key/);
  // Valid base64 that isn't a key, or a key cut short
  await assert.rejects(WebCrypto.importPublicKeyPEM(pub.slice(0, 200) + '\n-----END PUBLIC KEY-----'),
    /Not a valid RSA public key/);
});
