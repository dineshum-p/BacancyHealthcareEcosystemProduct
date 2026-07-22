import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessTokenService } from './access-token.service';
import { RequestWithAuth } from './request-with-auth.interface';

const BEARER_PREFIX = 'Bearer ';

/**
 * Verifies a `Bearer <access-token>` on routes that require an
 * authenticated user identity -- currently only `POST /auth/mfa/enroll` and
 * `POST /auth/mfa/verify` (BAC-6): a user must already hold a valid
 * access token (from a normal login) before they can start/complete MFA
 * enrollment for their own account.
 *
 * Must run AFTER `TenantGuard` (`@UseGuards(TenantGuard, AccessTokenGuard)`
 * or class-level TenantGuard + method-level AccessTokenGuard -- Nest runs
 * class guards before route guards) so `request.tenant` is already
 * resolved: this guard additionally checks the token's `tenantId` claim
 * against that resolved tenant, rejecting a token that is otherwise valid
 * but was issued for a different tenant than the one identified by
 * `X-Tenant-Id` on this request.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly accessTokenService: AccessTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
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
      const payload = this.accessTokenService.verify(token);
      if (payload.tenantId !== request.tenant.id) {
        throw new Error('Access token tenant mismatch.');
      }
      request.user = payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    return true;
  }
}

/** Shared with `PasswordResetTokenGuard` -- both parse the same `Authorization: Bearer <token>` header convention. */
export function extractBearerToken(
  authorizationHeader?: string,
): string | null {
  if (!authorizationHeader?.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}
