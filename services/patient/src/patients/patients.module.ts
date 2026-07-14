import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EventsModule } from '../events/events.module';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PatientsRepository } from './patients.repository';
import { PatientSchemaModule } from './patient-schema.module';

/**
 * `TenantContextModule`/`AuthModule` are imported directly (same reason
 * `services/emr`'s `PatientsModule`/`services/billing`'s `UsageModule`
 * import them alongside each other):
 * `@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)` makes Nest
 * instantiate those guards using THIS module's own injector, so their
 * constructor dependencies must be visible here too.
 *
 * `AuditLogsModule` provides the globally-registered `AuditLogInterceptor`
 * (`@Audited('Patient')` on `PatientsController.create()`). `EventsModule`
 * provides `DOMAIN_EVENT_PUBLISHER` (BAC-14, AC4).
 */
@Module({
  imports: [
    TenantContextModule,
    AuthModule,
    AuditLogsModule,
    EventsModule,
    PatientSchemaModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService, PatientsRepository],
  exports: [PatientsService, PatientsRepository],
})
export class PatientsModule {}
