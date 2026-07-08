import { Module } from '@nestjs/common';
import { TenantsRepository } from './tenants.repository';
import { TenantSchemaProvisioner } from './provisioning/tenant-schema-provisioner';

@Module({
  providers: [TenantsRepository, TenantSchemaProvisioner],
  exports: [TenantsRepository, TenantSchemaProvisioner],
})
export class TenantsModule {}
