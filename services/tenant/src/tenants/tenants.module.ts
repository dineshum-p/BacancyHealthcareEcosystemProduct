import { Module } from '@nestjs/common';
import { TenantsRepository } from './tenants.repository';
import { TenantSchemaProvisioner } from './provisioning/tenant-schema-provisioner';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';

@Module({
  controllers: [TenantsController],
  providers: [TenantsRepository, TenantSchemaProvisioner, TenantsService],
  exports: [TenantsRepository, TenantSchemaProvisioner],
})
export class TenantsModule {}
