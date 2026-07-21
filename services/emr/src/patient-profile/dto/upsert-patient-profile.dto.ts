import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import type { UpsertPatientProfileRequest } from '@hep/shared-types';
import { AllergyDto } from '../../encounters/dto/allergy.dto';
import { ChronicConditionDto } from './chronic-condition.dto';
import { MedicationDto } from './medication.dto';

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
  @ValidateNested({ each: true })
  @Type(() => AllergyDto)
  allergies!: AllergyDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChronicConditionDto)
  chronicConditions!: ChronicConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationDto)
  medications!: MedicationDto[];
}
