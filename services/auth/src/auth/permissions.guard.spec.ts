import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_METADATA_KEY } from './permissions.decorator';
import { Permission } from './permission.enum';
import { UserRole } from './user-role.enum';
import { RequestWithAuth } from './request-with-auth.interface';

function makeContext(request: Partial<RequestWithAuth>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  function makeReflector(
    requiredPermissions: Permission[] | undefined,
  ): jest.Mocked<Reflector> {
    return {
      getAllAndOverride: jest.fn().mockReturnValue(requiredPermissions),
    } as unknown as jest.Mocked<Reflector>;
  }

  it('allows the request through when no @RequirePermissions metadata is present (nothing required)', () => {
    const reflector = makeReflector(undefined);
    const guard = new PermissionsGuard(reflector);
    const request: Partial<RequestWithAuth> = {
      user: { userId: 'u1', tenantId: 't1', role: UserRole.STAFF },
    };

    expect(guard.canActivate(makeContext(request))).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      PERMISSIONS_METADATA_KEY,
      expect.any(Array),
    );
  });

  it('allows the request through when the required permissions array is empty', () => {
    const reflector = makeReflector([]);
    const guard = new PermissionsGuard(reflector);
    const request: Partial<RequestWithAuth> = {
      user: { userId: 'u1', tenantId: 't1', role: UserRole.STAFF },
    };

    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it('allows a role that holds the required permission through (AC3)', () => {
    const reflector = makeReflector([Permission.MANAGE_USER_ROLES]);
    const guard = new PermissionsGuard(reflector);
    const request: Partial<RequestWithAuth> = {
      user: { userId: 'admin-1', tenantId: 't1', role: UserRole.SUPER_ADMIN },
    };

    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it('rejects a role lacking the required permission with 403, not 401 (AC2)', () => {
    const reflector = makeReflector([Permission.MANAGE_USER_ROLES]);
    const guard = new PermissionsGuard(reflector);
    const request: Partial<RequestWithAuth> = {
      user: { userId: 'staff-1', tenantId: 't1', role: UserRole.STAFF },
    };

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      ForbiddenException,
    );
  });

  it('requires ALL declared permissions, not just one, to pass', () => {
    const reflector = makeReflector([
      Permission.MANAGE_USER_ROLES,
      Permission.VIEW_USERS,
    ]);
    const guard = new PermissionsGuard(reflector);
    // provider only has VIEW_USERS, not MANAGE_USER_ROLES
    const request: Partial<RequestWithAuth> = {
      user: { userId: 'p1', tenantId: 't1', role: UserRole.PROVIDER },
    };

    expect(() => guard.canActivate(makeContext(request))).toThrow(
      ForbiddenException,
    );
  });

  it('throws if request.user is missing (must be composed AFTER AccessTokenGuard)', () => {
    const reflector = makeReflector([Permission.MANAGE_USER_ROLES]);
    const guard = new PermissionsGuard(reflector);
    const request: Partial<RequestWithAuth> = {};

    expect(() => guard.canActivate(makeContext(request))).toThrow();
  });
});
