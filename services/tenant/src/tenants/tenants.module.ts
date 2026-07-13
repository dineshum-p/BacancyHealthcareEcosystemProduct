import { Module } from '@nestjs/common';
import { TenantsRepository } from './tenants.repository';
import { TenantSchemaProvisioner } from './provisioning/tenant-schema-provisioner';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';

@Module({
  controllers: [TenantsController],
  providers: [TenantsRepository, TenantSchemaProvisioner, TenantsService],
  // BAC-12: `TenantsService` is exported so `OnboardingModule` can reuse its
  // `create()` provisioning logic (BAC-3) rather than duplicating it.
  exports: [TenantsRepository, TenantSchemaProvisioner, TenantsService],
})
export class TenantsModule {}
