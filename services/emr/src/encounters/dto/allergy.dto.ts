import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { Allergy, AllergySeverity } from '@hep/shared-types';

const ALLERGY_SEVERITIES: AllergySeverity[] = ['mild', 'moderate', 'severe'];

/**
 * Validates one structured allergy entry (BAC-15, AC1): `substance` is the
 * only required field (an allergy list entry is meaningless without one);
 * `reaction`/`severity` are optional free-text/closed-set fields a provider
 * may not always capture.
 */
export class AllergyDto implements Allergy {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  substance!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reaction?: string;

  @IsOptional()
  @IsIn(ALLERGY_SEVERITIES)
  severity?: AllergySeverity;
}
