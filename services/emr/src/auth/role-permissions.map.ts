import { UserRole } from './user-role.enum';
import { Permission } from './permission.enum';

/**
 * The role -> permission-set mapping for the FHIR gateway (BAC-10, AC4).
 *
 * Documented choices:
 * - `READ_PATIENT` is granted to every staff-side role (excluding `PATIENT`,
 *   BAC-41's default-deny role): any authenticated platform user (including
 *   front-desk `STAFF`) plausibly needs to look up a patient record they
 *   already know the id for (e.g. to check in a patient for a visit), and
 *   reading a resource is a much lower-risk operation than authoring one.
 * - `WRITE_PATIENT` (creating/amending the FHIR `Patient` resource that
 *   establishes a patient's core demographic identity) is granted to
 *   `SUPER_ADMIN`, `CLINIC_ADMIN`, and `PROVIDER` only -- deliberately NOT
 *   `STAFF`. This is a clinical-identity-integrity decision, not a
 *   least-privilege default copied mechanically from BAC-7: getting a
 *   patient's core demographics wrong (name/DOB/identifiers) has downstream
 *   clinical-safety consequences (e.g. mis-matched records), so this ticket
 *   restricts authoring that resource to clinical/administrative roles.
 *   Restricting this further (e.g. per-clinic scoping beyond tenant
 *   isolation) is out of scope here, same as BAC-7's own documented scope
 *   boundary.
 * - `READ_ENCOUNTER` (BAC-15) is granted to every role for the same reason
 *   `READ_PATIENT` is: any authenticated platform user plausibly needs to
 *   review a patient's chart/encounter history.
 * - `WRITE_ENCOUNTER` (BAC-15, authoring a SOAP note/vitals/allergies) is
 *   granted to `SUPER_ADMIN`, `CLINIC_ADMIN`, and `PROVIDER` only --
 *   deliberately NOT `STAFF` -- mirroring `WRITE_PATIENT`'s exact rationale:
 *   clinical documentation authorship is restricted to clinical/
 *   administrative roles, not front-desk staff.
 * - `READ_PATIENT_PROFILE`/`WRITE_PATIENT_PROFILE` (BAC-44, the patient
 *   baseline profile -- allergies/chronic conditions/long-term medications)
 *   are granted to EVERY staff-side role, INCLUDING `STAFF` for the write
 *   permission too -- deliberately UNLIKE `WRITE_PATIENT`/`WRITE_ENCOUNTER`.
 *   This is a different kind of action than either of those: it is not
 *   authoring clinical documentation (a provider's clinical judgment, like a
 *   SOAP note) nor establishing a patient's core legal identity (like the
 *   FHIR `Patient` resource); it is closer to front-desk intake data entry
 *   (recording what a patient reports about their own allergy/medication/
 *   condition history), which `STAFF` routinely performs at check-in in a
 *   real clinic. Row-level ownership (a `PATIENT` may only ever touch their
 *   OWN profile) is enforced separately, per-request, by
 *   `assertPatientScope` (BAC-41) -- NOT expressible in this role-level map,
 *   which only decides "can this role attempt the action at all".
 */
export const ROLE_PERMISSIONS: Readonly<
  Record<UserRole, readonly Permission[]>
> = {
  [UserRole.SUPER_ADMIN]: [
    Permission.READ_PATIENT,
    Permission.WRITE_PATIENT,
    Permission.READ_ENCOUNTER,
    Permission.WRITE_ENCOUNTER,
    Permission.READ_PATIENT_PROFILE,
    Permission.WRITE_PATIENT_PROFILE,
  ],
  [UserRole.CLINIC_ADMIN]: [
    Permission.READ_PATIENT,
    Permission.WRITE_PATIENT,
    Permission.READ_ENCOUNTER,
    Permission.WRITE_ENCOUNTER,
    Permission.READ_PATIENT_PROFILE,
    Permission.WRITE_PATIENT_PROFILE,
  ],
  [UserRole.PROVIDER]: [
    Permission.READ_PATIENT,
    Permission.WRITE_PATIENT,
    Permission.READ_ENCOUNTER,
    Permission.WRITE_ENCOUNTER,
    Permission.READ_PATIENT_PROFILE,
    Permission.WRITE_PATIENT_PROFILE,
  ],
  [UserRole.STAFF]: [
    Permission.READ_PATIENT,
    Permission.READ_ENCOUNTER,
    Permission.READ_PATIENT_PROFILE,
    Permission.WRITE_PATIENT_PROFILE,
  ],
  /**
   * `PATIENT` (BAC-41) is granted NOTHING except BAC-44's own narrow,
   * self-scoped profile permissions -- still default-deny for every
   * pre-existing staff-side permission (`READ_PATIENT`/`WRITE_PATIENT`/
   * `READ_ENCOUNTER`/`WRITE_ENCOUNTER`). `READ_PATIENT_PROFILE`/
   * `WRITE_PATIENT_PROFILE` are granted here because BAC-44's whole point is
   * letting a patient view/edit their OWN baseline profile; the role-level
   * grant only says "a patient may attempt this action type" -- ownership
   * (their OWN record, never another patient's) is enforced separately by
   * `PatientProfileService` via `assertPatientScope`.
   */
  [UserRole.PATIENT]: [
    Permission.READ_PATIENT_PROFILE,
    Permission.WRITE_PATIENT_PROFILE,
  ],
};

export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return getPermissionsForRole(role).includes(permission);
}
