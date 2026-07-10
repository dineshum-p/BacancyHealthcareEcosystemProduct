import {
  assertSafeSchemaName,
  quoteSchemaIdentifier,
} from './schema-identifier.util';

describe('assertSafeSchemaName', () => {
  it('accepts a lowercase, underscore schema name', () => {
    expect(() => assertSafeSchemaName('tenant_acme')).not.toThrow();
  });

  it('rejects a name starting with a digit', () => {
    expect(() => assertSafeSchemaName('1tenant')).toThrow(/unsafe schema name/);
  });

  it('rejects a name containing a SQL-injection-style payload', () => {
    expect(() =>
      assertSafeSchemaName('tenant"; DROP TABLE usage_events; --'),
    ).toThrow(/unsafe schema name/);
  });

  it('rejects an empty string', () => {
    expect(() => assertSafeSchemaName('')).toThrow(/unsafe schema name/);
  });
});

describe('quoteSchemaIdentifier', () => {
  it('double-quotes a safe schema name', () => {
    expect(quoteSchemaIdentifier('tenant_acme')).toBe('"tenant_acme"');
  });

  it('throws (does not quote) an unsafe schema name', () => {
    expect(() => quoteSchemaIdentifier('bad name')).toThrow(
      /unsafe schema name/,
    );
  });
});
