import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type {
  PatientGender,
  SelfRegisterPatientRequest,
} from '@hep/shared-types';

const PATIENT_GENDERS: PatientGender[] = ['male', 'female', 'other', 'unknown'];

/**
 * Validates the body of the PUBLIC, unauthenticated
 * `POST /public/tenants/:tenantSlug/patients` (BAC-36). Deliberately the
 * same field set/validation as BAC-14's `CreatePatientDto` (same core
 * demographics either way a patient enters the system) -- see
 * `SelfRegisterPatientRequest`'s doc comment in `@hep/shared-types` for why
 * that contract type is a plain alias of `RegisterPatientRequest` rather than
 * a redeclared shape.
 */
export class SelfRegisterPatientDto implements SelfRegisterPatientRequest {
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

  @IsOptional()
  @IsIn(PATIENT_GENDERS)
  gender?: PatientGender;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
