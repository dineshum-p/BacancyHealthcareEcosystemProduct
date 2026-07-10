import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import type { FhirPatientResource } from '@hep/shared-types';
import { FhirHumanNameDto } from './fhir-human-name.dto';
import { FhirIdentifierDto } from './fhir-identifier.dto';
import { FhirContactPointDto } from './fhir-contact-point.dto';
import { FhirAddressDto } from './fhir-address.dto';

const PATIENT_GENDERS: NonNullable<FhirPatientResource['gender']>[] = [
  'male',
  'female',
  'other',
  'unknown',
];

/**
 * Validates a FHIR R4 `Patient` resource submitted to `POST /fhir/Patient`
 * (BAC-10, AC2/AC3). `resourceType` must literally be `'Patient'` (the FHIR
 * REST API contract: a client posting to the `Patient` type endpoint with
 * any other `resourceType` -- or none -- is non-R4-conformant and must be
 * rejected, not silently coerced). `name` is required with at least one
 * entry: an unnamed patient is a data-quality problem this gateway refuses
 * to accept (see `FhirHumanNameDto`'s doc comment for the same reasoning
 * applied to `family`).
 *
 * Server-assigned fields (`id`) are deliberately NOT part of this DTO -- a
 * client-supplied `id` on a create is ignored/rejected by `whitelist: true`
 * (the global `ValidationPipe`'s `forbidNonWhitelisted: true` turns an
 * unknown field, including a stray `id`, into a 400 `OperationOutcome`,
 * consistent with AC3).
 */
export class CreatePatientDto implements Omit<
  FhirPatientResource,
  'id' | 'name'
> {
  @IsIn(['Patient'])
  resourceType!: 'Patient';

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FhirIdentifierDto)
  identifier?: FhirIdentifierDto[];

  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FhirHumanNameDto)
  name!: FhirHumanNameDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FhirContactPointDto)
  telecom?: FhirContactPointDto[];

  @IsOptional()
  @IsIn(PATIENT_GENDERS)
  gender?: FhirPatientResource['gender'];

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FhirAddressDto)
  address?: FhirAddressDto[];
}
