import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

const TOTP_CODE_PATTERN = /^\d{6}$/;

export class MfaLoginVerifyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  mfaChallengeToken!: string;

  @IsString()
  @Matches(TOTP_CODE_PATTERN, {
    message: 'totpCode must be a 6-digit numeric code.',
  })
  totpCode!: string;
}
