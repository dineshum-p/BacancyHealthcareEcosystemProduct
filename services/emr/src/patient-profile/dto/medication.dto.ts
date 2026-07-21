import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Medication } from '@hep/shared-types';

/**
 * Validates one structured long-term-medication entry (BAC-44): `name` is
 * the only required field, mirroring `AllergyDto`'s (BAC-15) and
 * `ChronicConditionDto`'s exact shape/rationale.
 */
export class MedicationDto implements Medication {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  frequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
