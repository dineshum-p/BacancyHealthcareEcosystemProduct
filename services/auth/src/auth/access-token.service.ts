import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '@hep/shared-types';
import { getAuthConfig } from '../config/auth.config';

export interface SignedAccessToken {
  token: string;
  /** Access token lifetime, in seconds, echoed back for the response body. */
  expiresIn: number;
}

/**
 * Thin wrapper around `@nestjs/jwt`'s `JwtService` that signs/verifies
 * access-token JWTs whose payload is exactly `AccessTokenPayload` (AC5):
 * `userId`, `tenantId`, `role`. The secret/TTL are read per call from
 * `getAuthConfig()` rather than baked into `JwtModule.register()` so they
 * stay live-configurable via env without a module re-registration.
 */
@Injectable()
export class AccessTokenService {
  constructor(private readonly jwtService: JwtService) {}

  sign(payload: AccessTokenPayload): SignedAccessToken {
    const config = getAuthConfig();
    const token = this.jwtService.sign(payload, {
      secret: config.jwtAccessSecret,
      expiresIn: config.accessTokenTtlSeconds,
      algorithm: 'HS256',
    });
    return { token, expiresIn: config.accessTokenTtlSeconds };
  }

  verify(token: string): AccessTokenPayload {
    const config = getAuthConfig();
    return this.jwtService.verify<AccessTokenPayload>(token, {
      secret: config.jwtAccessSecret,
      algorithms: ['HS256'],
    });
  }
}
