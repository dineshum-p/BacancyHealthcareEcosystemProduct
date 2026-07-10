import {
  assertSafeSchemaName,
  quoteSchemaIdentifier,
} from './schema-identifier.util';

describe('schema-identifier.util', () => {
  describe('assertSafeSchemaName', () => {
    it('accepts lowercase, digit, underscore names starting with a letter', () => {
      expect(() => assertSafeSchemaName('tenant_a1')).not.toThrow();
    });

    it.each([
      'Tenant_A',
      '1tenant',
      'tenant-a',
      'tenant a',
      'tenant";DROP TABLE tenants;--',
      '',
    ])('rejects unsafe schema name %p', (unsafe) => {
      expect(() => assertSafeSchemaName(unsafe)).toThrow();
    });
  });

  describe('quoteSchemaIdentifier', () => {
    it('quotes a safe schema name', () => {
      expect(quoteSchemaIdentifier('tenant_a')).toBe('"tenant_a"');
    });

    it('throws instead of quoting an unsafe schema name', () => {
      expect(() => quoteSchemaIdentifier('bad; drop table x;')).toThrow();
    });
  });
});
