import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { SoapNote } from '@hep/shared-types';

const SOAP_FIELD_MAX_LENGTH = 10000;

/**
 * Validates a structured SOAP note (BAC-15, AC1): Subjective/Objective/
 * Assessment/Plan are all required, free-text fields -- an encounter note
 * with any one of them missing is not a complete SOAP note.
 */
export class SoapNoteDto implements SoapNote {
  @IsString()
  @IsNotEmpty()
  @MaxLength(SOAP_FIELD_MAX_LENGTH)
  subjective!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(SOAP_FIELD_MAX_LENGTH)
  objective!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(SOAP_FIELD_MAX_LENGTH)
  assessment!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(SOAP_FIELD_MAX_LENGTH)
  plan!: string;
}
