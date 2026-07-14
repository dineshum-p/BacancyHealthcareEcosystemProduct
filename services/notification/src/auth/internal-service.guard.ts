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
 * -12) -- today, just `POST /notifications/internal`, called by
 * `services/tenant`'s onboarding orchestration to queue a brand-new tenant's
 * admin-invite email. Mirrors `services/auth`'s `InternalServiceGuard`
 * exactly (see that file's doc comment for the full trust-boundary
 * rationale) -- deliberately NOT `AccessTokenGuard`, since the caller (the
 * onboarding orchestrator, acting on behalf of a Super Admin authenticated
 * against a DIFFERENT tenant) has no bearer token scoped to the brand-new
 * tenant to present.
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
