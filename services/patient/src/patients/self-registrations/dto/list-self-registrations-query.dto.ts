import { IsIn, IsOptional } from 'class-validator';
import type { PatientSelfRegistrationStatus } from '@hep/shared-types';

const STATUSES: PatientSelfRegistrationStatus[] = [
  'pending',
  'approved',
  'rejected',
  'merged',
];

/**
 * Validates the query string of `GET /patients/self-registrations`
 * (BAC-36): `?status=pending|approved|rejected|merged`, optional. Omitted
 * entirely, every self-registration in the tenant is returned regardless of
 * lifecycle state; the staff-facing "pending queue" view is simply this
 * endpoint called with `?status=pending`.
 */
export class ListSelfRegistrationsQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: PatientSelfRegistrationStatus;
}
