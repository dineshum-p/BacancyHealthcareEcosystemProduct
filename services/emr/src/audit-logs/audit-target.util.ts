import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';

/**
 * Semantic action name derived from the HTTP method, mirroring
 * `services/tenant`'s BAC-8 `resolveAuditAction` exactly: records the
 * semantic name (e.g. `'create'` instead of `'POST'`) so a future
 * PUT/PATCH/DELETE audit entry on `/fhir/Patient/:id` reads the same way
 * regardless of which verb a given API design chose for "update".
 */
export function resolveAuditAction(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return method.toLowerCase();
  }
}

export interface AuditTarget {
  tenantId: string;
  schemaName: string;
}

/**
 * Resolves WHICH tenant schema an audit entry belongs in. Simpler than
 * `services/tenant`'s BAC-8 version: every `/fhir/*` route in this service
 * is guarded by `TenantGuard` (BAC-10, AC4), so `request.tenant` is always
 * resolved by the time `AuditLogInterceptor` runs (there is no
 * pre-tenant-resolution route analogous to `services/tenant`'s
 * `POST /tenants`). Kept as a small resolver function (not inlined into the
 * interceptor) for parity with that mechanism and so a future non-tenant
 * -scoped `/fhir/*` route doesn't have to change the interceptor itself.
 */
export function resolveAuditTarget(
  request: RequestWithTenant,
): AuditTarget | null {
  if (request.tenant) {
    return {
      tenantId: request.tenant.id,
      schemaName: request.tenant.schemaName,
    };
  }
  return null;
}

/**
 * Resolves the mutated resource's id for the audit entry: prefers the FHIR
 * resource's own `id` field on the response body, falling back to a `:id`
 * route param -- the shape a future PUT/PATCH/DELETE handler's request
 * would carry it in.
 */
export function extractResourceId(
  after: unknown,
  request: RequestWithTenant,
): string | null {
  if (typeof after === 'object' && after !== null && 'id' in after) {
    const id = (after as Record<string, unknown>).id;
    if (typeof id === 'string' || typeof id === 'number') {
      return String(id);
    }
  }
  const paramsId = (request.params as Record<string, string> | undefined)?.id;
  return paramsId ?? null;
}
