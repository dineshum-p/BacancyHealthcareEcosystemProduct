import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { FhirHumanName } from '@hep/shared-types';

/**
 * FHIR R4 `HumanName` datatype subset (BAC-10, AC2/AC3). `family` is
 * required (a business rule stricter than bare FHIR R4, which leaves every
 * `HumanName` element optional): a `Patient` with no recorded family name at
 * all is a real-world data-quality problem this gateway deliberately
 * refuses to accept, rather than silently persisting an unusable record --
 * documented here as a scope decision, not a bug.
 */
export class FhirHumanNameDto implements FhirHumanName {
  @IsOptional()
  @IsString()
  use?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsString()
  @IsNotEmpty()
  family!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  given?: string[];
}
