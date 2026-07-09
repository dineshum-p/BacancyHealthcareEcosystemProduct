/**
 * BAC-5 specifies no role-assignment flow; every user registered via
 * `POST /auth/register` gets `MEMBER` by default (see `AuthService.register`).
 * Mirrors the `UserRole` union exported from `@hep/shared-types`.
 */
export enum UserRole {
  MEMBER = 'member',
}
