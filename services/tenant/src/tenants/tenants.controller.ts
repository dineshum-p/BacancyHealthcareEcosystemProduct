import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
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
