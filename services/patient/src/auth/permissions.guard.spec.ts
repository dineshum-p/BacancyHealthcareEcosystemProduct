import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from './permission.enum';
import { RequirePermissions } from './permissions.decorator';
import { RequestWithAuth } from './request-with-auth.interface';

class FakeController {
  @RequirePermissions(Permission.WRITE_PATIENT)
  guarded(): void {}

  unguarded(): void {}
}

function makeContext(
  handlerName: keyof FakeController,
  request: Partial<RequestWithAuth>,
): ExecutionContext {
  const instance = new FakeController();
  return {
    getHandler: () => instance[handlerName],
    getClass: () => FakeController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('allows a route with no @RequirePermissions metadata through unconditionally', () => {
    const context = makeContext('unguarded', {});
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws if request.user is missing on a guarded route', () => {
    const context = makeContext('guarded', {});
    expect(() => guard.canActivate(context)).toThrow(
      /protect this route with AccessTokenGuard/,
    );
  });

  it('throws 403 when the role lacks the required permission', () => {
    const context = makeContext('guarded', {
      user: { userId: 'u1', tenantId: 't1', role: 'staff' },
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows a role with the required permission', () => {
    const context = makeContext('guarded', {
      user: { userId: 'u1', tenantId: 't1', role: 'clinic_admin' },
    });
    expect(guard.canActivate(context)).toBe(true);
  });
});
