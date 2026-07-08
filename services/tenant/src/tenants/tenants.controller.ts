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
import { Tenant } from './tenant.entity';
import { TenantsService } from './tenants.service';

/**
 * Thin controller: validation via `CreateTenantDto` + delegation to
 * `TenantsService`. Deliberately NOT guarded by `TenantGuard` -- tenant
 * onboarding happens before a tenant identifier can be resolved.
 */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTenantDto): Promise<Tenant> {
    return this.tenantsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Tenant> {
    return this.tenantsService.findById(id);
  }
}
