/**
 * BAC-3: extends `public.tenants` (created in
 * `1751980800000_create-tenants-table.mjs`) with the onboarding fields
 * collected by `POST /tenants` (`name`, `plan`) and allows the new `pending`
 * provisioning status (a tenant starts `pending` and only becomes `active`
 * once its schema + baseline migrations succeed).
 *
 * NOTE: migrations are frozen historical artifacts, so this is an additive
 * migration rather than an edit to the original `create-tenants-table`
 * migration.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
  pgm.addColumns(
    { schema: 'public', name: 'tenants' },
    {
      // Default '' (rather than leaving nullable) so any pre-existing rows
      // stay valid under the new NOT NULL constraint; application code
      // always supplies a real value going forward.
      name: { type: 'text', notNull: true, default: '' },
      plan: { type: 'text', notNull: true, default: '' },
    },
  );

  pgm.dropConstraint({ schema: 'public', name: 'tenants' }, 'tenants_status_check');
  pgm.addConstraint({ schema: 'public', name: 'tenants' }, 'tenants_status_check', {
    check: "status IN ('pending', 'active', 'inactive')",
  });
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropConstraint({ schema: 'public', name: 'tenants' }, 'tenants_status_check');
  pgm.addConstraint({ schema: 'public', name: 'tenants' }, 'tenants_status_check', {
    check: "status IN ('active', 'inactive')",
  });

  pgm.dropColumns({ schema: 'public', name: 'tenants' }, ['name', 'plan']);
};
