import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantGuard } from './tenant.guard';
import { TenantContextService } from './tenant-context.service';

@Module({
  imports: [TenantsModule],
  providers: [TenantGuard, TenantContextService],
  exports: [TenantGuard, TenantContextService, TenantsModule],
})
export class TenantContextModule {}
