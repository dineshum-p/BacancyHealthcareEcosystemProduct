import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission.enum';

export const PERMISSIONS_METADATA_KEY = 'bac11:requiredPermissions';

/**
 * Declares the permission(s) `PermissionsGuard` requires the caller's role
 * to hold, e.g. `@RequirePermissions(Permission.RECORD_USAGE)`. Compose
 * with `AccessTokenGuard` (which must run first so `request.user.role` is
 * already populated) -- this decorator alone does not authenticate anyone.
 * Mirrors `services/auth`'s BAC-7 and `services/emr`'s BAC-10
 * `@RequirePermissions` mechanism exactly.
 */
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
