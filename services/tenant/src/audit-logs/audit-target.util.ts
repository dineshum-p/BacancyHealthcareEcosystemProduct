import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';

/**
 * Semantic action name derived from the HTTP method (BAC-8, AC1: "action
 * (http method or a semantic action name, your call, document it)" -- this
 * service records the semantic name, e.g. `'create'` instead of `'POST'`,
 * so a future PUT/PATCH/DELETE audit entry reads the same way regardless of
 * which verb a given API design chose for "update").
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
 * Resolves WHICH tenant schema an audit entry belongs in (BAC-8, AC5/AC6).
 * Two cases, deliberately structural rather than hardcoded per resource
 * type (AC3):
 *
 *   1. `request.tenant` is already resolved (any route behind `TenantGuard`,
 *      e.g. `POST /items`) -- use it.
 *   2. No tenant is resolved yet (e.g. `POST /tenants`, which runs BEFORE a
 *      tenant identifier can be resolved -- see `TenantsController`'s doc
 *      comment), but the mutated resource ITSELF looks like a tenant (has
 *      `id`/`schemaName`) -- the tenant's very first audit entry documents
 *      its own creation, self-referentially, into the schema it just
 *      created.
 *
 * Returns `null` if neither applies (should not happen for any endpoint
 * `@Audited` is applied to today; callers must handle it rather than
 * silently dropping the mutation's audit trail).
 */
export function resolveAuditTarget(
  request: RequestWithTenant,
  after: unknown,
): AuditTarget | null {
  if (request.tenant) {
    return {
      tenantId: request.tenant.id,
      schemaName: request.tenant.schemaName,
    };
  }
  if (isTenantSchemaOwner(after)) {
    return { tenantId: after.id, schemaName: after.schemaName };
  }
  return null;
}

function isTenantSchemaOwner(
  value: unknown,
): value is { id: string; schemaName: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' && typeof candidate.schemaName === 'string'
  );
}

/**
 * Resolves the mutated resource's id for the audit entry: prefers an `id`
 * field on the response body (both `Tenant`/`TenantResponseDto` and `Item`
 * already expose one); BAC-12's `POST /tenants/onboard` response is a
 * compound orchestration result (`{ tenant, adminSeed, invite }`, not a bare
 * resource), so a nested `tenant.id` is checked next -- a structural rule
 * (any response shaped like `{ tenant: { id } }`), not a hardcoded special
 * case for this one route, so a future compound-response endpoint gets the
 * same behavior for free. Falls back to a `:id` route param -- the shape a
 * future PUT/PATCH/DELETE handler's request would carry it in.
 */
export function extractResourceId(
  after: unknown,
  request: RequestWithTenant,
): string | null {
  if (typeof after === 'object' && after !== null) {
    const candidate = after as Record<string, unknown>;
    if ('id' in candidate) {
      const id = candidate.id;
      if (typeof id === 'string' || typeof id === 'number') {
        return String(id);
      }
    }
    if (typeof candidate.tenant === 'object' && candidate.tenant !== null) {
      const nestedId = (candidate.tenant as Record<string, unknown>).id;
      if (typeof nestedId === 'string' || typeof nestedId === 'number') {
        return String(nestedId);
      }
    }
  }
  const paramsId = (request.params as Record<string, string> | undefined)?.id;
  return paramsId ?? null;
}
