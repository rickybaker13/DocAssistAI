import { jest, describe, it, expect, beforeAll } from '@jest/globals';

describe('encryption', () => {
  let encrypt: typeof import('../services/encryption.js').encrypt;
  let decrypt: typeof import('../services/encryption.js').decrypt;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const mod = await import('../services/encryption.js');
    encrypt = mod.encrypt;
    decrypt = mod.decrypt;
  });

  it('encrypts and decrypts a string', () => {
    const plaintext = 'John Doe';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext).not.toBeNull();
    expect(decrypt(ciphertext!)).toBe(plaintext);
  });

  it('returns null for null input', () => {
    expect(encrypt(null)).toBeNull();
    expect(decrypt(null)).toBeNull();
  });

  it('produces different ciphertexts for same input (random IV)', () => {
    const a = encrypt('test');
    const b = encrypt('test');
    expect(a).not.toBe(b); // Different IVs
    expect(decrypt(a!)).toBe('test');
    expect(decrypt(b!)).toBe('test');
  });

  it('handles special characters and unicode', () => {
    const text = 'José García-López, M.D. — Patient #12345';
    expect(decrypt(encrypt(text)!)).toBe(text);
  });

  it('handles empty string', () => {
    expect(decrypt(encrypt('')!)).toBe('');
  });
});
