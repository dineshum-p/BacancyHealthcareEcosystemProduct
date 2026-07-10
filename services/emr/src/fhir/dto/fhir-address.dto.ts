import { IsArray, IsOptional, IsString } from 'class-validator';
import type { FhirAddress } from '@hep/shared-types';

/** FHIR R4 `Address` datatype subset (BAC-10). */
export class FhirAddressDto implements FhirAddress {
  @IsOptional()
  @IsString()
  use?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  line?: string[];

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;
}
