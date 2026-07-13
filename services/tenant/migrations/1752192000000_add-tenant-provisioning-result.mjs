/**
 * BAC-12: extends `public.tenants` with two nullable provisioning-result
 * columns written by the new `POST /tenants/onboard` orchestration
 * (`OnboardingService`):
 *
 *   - `admin_seed_status`: outcome of seeding the tenant's first
 *     `clinic_admin` via `services/auth`'s `POST /auth/admin-seed`.
 *   - `invite_status`: outcome of queuing the admin's invite notification via
 *     `services/notification`'s `POST /notifications/internal`.
 *
 * Both are `NULL` for every tenant not created through `POST /tenants/onboard`
 * (e.g. the plain `POST /tenants` bootstrap endpoint from BAC-3) -- there is
 * no provisioning-result outcome to report for those, so `NULL` unambiguously
 * means "not applicable", distinct from a real `'failed'` outcome.
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
      admin_seed_status: { type: 'text', notNull: false },
      invite_status: { type: 'text', notNull: false },
    },
  );

  pgm.addConstraint({ schema: 'public', name: 'tenants' }, 'tenants_admin_seed_status_check', {
    check: "admin_seed_status IS NULL OR admin_seed_status IN ('succeeded', 'failed', 'skipped')",
  });
  pgm.addConstraint({ schema: 'public', name: 'tenants' }, 'tenants_invite_status_check', {
    check: "invite_status IS NULL OR invite_status IN ('succeeded', 'failed', 'skipped')",
  });
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropConstraint({ schema: 'public', name: 'tenants' }, 'tenants_admin_seed_status_check');
  pgm.dropConstraint({ schema: 'public', name: 'tenants' }, 'tenants_invite_status_check');
  pgm.dropColumns({ schema: 'public', name: 'tenants' }, [
    'admin_seed_status',
    'invite_status',
  ]);
};
