import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppointmentSchemaModule } from '../appointments/appointment-schema.module';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLogInterceptor } from './audit-log.interceptor';

/**
 * Wires the audit-log domain together and registers `AuditLogInterceptor`
 * as a GLOBAL interceptor (`APP_INTERCEPTOR`) so `@Audited(...)` works on
 * any controller in this service -- reusing `services/tenant`'s BAC-8
 * mechanism (see that decorator/interceptor's doc comments for why it is
 * duplicated, not literally imported, across services).
 */
@Module({
  imports: [AppointmentSchemaModule],
  providers: [
    AuditLogsService,
    AuditLogsRepository,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [AuditLogsService, AuditLogsRepository],
})
export class AuditLogsModule {}
