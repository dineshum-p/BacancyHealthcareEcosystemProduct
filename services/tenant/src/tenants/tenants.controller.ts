import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Audited } from '../audit-logs/audited.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import {
  TenantResponseDto,
  toTenantResponseDto,
} from './dto/tenant-response.dto';
import { TenantsService } from './tenants.service';

/**
 * Thin controller: validation via `CreateTenantDto` + delegation to
 * `TenantsService`. Deliberately NOT guarded by `TenantGuard` -- tenant
 * onboarding happens before a tenant identifier can be resolved.
 *
 * BAC-7 review: because both endpoints below are unauthenticated, every
 * response is mapped through `toTenantResponseDto` before it goes on the
 * wire, which strips `Tenant.ownerEmail` -- see that DTO's doc comment for
 * why leaking it here would undermine BAC-7's bootstrap-admin fix entirely.
 */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * BAC-8, AC1/AC4: `@Audited('tenant')` records this creation in the newly
   * -created tenant's OWN audit log (there is no tenant to authenticate
   * against yet during onboarding, so `actorUserId` is honestly `null` --
   * see `resolveAuditTarget`'s doc comment for how `AuditLogInterceptor`
   * resolves which schema to write into when no tenant is resolved on the
   * request yet). `before: null` because a creation has no prior state.
   */
  @Audited('tenant')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTenantDto): Promise<TenantResponseDto> {
    const tenant = await this.tenantsService.create(dto);
    return toTenantResponseDto(tenant);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<TenantResponseDto> {
    const tenant = await this.tenantsService.findById(id);
    return toTenantResponseDto(tenant);
  }
}
