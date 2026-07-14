import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EventsModule } from '../events/events.module';
import { EmrSchemaModule } from '../fhir/emr-schema.module';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { EncountersRepository } from './encounters.repository';

/**
 * `TenantContextModule`/`AuthModule` are imported directly (same reason
 * `services/patient`'s `PatientsModule`/this service's own `PatientsModule`
 * import them alongside each other): `@UseGuards(TenantGuard,
 * AccessTokenGuard, PermissionsGuard)` makes Nest instantiate those guards
 * using THIS module's own injector, so their constructor dependencies must
 * be visible here too.
 *
 * `AuditLogsModule` provides the globally-registered `AuditLogInterceptor`
 * (`@Audited('Encounter')` on `EncountersController.create()`).
 * `EventsModule` provides `DOMAIN_EVENT_PUBLISHER` (BAC-15, AC4).
 * `EmrSchemaModule` provides `EmrSchemaProvisioner.ensureEncountersTable`.
 */
@Module({
  imports: [
    TenantContextModule,
    AuthModule,
    AuditLogsModule,
    EventsModule,
    EmrSchemaModule,
  ],
  controllers: [EncountersController],
  providers: [EncountersService, EncountersRepository],
  exports: [EncountersService, EncountersRepository],
})
export class EncountersModule {}
