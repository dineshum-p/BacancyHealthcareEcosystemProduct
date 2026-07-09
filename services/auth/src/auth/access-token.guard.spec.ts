import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard';
import { AccessTokenService } from './access-token.service';
import { UserRole } from './user-role.enum';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { RequestWithAuth } from './request-with-auth.interface';

function makeContext(request: RequestWithAuth): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

const tenant = {
  id: 'tenant-1',
  slug: 'acme',
  name: 'Acme Inc',
  plan: 'starter',
  status: TenantStatus.ACTIVE,
  schemaName: 'tenant_acme',
  ownerEmail: 'owner@example.com',
};

describe('AccessTokenGuard', () => {
  let accessTokenService: jest.Mocked<AccessTokenService>;
  let guard: AccessTokenGuard;

  beforeEach(() => {
    accessTokenService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<AccessTokenService>;
    guard = new AccessTokenGuard(accessTokenService);
  });

  it('rejects a request with no Authorization header', () => {
    const request = { headers: {}, tenant } as unknown as RequestWithAuth;

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a request whose Authorization header is not "Bearer <token>"', () => {
    const request = {
      headers: { authorization: 'Basic abc123' },
      tenant,
    } as unknown as RequestWithAuth;

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an invalid/expired access token', () => {
    accessTokenService.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const request = {
      headers: { authorization: 'Bearer bad-token' },
      tenant,
    } as unknown as RequestWithAuth;

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token whose tenantId does not match the resolved tenant', () => {
    accessTokenService.verify.mockReturnValue({
      userId: 'user-1',
      tenantId: 'a-different-tenant',
      role: UserRole.STAFF,
    });
    const request = {
      headers: { authorization: 'Bearer good-token' },
      tenant,
    } as unknown as RequestWithAuth;

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('attaches the verified payload to request.user and allows the request through', () => {
    accessTokenService.verify.mockReturnValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.STAFF,
    });
    const request = {
      headers: { authorization: 'Bearer good-token' },
      tenant,
    } as unknown as RequestWithAuth;

    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect(request.user).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.STAFF,
    });
  });

  it('requires TenantGuard to have run first (throws if request.tenant is missing)', () => {
    accessTokenService.verify.mockReturnValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: UserRole.STAFF,
    });
    const request = {
      headers: { authorization: 'Bearer good-token' },
    } as unknown as RequestWithAuth;

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      UnauthorizedException,
    );
  });
});
