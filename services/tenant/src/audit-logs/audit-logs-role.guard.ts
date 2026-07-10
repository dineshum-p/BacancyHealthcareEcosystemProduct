import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestWithAuth } from '../auth/request-with-auth.interface';

const ALLOWED_ROLES = new Set(['super_admin', 'clinic_admin']);

/**
 * Restricts `GET /audit-logs` to `super_admin`/`clinic_admin` (BAC-8, AC3).
 * Deliberately a single-purpose, hardcoded-to-this-endpoint guard -- NOT a
 * second, general-purpose RBAC/permission-catalog system like
 * `services/auth`'s `PermissionsGuard`/`@RequirePermissions` (BAC-7). That
 * machinery lives in a different deployable service and models an open-
 * ended permission catalog across many routes; this guard only ever answers
 * one question for one route, so a plain role check is the appropriately
 * -scoped choice here (see BAC-8's ticket notes).
 *
 * Must run AFTER `AccessTokenGuard` (`@UseGuards(TenantGuard,
 * AccessTokenGuard, AuditLogsRoleGuard)`) so `request.user.role` is already
 * populated -- same guard-ordering discipline as BAC-7's `PermissionsGuard`.
 * A role outside the allow-list gets 403, not 401: the caller IS
 * authenticated, they are simply not authorized to read audit logs.
 */
@Injectable()
export class AuditLogsRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.user) {
      throw new Error(
        'request.user was not set -- protect this route with AccessTokenGuard before AuditLogsRoleGuard.',
      );
    }

    if (!ALLOWED_ROLES.has(request.user.role)) {
      throw new ForbiddenException(
        'Only super_admin/clinic_admin may read audit logs.',
      );
    }

    return true;
  }
}
