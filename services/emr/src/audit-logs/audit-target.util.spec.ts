import { TenantStatus } from '../tenants/tenant-status.enum';
import {
  extractResourceId,
  resolveAuditAction,
  resolveAuditTarget,
} from './audit-target.util';
import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';

describe('resolveAuditAction', () => {
  it.each([
    ['POST', 'create'],
    ['PUT', 'update'],
    ['PATCH', 'update'],
    ['DELETE', 'delete'],
    ['GET', 'get'],
  ])('maps HTTP method %s to action %s', (method, expected) => {
    expect(resolveAuditAction(method)).toBe(expected);
  });

  it('lower-cases an unrecognized method rather than throwing', () => {
    expect(resolveAuditAction('OPTIONS')).toBe('options');
  });
});

describe('resolveAuditTarget', () => {
  const tenant = {
    id: 'tenant-1',
    slug: 'acme',
    name: 'Acme',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
    ownerEmail: 'owner@example.com',
  };

  it('uses request.tenant when TenantGuard already resolved one', () => {
    const request = { tenant } as unknown as RequestWithTenant;

    expect(resolveAuditTarget(request)).toEqual({
      tenantId: 'tenant-1',
      schemaName: 'tenant_acme',
    });
  });

  it('returns null when request.tenant was never resolved', () => {
    const request = {} as unknown as RequestWithTenant;

    expect(resolveAuditTarget(request)).toBeNull();
  });
});

describe('extractResourceId', () => {
  it('extracts a string id from the after payload', () => {
    const request = {} as unknown as RequestWithTenant;
    expect(extractResourceId({ id: 'patient-1' }, request)).toBe('patient-1');
  });

  it('falls back to request.params.id when the after payload has no id', () => {
    const request = {
      params: { id: 'from-params' },
    } as unknown as RequestWithTenant;
    expect(extractResourceId(null, request)).toBe('from-params');
  });

  it('returns null when nothing identifies the resource', () => {
    const request = {} as unknown as RequestWithTenant;
    expect(extractResourceId(null, request)).toBeNull();
    expect(extractResourceId(undefined, request)).toBeNull();
    expect(extractResourceId({ name: 'no id here' }, request)).toBeNull();
  });
});
