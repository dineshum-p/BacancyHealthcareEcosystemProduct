const SAFE_SCHEMA_NAME = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * Postgres schema/table identifiers cannot be parameterized with query
 * placeholders, so any value that ends up interpolated into SQL (schema
 * names in particular) must be validated against an allow-list pattern
 * first. This is the single choke point every schema-name-bearing query in
 * this service goes through (mirrors `services/tenant`'s and
 * `services/auth`'s copy of the same guard).
 */
export function assertSafeSchemaName(schemaName: string): void {
  if (!SAFE_SCHEMA_NAME.test(schemaName)) {
    throw new Error(
      `Refusing to use unsafe schema name "${schemaName}". Schema names must match ${SAFE_SCHEMA_NAME}.`,
    );
  }
}

/** Quotes a schema name that has already been validated as safe. */
export function quoteSchemaIdentifier(schemaName: string): string {
  assertSafeSchemaName(schemaName);
  return `"${schemaName}"`;
}
