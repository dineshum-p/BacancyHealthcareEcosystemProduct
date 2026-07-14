import { Module } from '@nestjs/common';
import { PatientSchemaProvisioner } from './patient-schema.provisioner';

/**
 * Isolated so `PatientSchemaProvisioner` can be shared between
 * `PatientsModule` (which needs `ensurePatientsTable`) and `AuditLogsModule`
 * (which needs `ensureAuditLogsTable`) WITHOUT either module importing the
 * other -- `PatientsModule` already imports `AuditLogsModule` for the
 * globally-registered `AuditLogInterceptor`, so `AuditLogsModule` importing
 * `PatientsModule` back would be circular. Mirrors `services/emr`'s
 * `EmrSchemaModule`/`services/billing`'s `BillingSchemaModule` exactly.
 */
@Module({
  providers: [PatientSchemaProvisioner],
  exports: [PatientSchemaProvisioner],
})
export class PatientSchemaModule {}
