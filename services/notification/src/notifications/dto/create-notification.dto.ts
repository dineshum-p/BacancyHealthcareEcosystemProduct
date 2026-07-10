import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { NotificationChannel } from '@hep/shared-types';

const NOTIFICATION_CHANNELS: NotificationChannel[] = ['sms', 'email'];

export class CreateNotificationDto {
  @IsIn(NOTIFICATION_CHANNELS)
  channel!: NotificationChannel;

  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  to!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  templateId!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}
