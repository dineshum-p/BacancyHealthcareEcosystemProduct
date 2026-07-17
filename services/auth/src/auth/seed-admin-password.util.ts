import { generateRandomPassword } from './random-password.util';

/**
 * The known, static password a seeded `clinic_admin` is created with in
 * local dev/test, so a freshly-onboarded tenant's admin can actually be
 * logged into WITHOUT a password-reset/invite-redemption flow (that flow is
 * still out of scope -- see `AuthService.seedClinicAdmin`).
 *
 * This is a developer-convenience default and is committed in this repo, so
 * it MUST never stand in as a real credential. `resolveSeedAdminPassword`
 * only returns it under `test`/`development`; every other environment
 * (including an unset `NODE_ENV`, treated as a real deployment) keeps
 * BAC-12's original behaviour of an unguessable random password, leaving the
 * seeded account unusable until a real reset flow is built.
 */
export const DEV_SEED_ADMIN_PASSWORD = 'Test@123';

/** `NODE_ENV` values allowed to use the known dev seed password. */
const ENVS_ALLOWING_DEV_SEED_PASSWORD = new Set(['test', 'development']);

/**
 * Resolves the plaintext password a seeded `clinic_admin` is created with:
 * the known `DEV_SEED_ADMIN_PASSWORD` in local dev/test, an unguessable
 * random string everywhere else. Mirrors `getAuthConfig`'s fail-safe posture
 * (an unset `NODE_ENV` is treated as a real deployment, NOT dev), so this
 * convenience can never silently weaken a production credential.
 */
export function resolveSeedAdminPassword(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  if (ENVS_ALLOWING_DEV_SEED_PASSWORD.has(nodeEnv ?? '')) {
    return DEV_SEED_ADMIN_PASSWORD;
  }
  return generateRandomPassword();
}
