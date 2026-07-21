import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { CreateVisitIntakeRequest } from '@hep/shared-types';

/**
 * Validates the body of `POST /visit-intakes` (BAC-45, AC1) against the
 * `CreateVisitIntakeRequest` contract shared with `apps/web`. `patientId` is
 * deliberately NOT a field here -- it is always taken from the caller's own
 * `userId` (self-scoped, see `VisitIntakesService.create`), never from the
 * request body, so a patient can never submit an intake on someone else's
 * behalf just by supplying a different id.
 */
export class CreateVisitIntakeDto implements CreateVisitIntakeRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reasonForVisit!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  symptoms!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  whatsNewSinceLastVisit?: string;
}
