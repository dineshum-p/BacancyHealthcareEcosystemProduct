import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EmrSchemaModule } from '../fhir/emr-schema.module';
import { PatientsModule } from '../fhir/patients.module';
import { PatientProfileController } from './patient-profile.controller';
import { PatientProfileService } from './patient-profile.service';
import { PatientProfileRepository } from './patient-profile.repository';

/**
 * `TenantContextModule`/`AuthModule` are imported directly (same reason
 * `EncountersModule` imports them alongside each other -- see that module's
 * doc comment): `@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)`
 * makes Nest instantiate those guards using THIS module's own injector.
 *
 * `AuditLogsModule` provides the globally-registered `AuditLogInterceptor`
 * (`@Audited('PatientProfile')` on `PatientProfileController.upsert()`).
 * `EmrSchemaModule` provides `EmrSchemaProvisioner.ensurePatientProfilesTable`/
 * `ensurePatientsTable` (the SAME singleton `EncountersModule`/`PatientsModule`
 * already import). `PatientsModule` provides `PatientsRepository.findById`,
 * reused here (not reimplemented) for the same-schema demographics lookup
 * `PatientProfileService` performs -- see that service's/
 * `demographics.util.ts`'s doc comments for the documented scope boundary of
 * that lookup.
 */
@Module({
  imports: [
    TenantContextModule,
    AuthModule,
    AuditLogsModule,
    EmrSchemaModule,
    PatientsModule,
  ],
  controllers: [PatientProfileController],
  providers: [PatientProfileService, PatientProfileRepository],
  exports: [PatientProfileService, PatientProfileRepository],
})
export class PatientProfileModule {}
