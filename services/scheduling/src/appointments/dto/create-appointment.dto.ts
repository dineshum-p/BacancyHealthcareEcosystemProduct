import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import type {
  CreateAppointmentRequest,
  NotificationChannel,
} from '@hep/shared-types';

const NOTIFICATION_CHANNELS: NotificationChannel[] = ['sms', 'email'];

/**
 * Validates the body of `POST /appointments` (BAC-16, AC1) against the
 * `CreateAppointmentRequest` contract shared with `apps/web`. `endTime`
 * ordering (`endTime` must be after `startTime`) is a business rule checked
 * by `AppointmentsService.create`, not here -- `class-validator` alone
 * cannot express a cross-field comparison as cleanly as a plain `if` in the
 * service, and the resulting `BadRequestException` message can be more
 * specific there.
 */
export class CreateAppointmentDto implements CreateAppointmentRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  providerId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  patientId!: string;

  @IsISO8601()
  startTime!: string;

  @IsISO8601()
  endTime!: string;

  @IsIn(NOTIFICATION_CHANNELS)
  notifyChannel!: NotificationChannel;

  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  notifyTo!: string;
}
