import { TENANT_ID_HEADER } from './tenant-context.constants';
import { RequestWithTenant } from './request-with-tenant.interface';

/**
 * Resolves the raw tenant identifier a request is claiming, per AC1:
 * an `X-Tenant-Id` header takes priority, falling back to the first label
 * of the Host header when it looks like a tenant subdomain
 * (e.g. `acme.app.example.com` -> `acme`). Returns null when neither source
 * yields a usable identifier.
 */
export function resolveTenantIdentifier(
  request: RequestWithTenant,
): string | null {
  const headerValue = request.headers[TENANT_ID_HEADER];
  const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (header && header.trim().length > 0) {
    return header.trim();
  }

  const host = request.headers.host;
  const subdomain = extractSubdomainSlug(host);
  return subdomain;
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
