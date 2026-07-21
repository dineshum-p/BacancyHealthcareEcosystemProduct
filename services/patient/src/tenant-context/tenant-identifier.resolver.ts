import { TENANT_ID_HEADER } from './tenant-context.constants';
import { RequestWithTenant } from './request-with-tenant.interface';

/**
 * Resolves the raw tenant identifier a request is claiming: an
 * `X-Tenant-Id` header takes priority; next, a `:tenantSlug` route param
 * (BAC-36: `POST /public/tenants/:tenantSlug/patients` has no
 * `X-Tenant-Id` header to read -- there is no authenticated session at all
 * on that public route, so the tenant must be resolved from the URL itself);
 * finally, falling back to the first label of the Host header when it looks
 * like a tenant subdomain (e.g. `acme.app.example.com` -> `acme`). Mirrors
 * `services/tenant`'s resolver (BAC-4), extended with the route-param
 * fallback. Returns null when none of these sources yields a usable
 * identifier.
 */
export function resolveTenantIdentifier(
  request: RequestWithTenant,
): string | null {
  const headerValue = request.headers[TENANT_ID_HEADER];
  const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (header && header.trim().length > 0) {
    return header.trim();
  }

  const params = request.params as Record<string, string> | undefined;
  const tenantSlugParam = params?.tenantSlug;
  if (tenantSlugParam && tenantSlugParam.trim().length > 0) {
    return tenantSlugParam.trim();
  }

  const host = request.headers.host;
  return extractSubdomainSlug(host);
}

function extractSubdomainSlug(host: string | undefined): string | null {
  if (!host) {
    return null;
  }
  const hostname = host.split(':')[0];
  const labels = hostname.split('.');
  // Require at least 3 labels (e.g. "acme.example.com") so bare hosts like
  // "localhost" or "example.com" are not mistaken for a tenant subdomain.
  if (labels.length < 3) {
    return null;
  }
  return labels[0];
}
