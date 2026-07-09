import {
  generateRecoveryCodes,
  hashRecoveryCode,
  RECOVERY_CODE_COUNT,
} from './recovery-code.util';

describe('recovery-code.util', () => {
  describe('generateRecoveryCodes', () => {
    it('generates RECOVERY_CODE_COUNT codes by default', () => {
      const codes = generateRecoveryCodes();

      expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    });

    it('generates unique, high-entropy codes on each call', () => {
      const codes = generateRecoveryCodes();

      expect(new Set(codes).size).toBe(codes.length);
      for (const code of codes) {
        expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
      }
    });

    it('never repeats a batch of codes across calls', () => {
      const first = generateRecoveryCodes();
      const second = generateRecoveryCodes();

      const overlap = first.filter((code) => second.includes(code));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('hashRecoveryCode', () => {
    it('is deterministic (same code -> same hash, for lookup)', () => {
      expect(hashRecoveryCode('ABCDE-12345')).toBe(
        hashRecoveryCode('ABCDE-12345'),
      );
    });

    it('never returns the raw code', () => {
      const hash = hashRecoveryCode('ABCDE-12345');

      expect(hash).not.toBe('ABCDE-12345');
      expect(hash).not.toContain('ABCDE-12345');
    });

    it('produces different hashes for different codes', () => {
      expect(hashRecoveryCode('ABCDE-12345')).not.toBe(
        hashRecoveryCode('FGHIJ-67890'),
      );
    });
  });
});
