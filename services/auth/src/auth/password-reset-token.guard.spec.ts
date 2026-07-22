import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PasswordResetTokenGuard } from './password-reset-token.guard';
import { PasswordResetTokenService } from './password-reset-token.service';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { RequestWithPasswordResetAuth } from './request-with-password-reset-auth.interface';

function makeContext(request: RequestWithPasswordResetAuth): ExecutionContext {
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

describe('PasswordResetTokenGuard', () => {
  let passwordResetTokenService: jest.Mocked<PasswordResetTokenService>;
  let guard: PasswordResetTokenGuard;

  beforeEach(() => {
    passwordResetTokenService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<PasswordResetTokenService>;
    guard = new PasswordResetTokenGuard(passwordResetTokenService);
  });

  it('rejects a request with no Authorization header', () => {
    const request = {
      headers: {},
      tenant,
    } as unknown as RequestWithPasswordResetAuth;

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a request whose Authorization header is not "Bearer <token>"', () => {
    const request = {
      headers: { authorization: 'Basic abc123' },
      tenant,
    } as unknown as RequestWithPasswordResetAuth;

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an invalid/expired password-reset token', () => {
    passwordResetTokenService.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const request = {
      headers: { authorization: 'Bearer bad-token' },
      tenant,
    } as unknown as RequestWithPasswordResetAuth;

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  /**
   * BAC-49 BLOCKER fix: proves a NORMAL `AccessTokenPayload`-shaped JWT
   * (i.e. anything `AccessTokenService.sign` would have produced) is
   * rejected here too -- `verify()` throwing (a different secret/no
   * `purpose` claim) is exactly what makes this guard reject any token
   * other than one `PasswordResetTokenService` itself minted.
   */
  it('rejects a token that is not a password-reset token', () => {
    passwordResetTokenService.verify.mockImplementation(() => {
      throw new Error('Not a password-reset token.');
    });
    const request = {
      headers: { authorization: 'Bearer some.other.token' },
      tenant,
    } as unknown as RequestWithPasswordResetAuth;

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token whose tenantId does not match the resolved tenant', () => {
    passwordResetTokenService.verify.mockReturnValue({
      userId: 'user-1',
      tenantId: 'a-different-tenant',
      purpose: 'password-reset-required',
    });
    const request = {
      headers: { authorization: 'Bearer good-token' },
      tenant,
    } as unknown as RequestWithPasswordResetAuth;

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('attaches the verified payload to request.user and allows the request through', () => {
    passwordResetTokenService.verify.mockReturnValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      purpose: 'password-reset-required',
    });
    const request = {
      headers: { authorization: 'Bearer good-token' },
      tenant,
    } as unknown as RequestWithPasswordResetAuth;

    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect(request.user).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      purpose: 'password-reset-required',
    });
  });

  it('requires TenantGuard to have run first (throws if request.tenant is missing)', () => {
    passwordResetTokenService.verify.mockReturnValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      purpose: 'password-reset-required',
    });
    const request = {
      headers: { authorization: 'Bearer good-token' },
    } as unknown as RequestWithPasswordResetAuth;

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      UnauthorizedException,
    );
  });
});
