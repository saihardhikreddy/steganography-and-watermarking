/* ========== Secure Key Storage (Session) ========== */

const KeyVault = (() => {
  const PREFIX_WC = 'stego_wc_';
  const PREFIX_RSA = 'stego_rsa_';

  /**
   * Securely store keys in sessionStorage. 
   * This ensures keys don't persist after the browser tab closes, 
   * improving security compared to localStorage, while allowing cross-page navigation.
   */
  // sessionStorage can be missing or throw (storage blocked in the browser's privacy settings,
  // some private windows, a full quota). Keys then just aren't remembered across pages: a freshly
  // generated key pair must not be reported as a failure because saving it failed.
  function store() {
    try {
      return window.sessionStorage || null;
    } catch (e) {
      return null;
    }
  }

  function attempt(fn, fallback) {
    const s = store();
    if (!s) return fallback;
    try {
      return fn(s);
    } catch (e) {
      return fallback;
    }
  }

  /** Returns true if the keys were stored. */
  function saveKeys(mode, publicKeyPem, privateKeyPem) {
    const prefix = mode === 'webcrypto' ? PREFIX_WC : PREFIX_RSA;
    return attempt((s) => {
      if (publicKeyPem) s.setItem(prefix + 'pub', publicKeyPem);
      if (privateKeyPem) s.setItem(prefix + 'priv', privateKeyPem);
      return true;
    }, false);
  }

  function getKeys(mode) {
    const prefix = mode === 'webcrypto' ? PREFIX_WC : PREFIX_RSA;
    return attempt((s) => ({
      publicKey: s.getItem(prefix + 'pub'),
      privateKey: s.getItem(prefix + 'priv')
    }), { publicKey: null, privateKey: null });
  }

  function clearKeys(mode) {
    const prefix = mode === 'webcrypto' ? PREFIX_WC : PREFIX_RSA;
    attempt((s) => {
      s.removeItem(prefix + 'pub');
      s.removeItem(prefix + 'priv');
    });
  }

  function hasKeys(mode) {
    const keys = getKeys(mode);
    return !!(keys.publicKey && keys.privateKey);
  }

  return { saveKeys, getKeys, clearKeys, hasKeys };
})();
