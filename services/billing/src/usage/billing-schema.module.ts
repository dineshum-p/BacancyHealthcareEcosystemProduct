import { Module } from '@nestjs/common';
import { BillingSchemaProvisioner } from './billing-schema.provisioner';

/**
 * Isolated so `BillingSchemaProvisioner` can be shared between `UsageModule`
 * (which needs `ensureUsageEventsTable`) and `AuditLogsModule` (which needs
 * `ensureAuditLogsTable`) WITHOUT either module importing the other --
 * `UsageModule` already imports `AuditLogsModule` for the globally
 * -registered `AuditLogInterceptor`, so `AuditLogsModule` importing
 * `UsageModule` back would be circular. Mirrors `services/emr`'s
 * `EmrSchemaModule` exactly.
 */
@Module({
  providers: [BillingSchemaProvisioner],
  exports: [BillingSchemaProvisioner],
})
export class BillingSchemaModule {}
