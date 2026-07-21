import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { LinkVisitIntakeRequest } from '@hep/shared-types';

/**
 * Validates the body of `PATCH /visit-intakes/:id/link` (BAC-45, AC3): staff
 * associate a specific provider + the BAC-16/21 appointment they just booked
 * with a pending intake. `VisitIntakesService.link` additionally verifies
 * `appointmentId` refers to a real appointment booked with `providerId` --
 * `class-validator` alone cannot express that cross-resource check.
 */
export class LinkVisitIntakeDto implements LinkVisitIntakeRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  providerId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  appointmentId!: string;
}
