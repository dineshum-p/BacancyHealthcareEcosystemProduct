import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { UsageEventsRepository } from './usage-events.repository';
import { BillingSchemaModule } from './billing-schema.module';

/**
 * `TenantContextModule`/`AuthModule` are imported directly (same reason
 * `services/emr`'s `PatientsModule` imports them alongside each other):
 * `@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)` makes Nest
 * instantiate those guards using THIS module's own injector, so their
 * constructor dependencies must be visible here too.
 *
 * `AuditLogsModule` provides the globally-registered `AuditLogInterceptor`
 * (`@Audited('UsageEvent')` on `UsageController.recordEvent()`).
 */
@Module({
  imports: [
    TenantContextModule,
    AuthModule,
    AuditLogsModule,
    BillingSchemaModule,
  ],
  controllers: [UsageController],
  providers: [UsageService, UsageEventsRepository],
  exports: [UsageService, UsageEventsRepository],
})
export class UsageModule {}
