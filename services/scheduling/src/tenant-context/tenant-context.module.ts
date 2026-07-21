import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantGuard } from './tenant.guard';

@Module({
  imports: [TenantsModule],
  providers: [TenantGuard],
  exports: [TenantGuard, TenantsModule],
})
export class TenantContextModule {}
