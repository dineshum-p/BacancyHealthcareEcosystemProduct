import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission.enum';

export const PERMISSIONS_METADATA_KEY = 'bac14:requiredPermissions';

/**
 * Declares the permission(s) `PermissionsGuard` requires the caller's role
 * to hold, e.g. `@RequirePermissions(Permission.WRITE_PATIENT)`. Compose
 * with `AccessTokenGuard` (which must run first so `request.user.role` is
 * already populated) -- this decorator alone does not authenticate anyone.
 * Mirrors `services/auth`'s BAC-7, `services/emr`'s BAC-10, and
 * `services/billing`'s BAC-11 `@RequirePermissions` mechanism exactly.
 */
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
