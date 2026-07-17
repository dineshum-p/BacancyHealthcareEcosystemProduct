/**
 * Extends `public.tenants` with `modules` -- the set of product modules a
 * tenant is granted access to (PRD Section 3/6), selected at onboarding and
 * used to compute the tenant's subscription pricing.
 *
 * `text[]` NOT NULL DEFAULT '{}' so pre-existing rows (created before module
 * selection existed) become an empty grant rather than NULL -- the same
 * "safe empty default for backfilled rows" approach the earlier `name`/`plan`
 * additive migration used.
 *
 * NOTE: migrations are frozen historical artifacts, so this is an additive
 * migration rather than an edit to an earlier one.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
  pgm.addColumns(
    { schema: 'public', name: 'tenants' },
    {
      modules: {
        type: 'text[]',
        notNull: true,
        default: pgm.func("'{}'"),
      },
    },
  );
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropColumns({ schema: 'public', name: 'tenants' }, ['modules']);
};
