import type { UserRole } from "@hep/shared-types";

/**
 * BAC-13, AC4: where an authenticated caller lands -- both right after a
 * successful login and when an already-signed-in caller hits `/login`
 * directly. `super_admin` goes to `/admin/tenants` (BAC-12's Super Admin
 * console). `patient` (BAC-41/46) goes to `/profile` -- their own baseline
 * profile page, which doubles as onboarding (it prompts to fill in
 * allergies/chronic conditions/medications when `hasProfile` is false) --
 * NOT `/patients`, which is the staff-facing patient search page a
 * `patient` account holds no permission for. Every remaining role
 * (`clinic_admin`/`provider`/`staff`) goes to `/patients` (BAC-17's patient
 * search page) -- the first clinic-facing screen built, and reachable by
 * all three since every role holds `read_patient` (see `services/patient`'s
 * `role-permissions.map.ts`). No dedicated per-role dashboard exists yet
 * beyond this; this is still a placeholder, just no longer the
 * unauthenticated app-template home route.
 */
export function resolveDashboardPath(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "/admin/tenants";
    case "patient":
      return "/profile";
    default:
      return "/patients";
  }
}
