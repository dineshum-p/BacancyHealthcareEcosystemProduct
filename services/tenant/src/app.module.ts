import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { TenantsModule } from './tenants/tenants.module';
import { TenantContextModule } from './tenant-context/tenant-context.module';
import { ItemsModule } from './items/items.module';

@Module({
  imports: [DatabaseModule, TenantsModule, TenantContextModule, ItemsModule],
})
export class AppModule {}
