import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { TenantContextModule } from './tenant-context/tenant-context.module';
import { AuthModule } from './auth/auth.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { PatientsModule } from './fhir/patients.module';

@Module({
  imports: [
    DatabaseModule,
    TenantContextModule,
    AuthModule,
    AuditLogsModule,
    PatientsModule,
  ],
})
export class AppModule {}
