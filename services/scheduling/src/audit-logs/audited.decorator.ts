import { SetMetadata } from '@nestjs/common';
import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';

export const AUDITED_METADATA_KEY = 'bac16:audited';

/**
 * Options for `@Audited(...)`, mirroring `services/tenant`'s BAC-8 (and
 * every other service's) mechanism exactly. `resolveBefore` is the contract
 * point a future handler wanting an explicit pre-mutation snapshot would
 * use; every mutation route in this service (create/reschedule/cancel)
 * follows the same repo-wide convention of not supplying one (the "before"
 * value recorded is always `null`).
 */
export interface AuditedOptions {
  resolveBefore?: (request: RequestWithTenant) => unknown;
}

export interface AuditedMetadata {
  resourceType: string;
  options: AuditedOptions;
}

/**
 * Marks a controller method as a mutation that must be recorded in the
 * append-only audit log, reusing `services/tenant`'s BAC-8
 * `@Audited(...)`/`AuditLogInterceptor` mechanism (duplicated here, not
 * literally imported -- see `audit-log.interceptor.ts`'s doc comment).
 * Generic across POST/PUT/PATCH/DELETE -- `AuditLogInterceptor` derives the
 * semantic action from the request's HTTP method, not from this decorator.
 */
export function Audited(
  resourceType: string,
  options: AuditedOptions = {},
): MethodDecorator {
  const metadata: AuditedMetadata = { resourceType, options };
  return SetMetadata(AUDITED_METADATA_KEY, metadata);
}
