import { IsNotEmpty, IsString } from 'class-validator';
import type { MergeSelfRegistrationRequest } from '@hep/shared-types';

/**
 * Validates the body of `POST /patients/self-registrations/:id/merge`
 * (BAC-36). `targetPatientId` is required: even though duplicate detection
 * may have already proposed a candidate at submission time
 * (`PatientSelfRegistrationSummary.matchedPatientId`), the API never assumes
 * that candidate is the staff reviewer's intended merge target -- it must be
 * explicit on every merge request.
 */
export class MergeSelfRegistrationDto implements MergeSelfRegistrationRequest {
  @IsString()
  @IsNotEmpty()
  targetPatientId!: string;
}
