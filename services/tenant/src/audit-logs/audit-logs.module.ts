import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLogsRoleGuard } from './audit-logs-role.guard';
import { AuditLogInterceptor } from './audit-log.interceptor';

/**
 * BAC-8: wires the audit-log domain together and registers
 * `AuditLogInterceptor` as a GLOBAL interceptor (`APP_INTERCEPTOR`) so
 * `@Audited(...)` works on any controller in this service, not just the
 * ones registered here -- the whole point of the generic mechanism (AC3).
 *
 * `TenantContextModule`/`TenantsModule`/`AuthModule` are imported directly
 * (not just transitively) for the same reason `ItemsModule`/`AuthModule`
 * (in `services/auth`) already do: `@UseGuards(TenantGuard, AccessTokenGuard,
 * ...)` makes Nest instantiate those guards using THIS module's own
 * injector, so their constructor dependencies must be visible here too.
 */
@Module({
  imports: [TenantContextModule, TenantsModule, AuthModule],
  controllers: [AuditLogsController],
  providers: [
    AuditLogsService,
    AuditLogsRepository,
    AuditLogsRoleGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AuditLogsModule {}
