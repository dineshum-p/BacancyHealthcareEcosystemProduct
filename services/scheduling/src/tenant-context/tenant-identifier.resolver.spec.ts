import { resolveTenantIdentifier } from './tenant-identifier.resolver';
import { RequestWithTenant } from './request-with-tenant.interface';

function makeRequest(
  headers: Record<string, string | string[] | undefined>,
): RequestWithTenant {
  return { headers } as unknown as RequestWithTenant;
}

describe('resolveTenantIdentifier', () => {
  it('prefers the X-Tenant-Id header', () => {
    const request = makeRequest({
      'x-tenant-id': 'acme',
      host: 'other.example.com',
    });
    expect(resolveTenantIdentifier(request)).toBe('acme');
  });

  it('trims whitespace from the header value', () => {
    const request = makeRequest({ 'x-tenant-id': '  acme  ' });
    expect(resolveTenantIdentifier(request)).toBe('acme');
  });

  it('takes the first value when the header is repeated', () => {
    const request = makeRequest({ 'x-tenant-id': ['acme', 'globex'] });
    expect(resolveTenantIdentifier(request)).toBe('acme');
  });

  it('falls back to a subdomain when no header is present', () => {
    const request = makeRequest({ host: 'acme.app.example.com' });
    expect(resolveTenantIdentifier(request)).toBe('acme');
  });

  it('ignores a bare host with too few labels', () => {
    const request = makeRequest({ host: 'localhost:3000' });
    expect(resolveTenantIdentifier(request)).toBeNull();
  });

  it('returns null when neither a header nor a usable host is present', () => {
    const request = makeRequest({});
    expect(resolveTenantIdentifier(request)).toBeNull();
  });

  it('returns null for a blank header value with no usable host', () => {
    const request = makeRequest({ 'x-tenant-id': '   ' });
    expect(resolveTenantIdentifier(request)).toBeNull();
  });
});
