import { SetMetadata } from '@nestjs/common';
import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';

export const AUDITED_METADATA_KEY = 'bac8:audited';

/**
 * Options for `@Audited(...)` (BAC-8, AC4). `resolveBefore` is the contract
 * point a FUTURE PUT/PATCH/DELETE handler needs, not something this ticket
 * builds a real implementation for: `TenantsController.create()` and
 * `ItemsController.create()` are both creations, which have no "before"
 * state by definition, so neither supplies one today. When an update/delete
 * endpoint is added later, it can pass a `resolveBefore` that fetches the
 * current resource (by e.g. a route param) BEFORE the decorated handler
 * runs, without `AuditLogInterceptor` itself needing to change.
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
 * append-only audit log (BAC-8, AC1/AC3). Generic across POST/PUT/PATCH
 * /DELETE -- `AuditLogInterceptor` derives the semantic action from the
 * request's HTTP method, not from this decorator, so applying `@Audited(...)`
 * to a future PUT/PATCH/DELETE handler requires no interceptor changes.
 *
 * `resourceType` is a caller-chosen label (e.g. `'tenant'`, `'item'`) stored
 * verbatim on the audit entry and used to filter `GET /audit-logs`.
 */
export function Audited(
  resourceType: string,
  options: AuditedOptions = {},
): MethodDecorator {
  const metadata: AuditedMetadata = { resourceType, options };
  return SetMetadata(AUDITED_METADATA_KEY, metadata);
}
