import { generateRefreshToken, hashRefreshToken } from './refresh-token.util';

describe('refresh-token.util', () => {
  it('generates high-entropy, unique refresh tokens', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(48);
  });

  it('hashes a token deterministically (same input -> same hash)', () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it('produces different hashes for different tokens', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(hashRefreshToken(a)).not.toBe(hashRefreshToken(b));
  });

  it('never returns the raw token as its own hash', () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).not.toBe(token);
  });
});
