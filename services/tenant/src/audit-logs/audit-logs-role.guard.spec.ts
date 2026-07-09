import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuditLogsRoleGuard } from './audit-logs-role.guard';
import { RequestWithAuth } from '../auth/request-with-auth.interface';

function makeContext(request: Partial<RequestWithAuth>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuditLogsRoleGuard', () => {
  const guard = new AuditLogsRoleGuard();

  it('allows super_admin through', () => {
    const request: Partial<RequestWithAuth> = {
      user: { userId: 'u1', tenantId: 't1', role: 'super_admin' },
    };
    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it('allows clinic_admin through', () => {
    const request: Partial<RequestWithAuth> = {
      user: { userId: 'u1', tenantId: 't1', role: 'clinic_admin' },
    };
    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it.each(['provider', 'staff'])(
    'rejects role %s with 403, not 401 (AC7)',
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
