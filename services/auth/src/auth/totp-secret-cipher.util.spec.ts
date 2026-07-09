import {
  decryptTotpSecret,
  encryptTotpSecret,
} from './totp-secret-cipher.util';

describe('totp-secret-cipher.util', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('round-trips a TOTP secret through encrypt/decrypt', () => {
    process.env.MFA_ENCRYPTION_KEY = 'a-strong-random-test-mfa-key';
    const rawSecret = 'JBSWY3DPEHPK3PXP';

    const encrypted = encryptTotpSecret(rawSecret);

    expect(encrypted).not.toBe(rawSecret);
    expect(encrypted).not.toContain(rawSecret);
    expect(decryptTotpSecret(encrypted)).toBe(rawSecret);
  });

  it('produces different ciphertext for the same secret on each call (random IV)', () => {
    process.env.MFA_ENCRYPTION_KEY = 'a-strong-random-test-mfa-key';
    const rawSecret = 'JBSWY3DPEHPK3PXP';

    const first = encryptTotpSecret(rawSecret);
    const second = encryptTotpSecret(rawSecret);

    expect(first).not.toBe(second);
    expect(decryptTotpSecret(first)).toBe(rawSecret);
    expect(decryptTotpSecret(second)).toBe(rawSecret);
  });

  it('fails to decrypt when the encryption key changes (tampered/rotated key)', () => {
    process.env.MFA_ENCRYPTION_KEY = 'key-one-strong-random-value';
    const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP');

    process.env.MFA_ENCRYPTION_KEY = 'key-two-different-strong-value';
    expect(() => decryptTotpSecret(encrypted)).toThrow();
  });

  it('fails to decrypt tampered ciphertext (GCM auth tag integrity check)', () => {
    process.env.MFA_ENCRYPTION_KEY = 'a-strong-random-test-mfa-key';
    const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP');
    const [iv, tag, data] = encrypted.split('.');
    const tamperedData = Buffer.from(data, 'base64');
    tamperedData[0] ^= 0xff;
    const tampered = [iv, tag, tamperedData.toString('base64')].join('.');

    expect(() => decryptTotpSecret(tampered)).toThrow();
  });
});
