import { Module } from '@nestjs/common';
import { AppointmentSchemaProvisioner } from './appointment-schema.provisioner';

/**
 * Isolated so `AppointmentSchemaProvisioner` can be shared between
 * `AppointmentsModule` (which needs `ensureAppointmentsTable`) and
 * `AuditLogsModule` (which needs `ensureAuditLogsTable`) WITHOUT either
 * module importing the other -- `AppointmentsModule` already imports
 * `AuditLogsModule` for the globally-registered `AuditLogInterceptor`, so
 * `AuditLogsModule` importing `AppointmentsModule` back would be circular.
 * Mirrors `services/patient`'s `PatientSchemaModule`/`services/emr`'s
 * `EmrSchemaModule`/`services/billing`'s `BillingSchemaModule` exactly.
 */
@Module({
  providers: [AppointmentSchemaProvisioner],
  exports: [AppointmentSchemaProvisioner],
})
export class AppointmentSchemaModule {}
