import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenService } from './access-token.service';
import { AccessTokenGuard } from './access-token.guard';
import { PermissionsGuard } from './permissions.guard';

/**
 * Brings JWT *verification* and RBAC into `services/patient`, mirroring
 * `services/tenant`'s BAC-8, `services/notification`'s BAC-9,
 * `services/emr`'s BAC-10, and `services/billing`'s BAC-11 `AuthModule`:
 * this service never issues tokens -- only `services/auth` does -- so there
 * is no register/login flow here, just the verify-only primitives
 * (`AccessTokenService`, `AccessTokenGuard`) plus BAC-7's `PermissionsGuard`
 * mechanism (BAC-14, AC1/AC3), which other modules compose as
 * `@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)`.
 */
@Module({
  imports: [JwtModule.register({})],
  providers: [AccessTokenService, AccessTokenGuard, PermissionsGuard],
  exports: [AccessTokenService, AccessTokenGuard, PermissionsGuard],
})
export class AuthModule {}
