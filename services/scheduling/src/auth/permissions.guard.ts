import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA_KEY } from './permissions.decorator';
import { Permission } from './permission.enum';
import { UserRole } from './user-role.enum';
import { roleHasPermission } from './role-permissions.map';
import { RequestWithAuth } from './request-with-auth.interface';

/**
 * Authorization guard (BAC-16), reusing `services/auth`'s BAC-7
 * `PermissionsGuard` mechanism verbatim (this service cannot import that
 * TypeScript directly -- independently deployable services -- so it is
 * duplicated here, same as `AccessTokenGuard`/`TenantGuard`): reads the
 * `role` claim from the already-validated access token (`request.user`, set
 * by `AccessTokenGuard`) and checks it against `@RequirePermissions(...)`'s
 * declared permission(s) via `ROLE_PERMISSIONS`. Does NOT verify the JWT
 * itself -- that is `AccessTokenGuard`'s job; this guard must always run
 * AFTER it (`@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)`).
 *
 * A role lacking a required permission gets 403 (`ForbiddenException`), not
 * 401: the caller IS authenticated (a valid access token), they are simply
 * not authorized for this action.
 *
 * This guard only enforces coarse, ROLE-level RBAC. The finer,
 * INSTANCE-level rule this ticket also requires (a `provider` may only
 * act on THEIR OWN calendar) cannot be expressed here -- see
 * `provider-scope.util.ts` for where that is enforced instead.
 *
 * A route with no `@RequirePermissions(...)` metadata requires nothing
 * beyond authentication and is allowed through unconditionally.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_METADATA_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.user) {
      throw new Error(
        'request.user was not set -- protect this route with AccessTokenGuard before PermissionsGuard.',
      );
    }

    // `request.user.role` is typed against `@hep/shared-types`' plain
    // string-literal `UserRole` union (the FE/BE-shared contract type), not
    // this service's own `UserRole` enum -- same cast pattern every other
    // service's `PermissionsGuard` uses.
    const role = request.user.role as UserRole;
    const hasEveryRequiredPermission = requiredPermissions.every((permission) =>
      roleHasPermission(role, permission),
    );

    if (!hasEveryRequiredPermission) {
      throw new ForbiddenException(
        'Your role does not have permission to perform this action.',
      );
    }

    return true;
  }
}
