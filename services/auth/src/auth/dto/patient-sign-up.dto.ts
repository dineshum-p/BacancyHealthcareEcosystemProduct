import {
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { PatientSignUpRequest } from '@hep/shared-types';

/**
 * Validates the body of the PUBLIC, unauthenticated
 * `POST /auth/patients/register` (BAC-42). `email`/`password` validation
 * mirrors `RegisterDto` (same hashing/validation convention as every other
 * registration path in this service); `firstName`/`lastName`/`dateOfBirth`
 * validation mirrors `services/patient`'s BAC-36 `SelfRegisterPatientDto` --
 * see `PatientSignUpRequest`'s doc comment in `@hep/shared-types` for why
 * this is a distinct contract type rather than an alias of either existing
 * shape.
 */
export class PatientSignUpDto implements PatientSignUpRequest {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

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
}
