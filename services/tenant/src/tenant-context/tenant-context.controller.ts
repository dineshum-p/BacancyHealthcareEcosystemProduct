import { Controller, Get, UseGuards } from '@nestjs/common';
import type { Tenant } from '../tenants/tenant.entity';
import { TenantContextService } from './tenant-context.service';
import { TenantGuard } from './tenant.guard';

/**
 * Thin controller demonstrating that the resolved tenant context is
 * available to consumers via the typed, request-scoped
 * `TenantContextService` (AC4).
 */
@UseGuards(TenantGuard)
@Controller('tenant-context')
export class TenantContextController {
  constructor(private readonly tenantContextService: TenantContextService) {}

  @Get('me')
  getCurrentTenant(): Tenant {
    return this.tenantContextService.getTenant();
  }
}
