import { authenticator } from 'otplib';
import {
  buildOtpauthUri,
  currentTotpStep,
  generateTotpSecret,
  verifyTotpCode,
} from './totp.util';

describe('totp.util', () => {
  it('generateTotpSecret returns a base32 secret usable by otplib', () => {
    const secret = generateTotpSecret();

    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
    // Base32 alphabet only (RFC 4648 -- authenticator apps require this).
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it('generateTotpSecret returns a fresh secret on each call', () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });

  it('buildOtpauthUri returns an otpauth:// URI carrying the account/issuer/secret', () => {
    const secret = generateTotpSecret();
    const uri = buildOtpauthUri('ada@example.com', 'Acme Inc', secret);

    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain(encodeURIComponent('ada@example.com'));
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('Acme');
  });

  it('verifyTotpCode returns the matched time-step for a valid current code', () => {
    const secret = generateTotpSecret();
    const code = authenticator.generate(secret);

    const step = verifyTotpCode(secret, code);

    expect(step).toBe(currentTotpStep());
  });

  it('verifyTotpCode returns null for an invalid code', () => {
    const secret = generateTotpSecret();

    expect(verifyTotpCode(secret, '000000')).toBeNull();
  });

  it('verifyTotpCode returns null for a code generated against a different secret', () => {
    const secret = generateTotpSecret();
    const otherSecret = generateTotpSecret();
    const codeForOtherSecret = authenticator.generate(otherSecret);

    expect(verifyTotpCode(secret, codeForOtherSecret)).toBeNull();
  });

  it('currentTotpStep advances once per 30-second step', () => {
    const stepNow = currentTotpStep();
    const expected = Math.floor(Date.now() / 1000 / 30);

    expect(stepNow).toBe(expected);
  });
});
