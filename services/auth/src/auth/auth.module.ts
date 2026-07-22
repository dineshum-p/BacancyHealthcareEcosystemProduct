import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { TenantsModule } from '../tenants/tenants.module';
import { getPatientSignUpThrottleConfig } from '../config/patient-sign-up-throttle.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { MfaRecoveryCodesRepository } from './mfa-recovery-codes.repository';
import { AccessTokenService } from './access-token.service';
import { AccessTokenGuard } from './access-token.guard';
import { PasswordResetTokenService } from './password-reset-token.service';
import { PasswordResetTokenGuard } from './password-reset-token.guard';
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
  //
  // `ThrottlerModule.forRootAsync(...)` (BAC-42) configures the rate limit
  // for `POST /auth/patients/register` (`@UseGuards(ThrottlerGuard)` on that
  // one route only -- see `AuthController.registerPatient`'s doc comment for
  // why it is NOT applied class-wide). Deliberately `forRootAsync` with a
  // `useFactory`, NOT `forRoot` with a value computed inline: mirrors
  // `services/patient`'s BAC-36 `PatientSelfRegistrationsModule` doc comment
  // exactly -- a `useFactory` is invoked lazily during `app.init()`/
  // `compile()`, AFTER a test's `beforeAll` has a chance to override
  // `PATIENT_SIGN_UP_RATE_LIMIT`/`_TTL_MS` in `process.env`, whereas a
  // `forRoot(...)` argument is evaluated immediately when this module class
  // is first loaded.
  imports: [
    TenantContextModule,
    TenantsModule,
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      useFactory: (): ThrottlerModuleOptions => {
        const config = getPatientSignUpThrottleConfig();
        return [{ name: 'default', ttl: config.ttlMs, limit: config.limit }];
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    RefreshTokensRepository,
    MfaRecoveryCodesRepository,
    AccessTokenService,
    AccessTokenGuard,
    PasswordResetTokenService,
    PasswordResetTokenGuard,
    PermissionsGuard,
    InternalServiceGuard,
    MfaChallengeTokenService,
    AuthSchemaProvisioner,
    ThrottlerGuard,
  ],
})
export class AuthModule {}
