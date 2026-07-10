import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { FhirIdentifier } from '@hep/shared-types';

/** FHIR R4 `Identifier` datatype subset (BAC-10), e.g. an MRN or SSN. */
export class FhirIdentifierDto implements FhirIdentifier {
  @IsOptional()
  @IsString()
  system?: string;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsOptional()
  @IsString()
  use?: string;
}
