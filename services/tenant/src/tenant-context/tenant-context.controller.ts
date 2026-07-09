import { Controller, Get, UseGuards } from '@nestjs/common';
import type { TenantResponseDto } from '../tenants/dto/tenant-response.dto';
import { toTenantResponseDto } from '../tenants/dto/tenant-response.dto';
import { TenantContextService } from './tenant-context.service';
import { TenantGuard } from './tenant.guard';

/**
 * Thin controller demonstrating that the resolved tenant context is
 * available to consumers via the typed, request-scoped
 * `TenantContextService` (AC4).
 *
 * BAC-7 review (3rd leak point): `TenantGuard` only resolves/validates a
 * tenant from `X-Tenant-Id`/subdomain -- it does NOT check user identity,
 * and there is no `AccessTokenGuard`/global auth guard anywhere in this
 * service. That makes this route reachable by anyone who knows/guesses a
 * tenant's slug or id, so -- exactly like `TenantsController` -- the
 * response is mapped through the same `toTenantResponseDto` allow-list
 * mapper before it goes on the wire, stripping `Tenant.ownerEmail`. See
 * `tenant-response.dto.ts`'s doc comment for why leaking it here would
 * undermine BAC-7's bootstrap-admin fix entirely.
 */
@UseGuards(TenantGuard)
@Controller('tenant-context')
export class TenantContextController {
  constructor(private readonly tenantContextService: TenantContextService) {}

  @Get('me')
  getCurrentTenant(): TenantResponseDto {
    return toTenantResponseDto(this.tenantContextService.getTenant());
  }
}
