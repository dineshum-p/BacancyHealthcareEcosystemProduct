import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { RejectSelfRegistrationRequest } from '@hep/shared-types';

/** Validates the body of `POST /patients/self-registrations/:id/reject` (BAC-36). */
export class RejectSelfRegistrationDto implements RejectSelfRegistrationRequest {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
