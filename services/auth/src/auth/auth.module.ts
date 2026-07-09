import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { AccessTokenService } from './access-token.service';
import { AuthSchemaProvisioner } from './auth-schema.provisioner';

@Module({
  // TenantsModule is imported directly (in addition to transitively via
  // TenantContextModule) for the same reason `services/tenant`'s
  // `ItemsModule` does: `@UseGuards(TenantGuard)` makes Nest instantiate
  // `TenantGuard` using THIS module's own injector, so its constructor
  // dependency (`TenantsRepository`) must be visible here too.
  imports: [TenantContextModule, TenantsModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    RefreshTokensRepository,
    AccessTokenService,
    AuthSchemaProvisioner,
  ],
})
export class AuthModule {}
