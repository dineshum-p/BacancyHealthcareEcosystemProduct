import { authenticator } from 'otplib';

/**
 * Generates a currently-valid TOTP code for a given secret. Used by
 * `scripts/dev-e2e-stack.ts` (repo root) to seed an MFA-active test user for
 * BAC-13's live browser E2E -- lives here (not in `scripts/`) so Node module
 * resolution finds `otplib` via `services/auth`'s own `node_modules`, same
 * reason `create-in-memory-pool.ts` lives under each service's own `test/
 * support/` rather than a shared location. Not used by any Jest spec.
 */
export function generateTotpCode(secret: string): string {
  return authenticator.generate(secret);
}
