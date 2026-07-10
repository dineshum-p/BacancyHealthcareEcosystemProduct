import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  UsageEventResponse,
  UsageSummaryResponse,
} from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { Audited } from '../audit-logs/audited.decorator';
import { UsageService } from './usage.service';
import { RecordUsageEventDto } from './dto/record-usage-event.dto';
import { UsageQueryDto } from './dto/usage-query.dto';

/**
 * Thin controller: validation via `RecordUsageEventDto`/`UsageQueryDto`
 * (class-validator) + delegation to `UsageService`. Guarded by `TenantGuard`
 * -> `AccessTokenGuard` -> `PermissionsGuard` on both routes (BAC-11),
 * reusing BAC-4's tenant-context mechanism and BAC-7's `PermissionsGuard`/
 * `@RequirePermissions` mechanism rather than reimplementing either (same
 * convention `services/emr`'s `PatientsController` established for BAC-10).
 *
 * `POST /billing/usage/events` (AC1) is this ticket's answer to "consumes
 * metered domain events": **no service in this repo publishes a
 * `patient.created`/`encounter.created` event onto a real broker today**
 * (see `@hep/shared-types`' `MeteredDomainEvent` doc comment and
 * `services/notification/src/notifications/events/README.md` for the
 * established scope boundary this ticket follows). This endpoint IS the
 * documented ingestion method a future publisher would call -- an ordinary,
 * fully-tested, guarded REST endpoint accepting the `MeteredDomainEvent`
 * contract shape, rather than a new message-broker integration this ticket
 * was explicitly told not to invent.
 */
@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)
@Controller('billing/usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  /**
   * AC1/AC3: records one metered usage event for the resolved tenant,
   * idempotently on `eventId`. Audited (BAC-8's mechanism, reused -- see
   * `audit-logs/` doc comments) since this is a mutation.
   */
  @Audited('UsageEvent')
  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.RECORD_USAGE)
  async recordEvent(
    @Req() request: RequestWithTenant,
    @Body() dto: RecordUsageEventDto,
  ): Promise<UsageEventResponse> {
    const tenant = requireTenant(request);
    assertTenantMatches(tenant, dto.tenantId);
    return this.usageService.recordEvent(tenant.schemaName, dto);
  }

  /** AC2/AC4: aggregated usage totals per metric for `period`, flagged against the tenant's plan limits. */
  @Get()
  @RequirePermissions(Permission.READ_USAGE)
  async getUsageSummary(
    @Req() request: RequestWithTenant,
    @Query() query: UsageQueryDto,
  ): Promise<UsageSummaryResponse> {
    const tenant = requireTenant(request);
    assertTenantMatches(tenant, query.tenantId);
    return this.usageService.getUsageSummary(
      tenant.schemaName,
      tenant.id,
      tenant.plan,
      query.period,
    );
  }
}

/** `TenantGuard` always runs before the handler and always sets `request.tenant` on success (or throws). */
function requireTenant(
  request: RequestWithTenant,
): NonNullable<RequestWithTenant['tenant']> {
  if (!request.tenant) {
    throw new Error(
      'request.tenant was not set -- protect this route with TenantGuard.',
    );
  }
  return request.tenant;
}

/**
 * Defense-in-depth tenant isolation (CLAUDE.md: "never cross-tenant
 * queries"): every `/billing/usage*` route is already scoped to the tenant
 * `TenantGuard` resolved from `X-Tenant-Id` (or subdomain), so the
 * `tenantId` this ticket's AC also asks for on the request body/query
 * string must refer to that SAME tenant -- either by id or by slug (the
 * same two identifiers `TenantGuard`/`resolveTenantIdentifier` itself
 * accepts) -- never a different one. A mismatch is rejected with 403,
 * never silently redirected to whichever tenant the caller claimed.
 */
function assertTenantMatches(
  tenant: NonNullable<RequestWithTenant['tenant']>,
  claimedTenantId: string,
): void {
  if (claimedTenantId !== tenant.id && claimedTenantId !== tenant.slug) {
    throw new ForbiddenException(
      'tenantId does not match the tenant resolved from X-Tenant-Id.',
    );
  }
}
