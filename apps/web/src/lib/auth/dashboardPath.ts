import type { UserRole } from "@hep/shared-types";

/**
 * BAC-13, AC4: where an authenticated caller lands -- both right after a
 * successful login and when an already-signed-in caller hits `/login`
 * directly. `super_admin` is the only role with a real destination today
 * (`/admin/tenants`, BAC-12's Super Admin console -- the only authenticated
 * page that exists in this app so far). No `clinic_admin`/`provider`/
 * `staff` dashboard has been built yet; building one is explicitly out of
 * this ticket's scope, so those roles land on the app's home route (`/`) as
 * a documented placeholder until a real per-role dashboard exists.
 */
export function resolveDashboardPath(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "/admin/tenants";
    default:
      return "/";
  }
}
