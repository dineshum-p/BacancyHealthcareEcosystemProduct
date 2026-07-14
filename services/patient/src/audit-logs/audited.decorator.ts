import { SetMetadata } from '@nestjs/common';
import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';

export const AUDITED_METADATA_KEY = 'bac14:audited';

/**
 * Options for `@Audited(...)`, mirroring `services/tenant`'s BAC-8 (and
 * `services/emr`'s BAC-10/`services/billing`'s BAC-11) mechanism exactly.
 * `resolveBefore` is the contract point a future PUT/PATCH/DELETE handler
 * would need; `POST /patients` (this ticket's only mutation) is a creation,
 * which has no "before" state by definition, so it does not supply one.
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
