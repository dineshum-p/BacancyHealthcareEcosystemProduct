import { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { PasswordResetTokenPayload } from './password-reset-token.service';

/**
 * Express request further augmented by `PasswordResetTokenGuard` once a
 * Bearer password-reset token is verified (BAC-49). Deliberately a DISTINCT
 * shape from `RequestWithAuth` (whose `user` is a full `AccessTokenPayload`,
 * including `role`): a password-reset token carries only `userId`/
 * `tenantId`/`purpose` -- there is no role/permission concept for this
 * narrowly-scoped credential, by design.
 */
export interface RequestWithPasswordResetAuth extends RequestWithTenant {
  user?: PasswordResetTokenPayload;
}
