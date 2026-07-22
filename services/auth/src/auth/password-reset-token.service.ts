import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getAuthConfig } from '../config/auth.config';

/** Signed into every password-reset-required token; checked explicitly on verify. */
const PASSWORD_RESET_TOKEN_PURPOSE = 'password-reset-required';

export interface PasswordResetTokenPayload {
  userId: string;
  tenantId: string;
  purpose: typeof PASSWORD_RESET_TOKEN_PURPOSE;
}

export interface SignedPasswordResetToken {
  token: string;
  /** Lifetime, in seconds, echoed back for the response body (`expiresIn`). */
  expiresIn: number;
}

/**
 * Issues/verifies the narrowly-scoped credential `POST /auth/login` hands
 * back instead of a full `AuthTokens` pair when `user.mustResetPassword` is
 * `true` (BAC-49, AC1), and that `PasswordResetTokenGuard` verifies on
 * `POST /auth/reset-temporary-password` alone.
 *
 * Mirrors `MfaChallengeTokenService`'s established pattern for exactly the
 * same class of problem ("not fully authenticated yet, can only call one
 * specific follow-up endpoint"): reusing `AccessTokenService`/
 * `AccessTokenGuard` unchanged for this would mean minting a completely
 * normal, full-privilege access token carrying the account's real role --
 * a valid Bearer credential for EVERY `AccessTokenGuard`-protected route in
 * the service (and, transitively, every `PermissionsGuard`-protected one the
 * role has permissions for), not just the one reset endpoint. Two
 * independent safeguards make this token something else entirely:
 *
 * 1. A distinct `purpose` claim, checked explicitly in `verify()` -- defense
 *    in depth if the secret were ever shared/reused elsewhere.
 * 2. A cryptographically distinct signing secret, deterministically derived
 *    from `JWT_ACCESS_SECRET` (so no separate env var/fail-fast plumbing is
 *    needed, while still being effectively "a different key"). Because
 *    `AccessTokenService.verify()` signs/verifies with the raw
 *    `JWT_ACCESS_SECRET`, a password-reset token's signature simply does not
 *    validate there -- and vice versa -- even before any claim is inspected.
 *    This is why `AccessTokenGuard` (and therefore `PermissionsGuard`, which
 *    only ever runs after it) rejects this token outright: it never gets far
 *    enough to see the `purpose` claim at all.
 */
@Injectable()
export class PasswordResetTokenService {
  constructor(private readonly jwtService: JwtService) {}

  sign(userId: string, tenantId: string): SignedPasswordResetToken {
    const { accessTokenTtlSeconds } = getAuthConfig();
    const payload: PasswordResetTokenPayload = {
      userId,
      tenantId,
      purpose: PASSWORD_RESET_TOKEN_PURPOSE,
    };
    const token = this.jwtService.sign(payload, {
      secret: this.deriveSecret(),
      expiresIn: accessTokenTtlSeconds,
      algorithm: 'HS256',
    });
    return { token, expiresIn: accessTokenTtlSeconds };
  }

  verify(token: string): PasswordResetTokenPayload {
    const payload = this.jwtService.verify<PasswordResetTokenPayload>(token, {
      secret: this.deriveSecret(),
      algorithms: ['HS256'],
    });
    if (payload.purpose !== PASSWORD_RESET_TOKEN_PURPOSE) {
      throw new Error('Not a password-reset token.');
    }
    return payload;
  }

  private deriveSecret(): string {
    const { jwtAccessSecret } = getAuthConfig();
    return createHash('sha256')
      .update(`${jwtAccessSecret}:${PASSWORD_RESET_TOKEN_PURPOSE}`)
      .digest('hex');
  }
}
