import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';
import type { MeteredDomainEvent, MeteredMetric } from '@hep/shared-types';
import { METERED_METRICS } from '../metered-metrics';

/**
 * Validates the body of `POST /billing/usage/events` (BAC-11, AC1) against
 * the `MeteredDomainEvent` CONTRACT documented in `@hep/shared-types` -- the
 * shape a future domain-event publisher would produce. See that type's doc
 * comment and this service's `usage.controller.ts` for the full "no real
 * broker yet" scope boundary this ticket follows (mirrors
 * `services/notification`'s BAC-9 `UserRegisteredEvent`/
 * `services/emr`'s BAC-10 `PatientCreatedEvent` precedent).
 *
 * `tenantId` is required on the body (part of the documented event
 * contract) AND is cross-checked by `UsageController` against the tenant
 * `TenantGuard` already resolved from `X-Tenant-Id` -- a caller can never
 * record usage into a tenant schema other than the one it authenticated
 * against, even if the body claims a different `tenantId`.
 */
export class RecordUsageEventDto implements MeteredDomainEvent {
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @IsIn(METERED_METRICS)
  metric!: MeteredMetric;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsISO8601()
  occurredAt!: string;
}
