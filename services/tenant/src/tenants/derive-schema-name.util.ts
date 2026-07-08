import { assertSafeSchemaName } from './schema-identifier.util';

/**
 * Derives the dedicated Postgres schema name for a tenant from its slug
 * (BAC-3, AC2). Slugs are kebab-case (validated by `CreateTenantDto`);
 * Postgres identifiers can't contain hyphens, so they are translated to
 * underscores and namespaced with a `tenant_` prefix.
 *
 * Reuses `assertSafeSchemaName` (rather than a new hand-rolled check) as the
 * single choke point that guards every schema name before it is ever used in
 * a raw SQL identifier position.
 */
export function deriveSchemaName(slug: string): string {
  const schemaName = `tenant_${slug.replace(/-/g, '_')}`;
  assertSafeSchemaName(schemaName);
  return schemaName;
}
