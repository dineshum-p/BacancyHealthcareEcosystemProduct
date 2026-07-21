import {
  extractResourceId,
  resolveAuditAction,
  resolveAuditTarget,
} from './audit-target.util';
import { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { TenantStatus } from '../tenants/tenant-status.enum';

describe('resolveAuditAction', () => {
  it.each([
    ['POST', 'create'],
    ['PUT', 'update'],
    ['PATCH', 'update'],
    ['DELETE', 'delete'],
    ['get', 'get'],
  ])('maps %s to %s', (method, expected) => {
    expect(resolveAuditAction(method)).toBe(expected);
  });
});

describe('resolveAuditTarget', () => {
  it('returns the tenant id/schema when request.tenant is set', () => {
    const request = {
      tenant: {
        id: 't1',
        schemaName: 'acme',
        slug: 'acme',
        status: TenantStatus.ACTIVE,
        name: 'Acme',
        plan: 'starter',
        ownerEmail: null,
      },
    } as unknown as RequestWithTenant;

    expect(resolveAuditTarget(request)).toEqual({
      tenantId: 't1',
      schemaName: 'acme',
    });
  });

  it('returns null when request.tenant is unset', () => {
    const request = {} as RequestWithTenant;
    expect(resolveAuditTarget(request)).toBeNull();
  });
});

describe('extractResourceId', () => {
  it('prefers the id on the response body', () => {
    const request = {
      params: { id: 'route-id' },
    } as unknown as RequestWithTenant;
    expect(extractResourceId({ id: 'body-id' }, request)).toBe('body-id');
  });

  it('falls back to the route param when the body has no id', () => {
    const request = {
      params: { id: 'route-id' },
    } as unknown as RequestWithTenant;
    expect(extractResourceId({}, request)).toBe('route-id');
  });

  it('returns null when neither is available', () => {
    const request = {} as unknown as RequestWithTenant;
    expect(extractResourceId(null, request)).toBeNull();
  });

  it('coerces a numeric id to a string', () => {
    const request = {} as unknown as RequestWithTenant;
    expect(extractResourceId({ id: 42 }, request)).toBe('42');
  });
});
