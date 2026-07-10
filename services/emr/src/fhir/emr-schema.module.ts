import { Module } from '@nestjs/common';
import { EmrSchemaProvisioner } from './emr-schema.provisioner';

/**
 * Isolated so `EmrSchemaProvisioner` can be shared between `PatientsModule`
 * (which needs `ensurePatientsTable`) and `AuditLogsModule` (which needs
 * `ensureAuditLogsTable`) WITHOUT either module importing the other --
 * `PatientsModule` already imports `AuditLogsModule` for the globally
 * -registered `AuditLogInterceptor`, so `AuditLogsModule` importing
 * `PatientsModule` back would be circular.
 */
@Module({
  providers: [EmrSchemaProvisioner],
  exports: [EmrSchemaProvisioner],
})
export class EmrSchemaModule {}
