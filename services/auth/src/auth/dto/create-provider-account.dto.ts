import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import type {
  CreateProviderAccountRequest,
  PatientGender,
} from '@hep/shared-types';
import { UserRole } from '../user-role.enum';

const GENDERS: PatientGender[] = ['male', 'female', 'other', 'unknown'];

/**
 * Validates the body of `POST /auth/users` (BAC-48). Collects the "core
 * identity" fields for a new `provider` (doctor) account: full name, date of
 * birth, gender, email, phone, address, plus the target `role` itself.
 *
 * `role` is deliberately validated with `@IsIn([UserRole.PROVIDER])`, NOT
 * `@IsEnum(UserRole)` (unlike `UpdateUserRoleDto`): this endpoint is scoped
 * to provisioning `provider` accounts only, not a general-purpose "create
 * any role" door that could mint a new `clinic_admin`/`super_admin` account.
 * Any other value -- a different valid role, or garbage -- is rejected with
 * a 400 before `AuthController`/`AuthService` ever sees it (AC3).
 */
export class CreateProviderAccountDto implements CreateProviderAccountRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  lastName!: string;

  @IsISO8601()
  dateOfBirth!: string;

  @IsIn(GENDERS)
  gender!: PatientGender;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @IsIn([UserRole.PROVIDER])
  role!: 'provider';
}
