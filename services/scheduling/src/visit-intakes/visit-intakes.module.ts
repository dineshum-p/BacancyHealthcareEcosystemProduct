import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AppointmentSchemaModule } from '../appointments/appointment-schema.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { VisitIntakesController } from './visit-intakes.controller';
import { VisitIntakesService } from './visit-intakes.service';
import { VisitIntakesRepository } from './visit-intakes.repository';
import { VisitIntakeSchemaProvisioner } from './visit-intake-schema.provisioner';

/**
 * `TenantContextModule`/`AuthModule` are imported directly (same reason
 * every other service's feature module does): `@UseGuards(TenantGuard,
 * AccessTokenGuard, PermissionsGuard)` makes Nest instantiate those guards
 * using THIS module's own injector, so their constructor dependencies must
 * be visible here too.
 *
 * `AuditLogsModule` provides the globally-registered `AuditLogInterceptor`
 * (`@Audited('VisitIntake')`). `AppointmentSchemaModule` provides
 * `AppointmentSchemaProvisioner` (needed so `VisitIntakesService.link` can
 * `ensureAppointmentsTable` before validating the linked appointment).
 * `AppointmentsModule` provides `AppointmentsRepository` (that same
 * validation) -- both are separate imports because `AppointmentsModule`
 * does not itself re-export `AppointmentSchemaModule`'s providers to its own
 * consumers.
 */
@Module({
  imports: [
    TenantContextModule,
    AuthModule,
    AuditLogsModule,
    AppointmentSchemaModule,
    AppointmentsModule,
  ],
  controllers: [VisitIntakesController],
  providers: [
    VisitIntakesService,
    VisitIntakesRepository,
    VisitIntakeSchemaProvisioner,
  ],
  exports: [VisitIntakesService, VisitIntakesRepository],
})
export class VisitIntakesModule {}
