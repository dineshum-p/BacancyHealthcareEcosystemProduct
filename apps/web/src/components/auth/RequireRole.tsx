"use client";

import type { ReactNode } from "react";
import type { UserRole } from "@hep/shared-types";
import { useCurrentUser } from "@/src/lib/auth/useCurrentUser";
import { ForbiddenView } from "./ForbiddenView";

export interface RequireRoleProps {
  allow: UserRole[];
  children: ReactNode;
}

/**
 * Client-side route/component gate (BAC-12, AC4): this is the first UI
 * route in `apps/web` needing role-based access control, so it establishes
 * the pattern future tickets should reuse rather than each inventing its
 * own. Renders nothing while the current user is still resolving (avoids a
 * flash of protected content), the `children` once the caller's role is in
 * `allow`, and {@link ForbiddenView} otherwise -- both for an unauthorized
 * role AND for no signed-in user at all. This is a UX convenience only:
 * every real enforcement happens server-side (`SuperAdminGuard` on
 * `POST /tenants/onboard` / `GET /tenants`, which independently 403s), so
 * there being no way to forge a role here that would grant real access.
 */
export function RequireRole({ allow, children }: RequireRoleProps) {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return null;
  }

  if (!user || !allow.includes(user.role)) {
    return <ForbiddenView />;
  }

  return <>{children}</>;
}
