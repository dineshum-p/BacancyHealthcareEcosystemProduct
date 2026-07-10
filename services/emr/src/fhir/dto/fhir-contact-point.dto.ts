import { IsIn, IsOptional, IsString } from 'class-validator';
import type { FhirContactPoint } from '@hep/shared-types';

const CONTACT_POINT_SYSTEMS: NonNullable<FhirContactPoint['system']>[] = [
  'phone',
  'fax',
  'email',
  'pager',
  'url',
  'sms',
  'other',
];

/** FHIR R4 `ContactPoint` datatype subset (BAC-10), e.g. a phone or email. */
export class FhirContactPointDto implements FhirContactPoint {
  @IsOptional()
  @IsIn(CONTACT_POINT_SYSTEMS)
  system?: FhirContactPoint['system'];

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  use?: string;
}
