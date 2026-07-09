import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ItemsController } from './items.controller';
import { ItemsRepository } from './items.repository';
import { ItemsService } from './items.service';

@Module({
  // TenantsModule is imported directly (in addition to transitively via
  // TenantContextModule) because `@UseGuards(TenantGuard)` makes Nest
  // instantiate TenantGuard using THIS module's own injector; its
  // constructor dependency (TenantsRepository) must therefore be visible
  // here too, not just in the module that originally provides TenantGuard.
  imports: [TenantContextModule, TenantsModule],
  controllers: [ItemsController],
  providers: [ItemsService, ItemsRepository],
})
export class ItemsModule {}
