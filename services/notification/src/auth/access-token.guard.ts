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
 * Verifies a `Bearer <access-token>` on routes that require an authenticated
 * user identity -- mirrors `services/tenant`'s `AccessTokenGuard` (BAC-8)
 * exactly, since both services must agree on the same verification
 * semantics for a token to mean the same thing wherever it is checked.
 *
 * Applied to `POST /notifications` (this ticket's deliberate call: an
 * unauthenticated "send arbitrary SMS/email" endpoint is a real abuse/cost
 * vector -- spam, phishing using the tenant's identity -- so the direct HTTP
 * route requires proof of SOME valid platform user, same as
 * `services/tenant`'s BAC-8 pattern for its own mutating routes). The
 * internal event-consumer path (`user.registered` -> notification) invokes
 * the underlying send logic directly, without going through this guard,
 * since it is not an HTTP-triggered call at all.
 *
 * Must run AFTER `TenantGuard` (`@UseGuards(TenantGuard, AccessTokenGuard)`)
 * so `request.tenant` is already resolved: this guard additionally checks
 * the token's `tenantId` claim against that resolved tenant, rejecting a
 * token that is otherwise valid but was issued for a different tenant than
 * the one identified by `X-Tenant-Id` on this request.
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

function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader?.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}
