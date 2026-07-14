import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestWithAuth } from '../auth/request-with-auth.interface';

/**
 * Restricts the Super Admin console's endpoints (BAC-12, AC4) --
 * `GET /tenants` and `POST /tenants/onboard` -- to callers whose access
 * token carries `role: 'super_admin'`. Deliberately a single-purpose,
 * hardcoded-to-this-role guard, NOT `services/auth`'s general-purpose
 * `PermissionsGuard`/permission-catalog machinery (that lives in a
 * different deployable service) -- same scoping call `AuditLogsRoleGuard`
 * already made for this service's audit-log routes (BAC-8); see that
 * guard's doc comment for the full reasoning.
 *
 * Must run AFTER `AccessTokenGuard` (`@UseGuards(TenantGuard,
 * AccessTokenGuard, SuperAdminGuard)`) so `request.user.role` is already
 * populated. A non-`super_admin` role gets 403, not 401: the caller IS
 * authenticated, they are simply not authorized for this console (AC4).
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.user) {
      throw new Error(
        'request.user was not set -- protect this route with AccessTokenGuard before SuperAdminGuard.',
      );
    }

    if (request.user.role !== 'super_admin') {
      throw new ForbiddenException(
        'Only super_admin may access the Super Admin console.',
      );
    }

    return true;
  }
}
