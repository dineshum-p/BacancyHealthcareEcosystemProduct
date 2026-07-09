import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getAuthConfig } from '../config/auth.config';

/** Signed into every MFA challenge token; checked explicitly on verify. */
const MFA_CHALLENGE_PURPOSE = 'mfa-challenge';

/** Short-lived: a login attempt must complete its TOTP challenge quickly. */
const DEFAULT_MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

export interface MfaChallengePayload {
  userId: string;
  tenantId: string;
  purpose: typeof MFA_CHALLENGE_PURPOSE;
}

/**
 * Issues/verifies the short-lived, single-purpose token `POST /auth/login`
 * hands back instead of real tokens when a user's MFA is `active` (AC3),
 * and that `POST /auth/mfa/login-verify` exchanges for real `AuthTokens`
 * once a valid TOTP code is presented.
 *
 * Deliberately NOT `AccessTokenService` reused unchanged: this token must
 * never be usable as a Bearer access token against any other endpoint
 * (e.g. `AccessTokenGuard`). Two independent safeguards enforce that:
 *
 * 1. A distinct `purpose` claim, checked explicitly in `verify()` --
 *    defense in depth if the secret were ever shared/reused elsewhere.
 * 2. A cryptographically distinct signing secret, deterministically
 *    derived from `JWT_ACCESS_SECRET` (so no separate env var/fail-fast
 *    plumbing is needed, while still being effectively "a different key").
 *    Because `AccessTokenService.verify()` signs/verifies with the raw
 *    `JWT_ACCESS_SECRET`, an MFA challenge token's signature simply does
 *    not validate there -- and vice versa -- even before any claim is
 *    inspected.
 */
@Injectable()
export class MfaChallengeTokenService {
  constructor(private readonly jwtService: JwtService) {}

  sign(
    userId: string,
    tenantId: string,
    ttlSeconds: number = DEFAULT_MFA_CHALLENGE_TTL_SECONDS,
  ): string {
    const payload: MfaChallengePayload = {
      userId,
      tenantId,
      purpose: MFA_CHALLENGE_PURPOSE,
    };
    return this.jwtService.sign(payload, {
      secret: this.deriveSecret(),
      expiresIn: ttlSeconds,
      algorithm: 'HS256',
    });
  }

  verify(token: string): MfaChallengePayload {
    const payload = this.jwtService.verify<MfaChallengePayload>(token, {
      secret: this.deriveSecret(),
      algorithms: ['HS256'],
    });
    if (payload.purpose !== MFA_CHALLENGE_PURPOSE) {
      throw new Error('Not an MFA challenge token.');
    }
    return payload;
  }

  private deriveSecret(): string {
    const { jwtAccessSecret } = getAuthConfig();
    return createHash('sha256')
      .update(`${jwtAccessSecret}:${MFA_CHALLENGE_PURPOSE}`)
      .digest('hex');
  }
}
