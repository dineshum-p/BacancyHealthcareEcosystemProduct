import { Injectable, Optional } from '@nestjs/common';
import type { OnboardingConfig } from '../config/onboarding.config';
import { getOnboardingConfig } from '../config/onboarding.config';
import type { AuthServiceClient } from './auth-service.client';
import type { OrchestrationStepResult } from './orchestration-step-result.interface';
import { readErrorMessage } from './read-error-message.util';

const INTERNAL_SERVICE_KEY_HEADER = 'X-Internal-Service-Key';

/**
 * Real, `fetch`-backed implementation of `AuthServiceClient` (BAC-12).
 * Calls `services/auth`'s `POST /auth/admin-seed`, presenting:
 *
 *   - `X-Tenant-Id: tenantId` -- the BRAND-NEW tenant just provisioned by
 *     `TenantsService.create` (NOT the calling Super Admin's own tenant),
 *     so `services/auth`'s `TenantGuard` resolves/validates THAT tenant.
 *   - `X-Internal-Service-Key` -- the shared secret `InternalServiceGuard`
 *     checks INSTEAD of a bearer token (there is no end-user token scoped
 *     to the brand-new tenant to present -- see that guard's doc comment).
 *
 * Bounded by `config.requestTimeoutMs` (`AbortSignal.timeout`) so a hung
 * downstream call can never hang `POST /tenants/onboard` forever -- a
 * timeout is treated exactly like any other network failure: `'failed'`,
 * never a thrown error the caller has to separately handle.
 */
@Injectable()
export class HttpAuthServiceClient implements AuthServiceClient {
  constructor(
    @Optional()
    private readonly config: OnboardingConfig = getOnboardingConfig(),
  ) {}

  async seedClinicAdmin(
    tenantId: string,
    email: string,
  ): Promise<OrchestrationStepResult> {
    try {
      const response = await fetch(
        `${this.config.authServiceUrl}/auth/admin-seed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId,
            [INTERNAL_SERVICE_KEY_HEADER]: this.config.internalServiceKey,
          },
          body: JSON.stringify({ email }),
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        },
      );

      if (!response.ok) {
        return { outcome: 'failed', error: await readErrorMessage(response) };
      }
      return { outcome: 'succeeded' };
    } catch (error) {
      return {
        outcome: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
