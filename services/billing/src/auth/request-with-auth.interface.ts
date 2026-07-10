import type { AccessTokenPayload } from '@hep/shared-types';
import { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';

/**
 * Express request further augmented by `AccessTokenGuard` once a Bearer
 * access token is verified. Extends `RequestWithTenant` because
 * `AccessTokenGuard` always runs after `TenantGuard` and additionally checks
 * `payload.tenantId` against the already-resolved `request.tenant` -- same
 * convention as `services/tenant`/`services/notification`/`services/emr`'s
 * `RequestWithAuth`.
 */
export interface RequestWithAuth extends RequestWithTenant {
  user?: AccessTokenPayload;
}
