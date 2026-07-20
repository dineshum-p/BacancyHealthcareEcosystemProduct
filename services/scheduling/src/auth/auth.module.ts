import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenService } from './access-token.service';
import { AccessTokenGuard } from './access-token.guard';
import { PermissionsGuard } from './permissions.guard';

/**
 * Brings JWT *verification* and RBAC into `services/scheduling`, mirroring
 * every other service's `AuthModule`: this service never issues tokens --
 * only `services/auth` does -- so there is no register/login flow here,
 * just the verify-only primitives (`AccessTokenService`, `AccessTokenGuard`)
 * plus BAC-7's `PermissionsGuard` mechanism (BAC-16), which other modules
 * compose as `@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)`.
 */
@Module({
  imports: [JwtModule.register({})],
  providers: [AccessTokenService, AccessTokenGuard, PermissionsGuard],
  exports: [AccessTokenService, AccessTokenGuard, PermissionsGuard],
})
export class AuthModule {}
