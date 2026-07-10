import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { TenantsModule } from './tenants/tenants.module';
import { TenantContextModule } from './tenant-context/tenant-context.module';
import { ItemsModule } from './items/items.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';

@Module({
  imports: [
    DatabaseModule,
    TenantsModule,
    TenantContextModule,
    ItemsModule,
    AuditLogsModule,
  ],
})
export class AppModule {}
