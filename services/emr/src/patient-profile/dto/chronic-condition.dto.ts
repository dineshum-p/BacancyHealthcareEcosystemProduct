import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { ChronicCondition } from '@hep/shared-types';

/**
 * Validates one structured chronic-condition entry (BAC-44): `name` is the
 * only required field (an entry is meaningless without one), mirroring
 * `AllergyDto`'s (BAC-15) exact shape/rationale for its own required
 * `substance` field.
 */
export class ChronicConditionDto implements ChronicCondition {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsDateString()
  diagnosedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
