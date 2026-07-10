import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenService } from './access-token.service';
import { AccessTokenGuard } from './access-token.guard';

/**
 * BAC-8: brings JWT *verification* into `services/tenant` for the first
 * time. This service never issues tokens -- only `services/auth` does --
 * so there is no `AuthController`/register/login flow here, just the
 * verify-only primitives (`AccessTokenService`, `AccessTokenGuard`) other
 * modules compose with `TenantGuard` to require an authenticated caller.
 */
@Module({
  imports: [JwtModule.register({})],
  providers: [AccessTokenService, AccessTokenGuard],
  exports: [AccessTokenService, AccessTokenGuard],
})
export class AuthModule {}
