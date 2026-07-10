import { resolveTenantIdentifier } from './tenant-identifier.resolver';
import { RequestWithTenant } from './request-with-tenant.interface';

function makeRequest(
  headers: Record<string, string | string[] | undefined>,
): RequestWithTenant {
  return { headers } as unknown as RequestWithTenant;
}

describe('resolveTenantIdentifier', () => {
  it('prefers the X-Tenant-Id header when present', () => {
    const req = makeRequest({
      'x-tenant-id': 'tenant-a',
      host: 'acme.app.example.com',
    });
    expect(resolveTenantIdentifier(req)).toBe('tenant-a');
  });

  it('trims whitespace on the header value', () => {
    const req = makeRequest({ 'x-tenant-id': '  tenant-a  ' });
    expect(resolveTenantIdentifier(req)).toBe('tenant-a');
  });

  it('takes the first value when the header is duplicated', () => {
    const req = makeRequest({ 'x-tenant-id': ['tenant-a', 'tenant-b'] });
    expect(resolveTenantIdentifier(req)).toBe('tenant-a');
  });

  it('falls back to the subdomain slug when no header is present', () => {
    const req = makeRequest({ host: 'acme.app.example.com' });
    expect(resolveTenantIdentifier(req)).toBe('acme');
  });

  it('ignores bare hosts that are not tenant subdomains', () => {
    expect(
      resolveTenantIdentifier(makeRequest({ host: 'localhost:3000' })),
    ).toBeNull();
    expect(
      resolveTenantIdentifier(makeRequest({ host: 'example.com' })),
    ).toBeNull();
  });

  it('returns null when the header is blank and no host is set', () => {
    expect(
      resolveTenantIdentifier(makeRequest({ 'x-tenant-id': '   ' })),
    ).toBeNull();
  });

  it('returns null when nothing resolves', () => {
    expect(resolveTenantIdentifier(makeRequest({}))).toBeNull();
  });
});
