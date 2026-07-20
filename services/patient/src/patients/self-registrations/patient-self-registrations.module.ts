import { Module } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { TenantContextModule } from '../../tenant-context/tenant-context.module';
import { AuthModule } from '../../auth/auth.module';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';
import { EventsModule } from '../../events/events.module';
import { PatientSchemaModule } from '../patient-schema.module';
import { PatientsModule } from '../patients.module';
import { getPublicRegistrationThrottleConfig } from '../../config/public-registration-throttle.config';
import { PublicPatientSelfRegistrationsController } from './public-patient-self-registrations.controller';
import { PatientSelfRegistrationsController } from './patient-self-registrations.controller';
import { PatientSelfRegistrationsService } from './patient-self-registrations.service';
import { PatientSelfRegistrationsRepository } from './patient-self-registrations.repository';

/**
 * Wires BAC-36's patient self-registration feature together: the public,
 * unauthenticated submission controller, the staff-facing review-queue
 * controller, and the shared service/repository between them.
 *
 * `PatientsModule` is imported for its exported `PatientsRepository` (used
 * for duplicate detection and merge-target lookup) -- NOT re-exported here,
 * this module only consumes it. `ThrottlerModule.forRootAsync(...)`
 * configures BAC-36's rate-limit AC for
 * `PublicPatientSelfRegistrationsController`
 * (`@UseGuards(TenantGuard, ThrottlerGuard)`); `ThrottlerGuard` is listed as
 * an explicit provider because `ThrottlerModule` itself only provides the
 * options/storage tokens the guard depends on, not the guard class.
 *
 * Deliberately `forRootAsync` with a `useFactory`, NOT `forRoot` with a
 * value computed inline: `useFactory` is invoked lazily when Nest resolves
 * the `THROTTLER_OPTIONS` provider during `app.init()`/`compile()`, whereas a
 * `forRoot(...)` argument is evaluated immediately when this module class is
 * first loaded (i.e. as soon as anything `import`s it) -- BEFORE a test's
 * `beforeAll` has a chance to override
 * `PUBLIC_PATIENT_REGISTRATION_RATE_LIMIT`/`_TTL_MS` in `process.env`. The
 * lazy factory is what makes `getPublicRegistrationThrottleConfig()`
 * actually overridable per test run.
 */
@Module({
  imports: [
    TenantContextModule,
    AuthModule,
    AuditLogsModule,
    EventsModule,
    PatientSchemaModule,
    PatientsModule,
    ThrottlerModule.forRootAsync({
      useFactory: (): ThrottlerModuleOptions => {
        const config = getPublicRegistrationThrottleConfig();
        return [{ name: 'default', ttl: config.ttlMs, limit: config.limit }];
      },
    }),
  ],
  controllers: [
    PublicPatientSelfRegistrationsController,
    PatientSelfRegistrationsController,
  ],
  providers: [
    PatientSelfRegistrationsService,
    PatientSelfRegistrationsRepository,
    ThrottlerGuard,
  ],
})
export class PatientSelfRegistrationsModule {}
