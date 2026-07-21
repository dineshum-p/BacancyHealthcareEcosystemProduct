import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { TenantContextModule } from './tenant-context/tenant-context.module';
import { AuthModule } from './auth/auth.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AppointmentsModule } from './appointments/appointments.module';

@Module({
  imports: [
    DatabaseModule,
    TenantContextModule,
    AuthModule,
    AuditLogsModule,
    AppointmentsModule,
  ],
})
export class AppModule {}
