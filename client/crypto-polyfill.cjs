const crypto = require('crypto');
const nodeCrypto = require('node:crypto');

const webcrypto = crypto.webcrypto;

if (webcrypto) {
  const getRandomValues = webcrypto.getRandomValues.bind(webcrypto);

  // Mutate the CommonJS require('crypto') exports
  if (!crypto.getRandomValues) {
    Object.defineProperty(crypto, 'getRandomValues', {
      value: getRandomValues,
      writable: true,
      configurable: true
    });
  }

  // Mutate the CommonJS require('node:crypto') exports
  if (!nodeCrypto.getRandomValues) {
    Object.defineProperty(nodeCrypto, 'getRandomValues', {
      value: getRandomValues,
      writable: true,
      configurable: true
    });
  }
}

// Polyfill globals
if (typeof global.crypto === 'undefined') {
  global.crypto = webcrypto;
}
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto;
}
