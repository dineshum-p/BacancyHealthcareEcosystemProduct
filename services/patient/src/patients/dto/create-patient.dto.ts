import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { PatientGender, RegisterPatientRequest } from '@hep/shared-types';

const PATIENT_GENDERS: PatientGender[] = ['male', 'female', 'other', 'unknown'];

/**
 * Validates the body of `POST /patients` (BAC-14, AC1) against the
 * `RegisterPatientRequest` contract shared with `apps/web` (a future ticket,
 * BAC-17, registers/searches patients from the clinic UI using this exact
 * shape). `dateOfBirth` accepts any ISO-8601 date/date-time string --
 * `PatientsRepository` only ever persists the date component.
 */
export class CreatePatientDto implements RegisterPatientRequest {
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
