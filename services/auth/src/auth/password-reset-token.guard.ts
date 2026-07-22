import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordResetTokenService } from './password-reset-token.service';
import { RequestWithPasswordResetAuth } from './request-with-password-reset-auth.interface';
import { extractBearerToken } from './access-token.guard';

/**
 * Verifies a `Bearer <password-reset-token>` on `POST
 * /auth/reset-temporary-password` ONLY (BAC-49). Deliberately NOT
 * `AccessTokenGuard`: a `login()` call that returns
 * `PasswordResetRequiredChallenge` mints its `accessToken` via
 * `PasswordResetTokenService`, not `AccessTokenService` -- a token this
 * guard accepts and `AccessTokenGuard` rejects, and vice versa (distinct
 * signing secret + an explicit `purpose` claim, mirroring
 * `MfaChallengeTokenService`'s established pattern). This is what stops the
 * reset-required credential from working as a general Bearer token against
 * any other `AccessTokenGuard`-protected route (e.g. `GET /auth/roles`) --
 * it simply fails signature verification there before any claim is ever
 * inspected.
 *
 * Must run AFTER `TenantGuard` (same ordering convention as
 * `AccessTokenGuard`) so `request.tenant` is already resolved: this guard
 * additionally checks the token's `tenantId` claim against that resolved
 * tenant.
 */
@Injectable()
export class PasswordResetTokenGuard implements CanActivate {
  constructor(
    private readonly passwordResetTokenService: PasswordResetTokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithPasswordResetAuth>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing or malformed access token.');
    }
    if (!request.tenant) {
      throw new UnauthorizedException(
        'Tenant context was requested before TenantGuard resolved a tenant. Protect this route with TenantGuard.',
      );
    }

    try {
      const payload = this.passwordResetTokenService.verify(token);
      if (payload.tenantId !== request.tenant.id) {
        throw new Error('Password-reset token tenant mismatch.');
      }
      request.user = payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    return true;
  }
}
