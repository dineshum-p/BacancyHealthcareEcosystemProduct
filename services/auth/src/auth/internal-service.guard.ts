import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { InternalServiceConfig } from '../config/internal-service.config';
import { getInternalServiceConfig } from '../config/internal-service.config';

const INTERNAL_SERVICE_KEY_HEADER = 'x-internal-service-key';

/**
 * Guards routes reachable ONLY by trusted, service-to-service callers (BAC
 * -12) -- today, just `POST /auth/admin-seed`, called by `services/tenant`'s
 * onboarding orchestration to seed a brand-new tenant's first
 * `clinic_admin`. Deliberately NOT `AccessTokenGuard`: there is no end user
 * yet to hold a bearer token for that flow (the caller is another service
 * acting on behalf of a Super Admin who is authenticated against a
 * DIFFERENT tenant) -- see `AuthController`'s doc comment on `adminSeed`.
 *
 * Checks a shared secret (`X-Internal-Service-Key`) instead: this is
 * intentionally a much coarser trust boundary than per-user RBAC (any holder
 * of the secret can seed a `clinic_admin` for ANY active tenant), acceptable
 * here because the only real caller is another backend service, never a
 * browser -- same class of trust as the two services already sharing
 * `JWT_ACCESS_SECRET` to agree on what a valid access token means.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(
    @Optional()
    private readonly config: InternalServiceConfig = getInternalServiceConfig(),
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers[INTERNAL_SERVICE_KEY_HEADER];

    if (
      typeof providedKey !== 'string' ||
      providedKey.length === 0 ||
      providedKey !== this.config.internalServiceKey
    ) {
      throw new UnauthorizedException(
        'Missing or invalid internal service key.',
      );
    }

    return true;
  }
}
