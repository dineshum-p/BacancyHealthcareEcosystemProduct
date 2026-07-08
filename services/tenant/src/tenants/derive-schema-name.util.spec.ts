import { deriveSchemaName } from './derive-schema-name.util';

describe('deriveSchemaName', () => {
  it('prefixes the slug with tenant_ and replaces hyphens with underscores', () => {
    expect(deriveSchemaName('acme-corp')).toBe('tenant_acme_corp');
  });

  it('leaves a slug with no hyphens intact aside from the prefix', () => {
    expect(deriveSchemaName('acme')).toBe('tenant_acme');
  });

  it('rejects a slug that would derive an unsafe schema name', () => {
    // A safe (DTO-validated) slug can never actually produce this, but the
    // derivation must not silently succeed if it ever did.
    expect(() => deriveSchemaName('acme; drop table x;')).toThrow(
      /unsafe schema name/i,
    );
  });
});
