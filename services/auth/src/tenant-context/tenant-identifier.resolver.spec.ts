import { resolveTenantIdentifier } from './tenant-identifier.resolver';
import { RequestWithTenant } from './request-with-tenant.interface';

describe('resolveTenantIdentifier', () => {
  it('returns the trimmed X-Tenant-Id header value', () => {
    const request = {
      headers: { 'x-tenant-id': '  acme  ' },
    } as unknown as RequestWithTenant;

    expect(resolveTenantIdentifier(request)).toBe('acme');
  });

  it('takes the first value when the header is duplicated', () => {
    const request = {
      headers: { 'x-tenant-id': ['acme', 'other'] },
    } as unknown as RequestWithTenant;

    expect(resolveTenantIdentifier(request)).toBe('acme');
  });

  it('returns null when the header is absent', () => {
    const request = { headers: {} } as unknown as RequestWithTenant;
    expect(resolveTenantIdentifier(request)).toBeNull();
  });

  it('returns null when the header is blank', () => {
    const request = {
      headers: { 'x-tenant-id': '   ' },
    } as unknown as RequestWithTenant;
    expect(resolveTenantIdentifier(request)).toBeNull();
  });

  it('does not fall back to a subdomain (deliberately not supported here)', () => {
    const request = {
      headers: { host: 'acme.app.example.com' },
    } as unknown as RequestWithTenant;
    expect(resolveTenantIdentifier(request)).toBeNull();
  });
});
