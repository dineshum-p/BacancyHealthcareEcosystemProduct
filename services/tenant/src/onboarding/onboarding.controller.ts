import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  OnboardTenantResponse,
  PricingQuote,
  TenantSummary,
} from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { Audited } from '../audit-logs/audited.decorator';
import { TenantsService } from '../tenants/tenants.service';
import { toTenantResponseDto } from '../tenants/dto/tenant-response.dto';
import { PricingService } from '../pricing/pricing.service';
import { PricingQuoteQueryDto } from '../pricing/dto/pricing-quote-query.dto';
import { OnboardingService } from './onboarding.service';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';

/**
 * The Super Admin console's tenant endpoints (BAC-12): listing every tenant
 * (AC3) and onboarding a new one (AC1/AC2). A second `@Controller('tenants')`
 * alongside `TenantsController` -- Nest allows multiple controller classes
 * to register routes under the same path prefix as long as the routes
 * themselves don't collide, and keeping this cluster of guarded,
 * authenticated, Super-Admin-only routes physically separate from
 * `TenantsController`'s deliberately UNAUTHENTICATED bootstrap routes
 * (`POST /tenants`, `GET /tenants/:id` -- see that controller's doc comment)
 * keeps each controller's trust model unambiguous at a glance.
 *
 * Guard order mirrors `AuditLogsController`/`AuditLogsRoleGuard` exactly:
 *   1. `TenantGuard` resolves `request.tenant` from `X-Tenant-Id` -- for
 *      these routes, that's the CALLING Super Admin's own (existing, active)
 *      tenant, not any tenant being onboarded.
 *   2. `AccessTokenGuard` verifies the bearer token and cross-checks its
 *      `tenantId` claim against `request.tenant`.
 *   3. `SuperAdminGuard` requires `role: 'super_admin'` (403 otherwise, AC4).
 */
@UseGuards(TenantGuard, AccessTokenGuard, SuperAdminGuard)
@Controller('tenants')
export class OnboardingController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly onboardingService: OnboardingService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Subscription pricing quote for a prospective module selection + tier
   * (PRD Section 6). Backs the onboarding form's live pricing summary so the
   * Super Admin sees the one-time onboarding total (with multi-module
   * discount) and monthly platform fee before submitting. Reference-data
   * only -- no tenant is created or read here -- but kept behind the same
   * super_admin guard chain as the rest of the console.
   */
  @Get('pricing/quote')
  quote(@Query() query: PricingQuoteQueryDto): PricingQuote {
    return this.pricingService.quote(query.modules, query.planTier);
  }

  /** BAC-12, AC3: every tenant, for the Super Admin console's tenant-list page (status + provisioning result). */
  @Get()
  async list(): Promise<TenantSummary[]> {
    const tenants = await this.tenantsService.findAll();
    return tenants.map((tenant) => toTenantResponseDto(tenant));
  }

  /**
   * BAC-12, AC1/AC2: provisions a tenant, seeds its first `clinic_admin`,
   * and queues that admin an invite, in one orchestrated call -- see
   * `OnboardingService`'s doc comment for the full design and
   * partial-failure policy.
   *
   * `@Audited('tenant')` (BAC-8 reuse, AC/f): recorded into the CALLING
   * Super Admin's OWN tenant's audit log (via `request.tenant`, already
   * resolved by `TenantGuard`) -- `actorUserId` is real here (unlike
   * `TenantsController.create`'s bootstrap case), since this route always
   * has an authenticated caller.
   */
  @Post('onboard')
  @Audited('tenant')
  @HttpCode(HttpStatus.CREATED)
  async onboard(@Body() dto: OnboardTenantDto): Promise<OnboardTenantResponse> {
    return this.onboardingService.onboard(dto);
  }
}
