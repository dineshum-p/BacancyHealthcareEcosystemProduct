import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { MfaRecoveryCodesRepository } from './mfa-recovery-codes.repository';
import { AccessTokenService } from './access-token.service';
import { AccessTokenGuard } from './access-token.guard';
import { PermissionsGuard } from './permissions.guard';
import { InternalServiceGuard } from './internal-service.guard';
import { MfaChallengeTokenService } from './mfa-challenge-token.service';
import { AuthSchemaProvisioner } from './auth-schema.provisioner';

@Module({
  // TenantsModule is imported directly (in addition to transitively via
  // TenantContextModule) for the same reason `services/tenant`'s
  // `ItemsModule` does: `@UseGuards(TenantGuard)` makes Nest instantiate
  // `TenantGuard` using THIS module's own injector, so its constructor
  // dependency (`TenantsRepository`) must be visible here too. Likewise for
  // `AccessTokenGuard` (BAC-6) and `PermissionsGuard` (BAC-7), used via
  // `@UseGuards(...)` on the MFA-enrollment and role-assignment routes.
  imports: [TenantContextModule, TenantsModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    RefreshTokensRepository,
    MfaRecoveryCodesRepository,
    AccessTokenService,
    AccessTokenGuard,
    PermissionsGuard,
    InternalServiceGuard,
    MfaChallengeTokenService,
    AuthSchemaProvisioner,
  ],
})
export class AuthModule {}
