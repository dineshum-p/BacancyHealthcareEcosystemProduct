import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';
import { RequestWithAuth } from '../auth/request-with-auth.interface';

function makeContext(request: Partial<RequestWithAuth>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('allows super_admin through', () => {
    const request: Partial<RequestWithAuth> = {
      user: { userId: 'u1', tenantId: 't1', role: 'super_admin' },
    };
    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it.each(['clinic_admin', 'provider', 'staff'])(
    'rejects role %s with 403, not 401 (AC4)',
    (role) => {
      const request: Partial<RequestWithAuth> = {
        user: { userId: 'u1', tenantId: 't1', role: role as never },
      };
      expect(() => guard.canActivate(makeContext(request))).toThrow(
        ForbiddenException,
      );
    },
  );

  it('throws if request.user is missing (must be composed AFTER AccessTokenGuard)', () => {
    const request: Partial<RequestWithAuth> = {};
    expect(() => guard.canActivate(makeContext(request))).toThrow();
  });
});
