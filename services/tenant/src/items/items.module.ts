import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthModule } from '../auth/auth.module';
import { ItemsController } from './items.controller';
import { ItemsRepository } from './items.repository';
import { ItemsService } from './items.service';

@Module({
  // TenantsModule/AuthModule are imported directly (in addition to
  // transitively via TenantContextModule) because
  // `@UseGuards(TenantGuard)` / `@UseGuards(AccessTokenGuard)` make Nest
  // instantiate those guards using THIS module's own injector; their
  // constructor dependencies (TenantsRepository, AccessTokenService) must
  // therefore be visible here too, not just in the module that originally
  // provides the guard.
  imports: [TenantContextModule, TenantsModule, AuthModule],
  controllers: [ItemsController],
  providers: [ItemsService, ItemsRepository],
})
export class ItemsModule {}
