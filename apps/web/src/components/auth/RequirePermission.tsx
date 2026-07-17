"use client";

import type { ReactNode } from "react";
import type { Permission } from "@hep/shared-types";
import { useCurrentUser } from "@/src/lib/auth/useCurrentUser";
import { roleHasPermission } from "@/src/lib/auth/rolePermissions";
import { ForbiddenView } from "./ForbiddenView";

export interface RequirePermissionProps {
  permission: Permission;
  children: ReactNode;
}

/**
 * Client-side route/component gate analogous to {@link RequireRole}, but
 * keyed on an RBAC *permission* (BAC-17, AC4) rather than a fixed role list --
 * needed here because which roles may register vs. only search patients is a
 * permission-set decision (`services/patient`'s `ROLE_PERMISSIONS`), not a
 * single allow-list. Renders nothing while the current user is still
 * resolving (avoids a flash of protected content), `children` once the
 * caller's role holds `permission`, and {@link ForbiddenView} otherwise --
 * both for a role lacking the permission AND for no signed-in user at all.
 * This is a UX convenience only: every real enforcement happens server-side
 * (`services/patient`'s `PermissionsGuard`, which independently 403s), so
 * there is no way to forge a permission here that would grant real access.
 */
export function RequirePermission({
  permission,
  children,
}: RequirePermissionProps) {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return null;
  }

  if (!user || !roleHasPermission(user.role, permission)) {
    return <ForbiddenView />;
  }

  return <>{children}</>;
}
