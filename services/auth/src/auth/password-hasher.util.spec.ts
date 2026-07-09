import { hashPassword, verifyPassword } from './password-hasher.util';

describe('password-hasher.util', () => {
  it('hashes a password into something other than the plaintext', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toBe('correct-horse-battery-staple');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    await expect(
      verifyPassword(hash, 'correct-horse-battery-staple'),
    ).resolves.toBe(true);
  });

  it('rejects an incorrect password against a real hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('rejects rather than throws on a malformed hash', async () => {
    await expect(
      verifyPassword('not-a-real-argon2-hash', 'anything'),
    ).resolves.toBe(false);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const hashA = await hashPassword('same-password');
    const hashB = await hashPassword('same-password');
    expect(hashA).not.toBe(hashB);
  });
});
