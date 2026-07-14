import {
  assertSafeSchemaName,
  quoteSchemaIdentifier,
} from './schema-identifier.util';

describe('schema-identifier.util', () => {
  describe('assertSafeSchemaName', () => {
    it('accepts a lowercase, underscore schema name', () => {
      expect(() => assertSafeSchemaName('tenant_a')).not.toThrow();
    });

    it.each([
      'Tenant_A',
      '1tenant',
      'tenant-a',
      'tenant; DROP TABLE patients;--',
      '',
    ])('rejects an unsafe schema name %p', (unsafe) => {
      expect(() => assertSafeSchemaName(unsafe)).toThrow(/unsafe schema name/);
    });
  });

  describe('quoteSchemaIdentifier', () => {
    it('quotes a safe schema name', () => {
      expect(quoteSchemaIdentifier('tenant_a')).toBe('"tenant_a"');
    });

    it('throws for an unsafe schema name instead of quoting it', () => {
      expect(() => quoteSchemaIdentifier('bad; name')).toThrow(
        /unsafe schema name/,
      );
    });
  });
});
