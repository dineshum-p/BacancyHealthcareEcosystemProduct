import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '@hep/shared-types';
import { getAuthConfig } from '../config/auth.config';

/**
 * Verify-only counterpart to `services/auth`'s `AccessTokenService`:
 * `services/billing` never issues access tokens -- only `services/auth`
 * does -- but it must independently verify tokens `services/auth` issued,
 * since both are separately-deployable services trusting the same signed
 * JWT. Deliberately has no `sign()` method (mirrors `services/tenant`'s,
 * `services/notification`'s, and `services/emr`'s verify-only copies) so
 * nothing in this service can accidentally mint a token that looks like it
 * came from `services/auth`.
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
