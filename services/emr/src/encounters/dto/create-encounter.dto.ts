import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import type { CreateEncounterRequest } from '@hep/shared-types';
import { SoapNoteDto } from './soap-note.dto';
import { VitalSignsDto } from './vital-signs.dto';
import { AllergyDto } from './allergy.dto';

/**
 * Validates the body of `POST /patients/:patientId/encounters` (BAC-15,
 * AC1) against the `CreateEncounterRequest` contract shared with
 * `apps/web`. Delegates the actual field-level rules to the nested DTOs
 * (`SoapNoteDto`/`VitalSignsDto`/`AllergyDto`) via `@ValidateNested()` +
 * `@Type(...)` (`class-transformer`), so a malformed/out-of-range nested
 * value (e.g. an out-of-range vital, AC3) is still rejected with 400 by the
 * global `ValidationPipe` even though this outer DTO has no field-level
 * rules of its own for those nested shapes.
 */
export class CreateEncounterDto implements CreateEncounterRequest {
  @IsDefined()
  @ValidateNested()
  @Type(() => SoapNoteDto)
  soapNote!: SoapNoteDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => VitalSignsDto)
  vitals?: VitalSignsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllergyDto)
  allergies?: AllergyDto[];
}
