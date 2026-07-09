import { IsString, Matches } from 'class-validator';

/** A TOTP code is always exactly 6 digits (otplib defaults -- see totp.util.ts). */
const TOTP_CODE_PATTERN = /^\d{6}$/;

export class MfaVerifyDto {
  @IsString()
  @Matches(TOTP_CODE_PATTERN, {
    message: 'totpCode must be a 6-digit numeric code.',
  })
  totpCode!: string;
}
