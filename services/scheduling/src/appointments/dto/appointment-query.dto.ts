import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { AppointmentQuery } from '@hep/shared-types';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates the query string of `GET /appointments` (BAC-16, AC2):
 * `?date=YYYY-MM-DD&providerId=`. `providerId` is optional at the DTO level
 * (format validation only) -- whether it is actually REQUIRED depends on the
 * caller's role, enforced by `resolveScopedProviderId`
 * (`provider-scope.util.ts`) in the service layer, since a DTO has no access
 * to the authenticated caller's role.
 */
export class AppointmentQueryDto implements AppointmentQuery {
  @IsString()
  @Matches(ISO_DATE_PATTERN, {
    message: 'date must be in YYYY-MM-DD format (e.g. "2026-07-20")',
  })
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerId?: string;
}
