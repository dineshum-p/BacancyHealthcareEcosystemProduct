import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsClientModule } from '../notifications/notifications-client.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentsRepository } from './appointments.repository';
import { AppointmentSchemaModule } from './appointment-schema.module';

/**
 * `TenantContextModule`/`AuthModule` are imported directly (same reason
 * every other service's feature module does): `@UseGuards(TenantGuard,
 * AccessTokenGuard, PermissionsGuard)` makes Nest instantiate those guards
 * using THIS module's own injector, so their constructor dependencies must
 * be visible here too.
 *
 * `AuditLogsModule` provides the globally-registered `AuditLogInterceptor`
 * (`@Audited('Appointment')`). `NotificationsClientModule` provides
 * `NOTIFICATION_SERVICE_CLIENT` (BAC-16's confirmation-notification
 * integration).
 */
@Module({
  imports: [
    TenantContextModule,
    AuthModule,
    AuditLogsModule,
    NotificationsClientModule,
    AppointmentSchemaModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsRepository],
  exports: [AppointmentsService, AppointmentsRepository],
})
export class AppointmentsModule {}
