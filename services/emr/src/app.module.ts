import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { TenantContextModule } from './tenant-context/tenant-context.module';
import { AuthModule } from './auth/auth.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { PatientsModule } from './fhir/patients.module';
import { EncountersModule } from './encounters/encounters.module';
import { PatientProfileModule } from './patient-profile/patient-profile.module';

@Module({
  imports: [
    DatabaseModule,
    TenantContextModule,
    AuthModule,
    AuditLogsModule,
    PatientsModule,
    EncountersModule,
    PatientProfileModule,
  ],
})
export class AppModule {}
