import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PatientsRepository } from './patients.repository';
import { EmrSchemaModule } from './emr-schema.module';

/**
 * `TenantContextModule`/`AuthModule` are imported directly (same reason
 * `services/notification`'s `NotificationsModule` imports them alongside
 * each other): `@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)`
 * makes Nest instantiate those guards using THIS module's own injector, so
 * their constructor dependencies must be visible here too.
 *
 * `AuditLogsModule` provides the globally-registered `AuditLogInterceptor`
 * (`@Audited('Patient')` on `PatientsController.create()`).
 */
@Module({
  imports: [TenantContextModule, AuthModule, AuditLogsModule, EmrSchemaModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientsRepository],
  exports: [PatientsService, PatientsRepository],
})
export class PatientsModule {}
