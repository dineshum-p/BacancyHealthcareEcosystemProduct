import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard';
import { AccessTokenService } from './access-token.service';
import { RequestWithAuth } from './request-with-auth.interface';
import { TenantStatus } from '../tenants/tenant-status.enum';

function makeContext(request: Partial<RequestWithAuth>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const TENANT = {
  id: 't1',
  slug: 'acme',
  status: TenantStatus.ACTIVE,
  schemaName: 'acme',
  name: 'Acme',
  plan: 'starter',
  ownerEmail: null,
};

describe('AccessTokenGuard', () => {
  function makeGuard(verify: AccessTokenService['verify']): AccessTokenGuard {
    const service = { verify } as unknown as AccessTokenService;
    return new AccessTokenGuard(service);
  }

  it('throws 401 when the Authorization header is missing', () => {
    const guard = makeGuard(jest.fn());
    const context = makeContext({ headers: {}, tenant: TENANT });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws 401 when the Authorization header is malformed', () => {
    const guard = makeGuard(jest.fn());
    const context = makeContext({
      headers: { authorization: 'NotBearer abc' },
      tenant: TENANT,
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws 401 when TenantGuard has not resolved a tenant yet', () => {
    const guard = makeGuard(jest.fn());
    const context = makeContext({
      headers: { authorization: 'Bearer sometoken' },
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws 401 when the token is invalid', () => {
    const guard = makeGuard(
      jest.fn().mockImplementation(() => {
        throw new Error('bad token');
      }),
    );
    const context = makeContext({
      headers: { authorization: 'Bearer bad' },
      tenant: TENANT,
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws 401 when the token was issued for a different tenant', () => {
    const guard = makeGuard(
      jest
        .fn()
        .mockReturnValue({ userId: 'u1', tenantId: 'other', role: 'staff' }),
    );
    const context = makeContext({
      headers: { authorization: 'Bearer good' },
      tenant: TENANT,
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('attaches the verified user and returns true for a valid, matching token', () => {
    const guard = makeGuard(
      jest
        .fn()
        .mockReturnValue({ userId: 'u1', tenantId: 't1', role: 'staff' }),
    );
    const request: Partial<RequestWithAuth> = {
      headers: { authorization: 'Bearer good' },
      tenant: TENANT,
    };
    const context = makeContext(request);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual({
      userId: 'u1',
      tenantId: 't1',
      role: 'staff',
    });
  });
});
