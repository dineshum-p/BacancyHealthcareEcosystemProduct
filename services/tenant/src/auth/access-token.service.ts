import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '@hep/shared-types';
import { getAuthConfig } from '../config/auth.config';

/**
 * Verify-only counterpart to `services/auth`'s `AccessTokenService` (BAC-8):
 * `services/tenant` never issues access tokens -- only `services/auth`
 * does -- but it must independently verify tokens `services/auth` issued,
 * since both are separately-deployable services trusting the same signed
 * JWT. Deliberately has no `sign()` method (unlike `services/auth`'s
 * version) so nothing in this service can accidentally mint a token that
 * looks like it came from `services/auth`.
 *
 * The secret is read per call from `getAuthConfig()` (not baked into
 * `JwtModule.register()`) so it stays live-configurable via env without a
 * module re-registration -- same pattern as `services/auth`.
 */
@Injectable()
export class AccessTokenService {
  constructor(private readonly jwtService: JwtService) {}

  verify(token: string): AccessTokenPayload {
    const config = getAuthConfig();
    return this.jwtService.verify<AccessTokenPayload>(token, {
      secret: config.jwtAccessSecret,
      algorithms: ['HS256'],
    });
  }
}
