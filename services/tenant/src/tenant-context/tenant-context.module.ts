import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantContextController } from './tenant-context.controller';
import { TenantContextService } from './tenant-context.service';
import { TenantGuard } from './tenant.guard';

@Module({
  imports: [TenantsModule],
  controllers: [TenantContextController],
  providers: [TenantGuard, TenantContextService],
  exports: [TenantGuard, TenantContextService],
})
export class TenantContextModule {}
