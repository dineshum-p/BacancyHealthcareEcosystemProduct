import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import type { UpsertPatientProfileRequest } from '@hep/shared-types';
import { AllergyDto } from '../../encounters/dto/allergy.dto';
import { ChronicConditionDto } from './chronic-condition.dto';
import { MedicationDto } from './medication.dto';

/**
 * Upper bound on the number of entries accepted in any one of this DTO's
 * arrays -- defense-in-depth against an oversized payload (accidental or
 * malicious) forcing this service to encrypt/serialize/store an unbounded
 * list. No real patient baseline plausibly needs anywhere near this many
 * distinct allergies/chronic conditions/medications; chosen generously so it
 * never rejects a legitimate payload.
 */
const MAX_PROFILE_LIST_ENTRIES = 100;

/**
 * Validates the body of `PUT /patients/:patientId/profile` (BAC-44) against
 * the `UpsertPatientProfileRequest` contract shared with `apps/web`. Every
 * field is a REQUIRED array (not `@IsOptional()`): this is full-replace
 * upsert semantics, not a partial patch -- an empty array is accepted (e.g.
 * "no known allergies") but the field itself must always be present, so a
 * caller can never accidentally leave a section silently unchanged. Reuses
 * `AllergyDto` (BAC-15) rather than redefining it -- same shape, same
 * validation rules, one definition.
 */
export class UpsertPatientProfileDto implements UpsertPatientProfileRequest {
  @IsArray()
  @ArrayMaxSize(MAX_PROFILE_LIST_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => AllergyDto)
  allergies!: AllergyDto[];

  @IsArray()
  @ArrayMaxSize(MAX_PROFILE_LIST_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => ChronicConditionDto)
  chronicConditions!: ChronicConditionDto[];

  @IsArray()
  @ArrayMaxSize(MAX_PROFILE_LIST_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => MedicationDto)
  medications!: MedicationDto[];
}
