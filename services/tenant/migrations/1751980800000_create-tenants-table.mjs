/**
 * BAC-4: minimum tenant-registry primitive needed to resolve tenant context
 * and enforce schema isolation. Full onboarding (plans/billing/etc.) is
 * BAC-3's scope and can extend this table later.
 *
 * NOTE: migrations are frozen historical artifacts, so the DDL below is
 * intentionally inlined rather than importing from `src/` (application code
 * is free to evolve independently of past migrations).
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
  pgm.createTable(
    { schema: 'public', name: 'tenants' },
    {
      id: { type: 'text', primaryKey: true },
      slug: { type: 'text', notNull: true, unique: true },
      status: {
        type: 'text',
        notNull: true,
        check: "status IN ('active', 'inactive')",
      },
      schema_name: { type: 'text', notNull: true, unique: true },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
    },
  );
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable({ schema: 'public', name: 'tenants' });
};
