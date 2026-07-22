import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import type { ResetTemporaryPasswordRequest } from '@hep/shared-types';

/**
 * Validates the body of `POST /auth/reset-temporary-password` (BAC-49).
 * `newPassword`'s policy (`@MinLength(8)`/`@MaxLength(200)`) deliberately
 * mirrors `RegisterDto.password` exactly -- the same password policy this
 * service already enforces everywhere else, not a bespoke one for this one
 * endpoint. `currentPassword` has no length/strength policy of its own (it
 * is verified against the stored hash, not validated as a "new" password).
 */
export class ResetTemporaryPasswordDto implements ResetTemporaryPasswordRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string;
}
