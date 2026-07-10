import { IsNotEmpty, IsString, Matches } from 'class-validator';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Validates the query string of `GET /billing/usage` (BAC-11, AC2):
 * `?tenantId=<id-or-slug>&period=YYYY-MM`. `period` is a calendar-month
 * bucket (UTC), the smallest granularity this ticket's aggregation needs;
 * see `billing-period.util.ts` for how it is turned into a concrete
 * `[start, endExclusive)` range.
 *
 * `tenantId` here is cross-checked by `UsageController` against the tenant
 * `TenantGuard` already resolved from `X-Tenant-Id` -- this DTO only proves
 * the query string is well-formed, not that it is authorized.
 */
export class UsageQueryDto {
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @IsString()
  @Matches(PERIOD_PATTERN, {
    message: 'period must be in YYYY-MM format (e.g. "2026-07")',
  })
  period!: string;
}
