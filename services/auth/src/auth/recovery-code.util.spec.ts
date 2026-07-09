import {
  generateRecoveryCodes,
  hashRecoveryCode,
  RECOVERY_CODE_COUNT,
  verifyRecoveryCode,
} from './recovery-code.util';

describe('recovery-code.util', () => {
  describe('generateRecoveryCodes', () => {
    it('generates RECOVERY_CODE_COUNT codes by default', () => {
      const codes = generateRecoveryCodes();

      expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    });

    it('generates unique, high-entropy (128-bit) codes on each call', () => {
      const codes = generateRecoveryCodes();

      expect(new Set(codes).size).toBe(codes.length);
      for (const code of codes) {
        expect(code).toMatch(
          /^[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/,
        );
        // 4 groups of 8 hex chars = 32 hex chars = 128 bits of entropy.
        expect(code.replace(/-/g, '')).toHaveLength(32);
      }
    });

    it('never repeats a batch of codes across calls', () => {
      const first = generateRecoveryCodes();
      const second = generateRecoveryCodes();

      const overlap = first.filter((code) => second.includes(code));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('hashRecoveryCode / verifyRecoveryCode', () => {
    it('hashes a code into something other than the plaintext', async () => {
      const hash = await hashRecoveryCode('ABCDE1234-FGHIJ5678');

      expect(hash).not.toBe('ABCDE1234-FGHIJ5678');
      expect(hash).not.toContain('ABCDE1234-FGHIJ5678');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('produces different hashes for the same code (random salt, like passwords)', async () => {
      const hashA = await hashRecoveryCode('ABCDE1234-FGHIJ5678');
      const hashB = await hashRecoveryCode('ABCDE1234-FGHIJ5678');

      expect(hashA).not.toBe(hashB);
    });

    it('verifies a correct code against its hash', async () => {
      const hash = await hashRecoveryCode('ABCDE1234-FGHIJ5678');

      await expect(
        verifyRecoveryCode(hash, 'ABCDE1234-FGHIJ5678'),
      ).resolves.toBe(true);
    });

    it('rejects an incorrect code against a real hash', async () => {
      const hash = await hashRecoveryCode('ABCDE1234-FGHIJ5678');

      await expect(
        verifyRecoveryCode(hash, 'WRONGCODE-000000000'),
      ).resolves.toBe(false);
    });

    it('rejects rather than throws on a malformed hash', async () => {
      await expect(
        verifyRecoveryCode('not-a-real-argon2-hash', 'anything'),
      ).resolves.toBe(false);
    });
  });
});
