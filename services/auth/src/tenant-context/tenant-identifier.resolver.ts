import { TENANT_ID_HEADER } from './tenant-context.constants';
import { RequestWithTenant } from './request-with-tenant.interface';

/**
 * Resolves the raw tenant identifier a request is claiming: the
 * `X-Tenant-Id` header. BAC-4 also supports a subdomain fallback; BAC-5's
 * scope explicitly calls the header "enough for this ticket, don't
 * over-build" for the auth surface, so that fallback is deliberately not
 * duplicated here. Returns null when the header is absent/blank.
 */
export function resolveTenantIdentifier(
  request: RequestWithTenant,
): string | null {
  const headerValue = request.headers[TENANT_ID_HEADER];
  const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (header && header.trim().length > 0) {
    return header.trim();
  }
  return null;
}
