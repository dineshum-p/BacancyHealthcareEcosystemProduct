import { IsIn, IsISO8601, ValidateIf } from 'class-validator';
import type { UpdateAppointmentRequest } from '@hep/shared-types';

const ACTIONS: UpdateAppointmentRequest['action'][] = ['reschedule', 'cancel'];

/**
 * Validates the body of `PATCH /appointments/:id` (BAC-16, AC3):
 * `{ action: 'reschedule', startTime, endTime }` or `{ action: 'cancel' }`.
 * `startTime`/`endTime` are only required (and only validated as ISO-8601)
 * when `action` is `'reschedule'` -- `@ValidateIf` skips them entirely for a
 * `'cancel'` request, so a caller cancelling a slot does not need to (and
 * should not) supply a time range.
 */
export class UpdateAppointmentDto implements UpdateAppointmentRequest {
  @IsIn(ACTIONS)
  action!: UpdateAppointmentRequest['action'];

  @ValidateIf((dto: UpdateAppointmentDto) => dto.action === 'reschedule')
  @IsISO8601()
  startTime?: string;

  @ValidateIf((dto: UpdateAppointmentDto) => dto.action === 'reschedule')
  @IsISO8601()
  endTime?: string;
}
