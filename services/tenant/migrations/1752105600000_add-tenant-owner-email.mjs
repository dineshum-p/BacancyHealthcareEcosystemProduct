/**
 * BAC-7: extends `public.tenants` with `owner_email`, the single email
 * address permitted to bootstrap a tenant's `super_admin` at registration
 * time (`services/auth`'s `AuthService.register` only promotes a registrant
 * whose email exactly matches this column, instead of "whoever registers
 * first" -- see that service's `AuthService.register` doc comment for the
 * account-takeover exploit this closes: an unauthenticated `POST /tenants`
 * with a human-guessable slug used to let anyone race the real owner to
 * become a brand-new tenant's sole admin).
 *
 * Nullable, unlike `name`/`plan` in the prior additive migration: there is
 * no safe non-empty default to backfill pre-existing rows with (an empty
 * string would be indistinguishable from "the empty string is the owner
 * email", which is not a valid email and could never match a real
 * registrant anyway -- `NULL` unambiguously means "no bootstrap-eligible
 * owner", which is the correct, safe reading for tenants that predate this
 * migration). `CreateTenantDto.ownerEmail` requires a real value for every
 * tenant onboarded going forward.
 *
 * NOTE: migrations are frozen historical artifacts, so this is an additive
 * migration rather than an edit to `1752019200000_add-tenant-onboarding-
 * fields.mjs`.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
  pgm.addColumns(
    { schema: 'public', name: 'tenants' },
    {
      owner_email: { type: 'text', notNull: false },
    },
  );
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropColumns({ schema: 'public', name: 'tenants' }, ['owner_email']);
};
