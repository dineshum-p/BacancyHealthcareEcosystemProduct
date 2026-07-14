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
    adminSeedStatus: null,
    inviteStatus: null,
  };

  it('uses request.tenant when TenantGuard already resolved one (e.g. POST /items)', () => {
    const request = { tenant } as unknown as RequestWithTenant;

    expect(resolveAuditTarget(request, { id: 1, name: 'widget' })).toEqual({
      tenantId: 'tenant-1',
      schemaName: 'tenant_acme',
    });
  });

  it('falls back to the mutated resource itself when it IS a tenant (POST /tenants creates its own schema)', () => {
    const request = {} as unknown as RequestWithTenant;
    const after = { id: 'tenant-2', schemaName: 'tenant_beta' };

    expect(resolveAuditTarget(request, after)).toEqual({
      tenantId: 'tenant-2',
      schemaName: 'tenant_beta',
    });
  });

  it('returns null when neither request.tenant nor the mutated resource identify a schema', () => {
    const request = {} as unknown as RequestWithTenant;

    expect(resolveAuditTarget(request, { id: 1, name: 'widget' })).toBeNull();
  });

  it('prefers request.tenant over the response body even if the response body looks tenant-shaped', () => {
    const request = { tenant } as unknown as RequestWithTenant;
    const after = { id: 'unrelated', schemaName: 'unrelated_schema' };

    expect(resolveAuditTarget(request, after)).toEqual({
      tenantId: 'tenant-1',
      schemaName: 'tenant_acme',
    });
  });
});

describe('extractResourceId', () => {
  it('extracts a string id from the after payload', () => {
    const request = {} as unknown as RequestWithTenant;
    expect(extractResourceId({ id: 'tenant-1' }, request)).toBe('tenant-1');
  });

  it('extracts a numeric id from the after payload, stringified', () => {
    const request = {} as unknown as RequestWithTenant;
    expect(extractResourceId({ id: 1, name: 'widget' }, request)).toBe('1');
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

  it('falls back to a nested tenant.id for a compound orchestration response (BAC-12, POST /tenants/onboard)', () => {
    const request = {} as unknown as RequestWithTenant;
    const after = {
      tenant: { id: 'tenant-3', slug: 'gamma' },
      adminSeed: { status: 'succeeded' },
      invite: { status: 'succeeded' },
    };
    expect(extractResourceId(after, request)).toBe('tenant-3');
  });

  it('prefers a top-level id over a nested tenant.id when both are present', () => {
    const request = {} as unknown as RequestWithTenant;
    const after = { id: 'top-level', tenant: { id: 'nested' } };
    expect(extractResourceId(after, request)).toBe('top-level');
  });
});
