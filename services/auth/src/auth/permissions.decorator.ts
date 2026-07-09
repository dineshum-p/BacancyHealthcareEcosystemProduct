import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission.enum';

export const PERMISSIONS_METADATA_KEY = 'bac7:requiredPermissions';

/**
 * Declares the permission(s) `PermissionsGuard` requires the caller's role
 * to hold, e.g. `@RequirePermissions(Permission.MANAGE_USER_ROLES)`. Compose
 * with `AccessTokenGuard` (which must run first so `request.user.role` is
 * already populated) -- this decorator alone does not authenticate anyone.
 */
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
