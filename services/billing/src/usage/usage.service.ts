import { Injectable } from '@nestjs/common';
import type {
  MeteredDomainEvent,
  UsageEventResponse,
  UsageMetricTotal,
  UsageSummaryResponse,
} from '@hep/shared-types';
import { UsageEventsRepository } from './usage-events.repository';
import { BillingSchemaProvisioner } from './billing-schema.provisioner';
import { METERED_METRICS } from './metered-metrics';
import { getLimitForMetric } from './billing-plan-limits.map';
import { parseBillingPeriod } from './billing-period.util';

/**
 * Core usage-metering logic (BAC-11), deliberately schema-explicit (same
 * convention every other schema-scoped service class in this repo uses --
 * see `services/emr`'s `PatientsService` doc comment) rather than
 * request-scoped, so it is testable independently of any HTTP request and
 * reusable by a future non-HTTP caller (e.g. a real event-bus consumer,
 * once one exists -- see `usage.controller.ts`'s doc comment for the
 * documented scope boundary this ticket follows).
 */
@Injectable()
export class UsageService {
  constructor(
    private readonly usageEventsRepository: UsageEventsRepository,
    private readonly schemaProvisioner: BillingSchemaProvisioner,
  ) {}

  /**
   * AC1/AC3: records a metered domain event for a tenant, idempotently on
   * `event.eventId`. Recording the SAME `eventId` more than once returns the
   * ORIGINALLY recorded values (never double-counted) -- see
   * `UsageEventsRepository.recordIfNew`'s doc comment for the full
   * idempotency mechanism.
   */
  async recordEvent(
    schemaName: string,
    event: MeteredDomainEvent,
  ): Promise<UsageEventResponse> {
    await this.schemaProvisioner.ensureUsageEventsTable(schemaName);

    const { record } = await this.usageEventsRepository.recordIfNew(
      schemaName,
      {
        eventId: event.eventId,
        metric: event.metric,
        quantity: event.quantity,
        occurredAt: event.occurredAt,
      },
    );

    return {
      id: record.id,
      eventId: record.eventId,
      tenantId: event.tenantId,
      metric: record.metric,
      quantity: record.quantity,
      occurredAt: record.occurredAt.toISOString(),
      recordedAt: record.recordedAt.toISOString(),
    };
  }

  /**
   * AC2/AC4: aggregated usage totals per metric for `period` (`YYYY-MM`),
   * zero-filled for every metric this service knows about (not just the
   * ones with recorded usage, so a billing dashboard always sees the full
   * picture), each flagged against the tenant's `plan`-defined limit.
   */
  async getUsageSummary(
    schemaName: string,
    tenantId: string,
    plan: string,
    period: string,
  ): Promise<UsageSummaryResponse> {
    await this.schemaProvisioner.ensureUsageEventsTable(schemaName);

    const { start, endExclusive } = parseBillingPeriod(period);
    const totals = await this.usageEventsRepository.sumByMetric(
      schemaName,
      start,
      endExclusive,
    );

    const metrics: UsageMetricTotal[] = METERED_METRICS.map((metric) => {
      const quantity = totals.get(metric) ?? 0;
      const limit = getLimitForMetric(plan, metric);
      return {
        metric,
        quantity,
        limit,
        limitExceeded: limit !== null && quantity >= limit,
      };
    });

    return { tenantId, period, metrics };
  }
}
