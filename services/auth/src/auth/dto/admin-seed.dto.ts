import { IsEmail, MaxLength } from 'class-validator';

/**
 * Request body for `POST /auth/admin-seed` (BAC-12). Deliberately does NOT
 * accept a `role` or `password` from the caller: the role is always
 * `clinic_admin` (this endpoint's one purpose -- see `AuthController`'s doc
 * comment) and the password is always server-generated (see
 * `AuthService.seedClinicAdmin`), so neither is a caller-supplied input.
 */
export class AdminSeedDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
