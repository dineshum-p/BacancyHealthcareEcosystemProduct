import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import type { MeteredMetric } from '@hep/shared-types';
import { PG_POOL } from '../database/database.tokens';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { UsageEventRecord } from './usage-event.entity';

interface UsageEventRow {
  id: string;
  event_id: string;
  metric: string;
  quantity: number;
  occurred_at: Date;
  recorded_at: Date;
}

export interface RecordUsageEventInput {
  eventId: string;
  metric: MeteredMetric;
  quantity: number;
  /** ISO-8601 timestamp of when the underlying domain event occurred. */
  occurredAt: string;
}

export interface RecordUsageEventResult {
  record: UsageEventRecord;
  /**
   * `true` only when THIS call actually persisted a new row; `false` when
   * `eventId` had already been recorded by an earlier call (BAC-11, AC3) --
   * `record` is the ORIGINAL row in that case, not whatever payload this
   * (duplicate) call supplied.
   */
  wasNew: boolean;
}

/**
 * Data access for a tenant's `<schema>.usage_events` table (BAC-11).
 * Deliberately stores ONLY a tenant-scoped metric/quantity/timestamp --
 * NEVER a patient name, MRN, or any other resource-identifying detail --
 * so this table can never itself become a PHI/PII store: a metered event
 * like `patient.created` is recorded here as "quantity 1 of `patient.created`
 * at time T", not as "patient Jane Doe was created". This is a deliberate
 * design boundary for this ticket (see `@hep/shared-types`'
 * `MeteredDomainEvent` doc comment), motivated directly by BAC-10's
 * documented review finding about unencrypted PHI ending up somewhere it
 * shouldn't.
 *
 * Idempotency (AC3): `event_id` carries a UNIQUE constraint
 * (`BillingSchemaProvisioner.ensureUsageEventsTable`), and `recordIfNew`
 * always issues `INSERT ... ON CONFLICT (event_id) DO NOTHING` followed by
 * a `SELECT ... WHERE event_id = $1` -- NEVER relying on the INSERT
 * statement's own `rowCount`/`RETURNING` to decide whether a row was
 * actually persisted. This two-step approach was deliberately chosen after
 * discovering, while implementing this ticket, that `pg-mem` (this repo's
 * Postgres stand-in for tests) reports a "successful" `rowCount`/
 * `RETURNING` row even on a no-op `ON CONFLICT DO NOTHING` (a documented
 * pg-mem behavioural quirk, differing from real Postgres, which returns
 * zero affected/returned rows for a genuine no-op). Re-SELECTing by
 * `event_id` afterwards is correct against BOTH engines and is what
 * actually guarantees "the same event id is never double-counted", not an
 * artifact of either engine's specific (and here, divergent) handling of
 * `RETURNING`.
 */
@Injectable()
export class UsageEventsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async recordIfNew(
    schemaName: string,
    input: RecordUsageEventInput,
  ): Promise<RecordUsageEventResult> {
    const schema = quoteSchemaIdentifier(schemaName);
    const candidateId = randomUUID();

    await this.pool.query(
      `INSERT INTO ${schema}.usage_events (id, event_id, metric, quantity, occurred_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        candidateId,
        input.eventId,
        input.metric,
        input.quantity,
        input.occurredAt,
      ],
    );

    const result: QueryResult<UsageEventRow> = await this.pool.query(
      `SELECT id, event_id, metric, quantity, occurred_at, recorded_at
       FROM ${schema}.usage_events
       WHERE event_id = $1
       LIMIT 1`,
      [input.eventId],
    );
    const row = result.rows[0];
    if (!row) {
      // Unreachable in practice (the INSERT above always leaves a matching
      // row, whether it wrote one or a prior call already did) -- guarded
      // defensively rather than allowing a silent `undefined` to propagate.
      throw new Error(
        `Failed to record usage event "${input.eventId}": no row found after insert.`,
      );
    }

    return {
      record: this.toEntity(row),
      wasNew: row.id === candidateId,
    };
  }

  /**
   * Sums `quantity` per metric for every usage event whose `occurred_at`
   * falls within `[periodStart, periodEndExclusive)` (BAC-11, AC2).
   * Duplicate `event_id`s can never inflate this total: `recordIfNew`
   * guarantees at most one row per `event_id` ever exists.
   */
  async sumByMetric(
    schemaName: string,
    periodStart: Date,
    periodEndExclusive: Date,
  ): Promise<Map<MeteredMetric, number>> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result = await this.pool.query<{ metric: string; total: string }>(
      `SELECT metric, SUM(quantity)::text AS total
       FROM ${schema}.usage_events
       WHERE occurred_at >= $1 AND occurred_at < $2
       GROUP BY metric`,
      [periodStart.toISOString(), periodEndExclusive.toISOString()],
    );

    const totals = new Map<MeteredMetric, number>();
    for (const row of result.rows) {
      totals.set(row.metric as MeteredMetric, Number(row.total));
    }
    return totals;
  }

  private toEntity(row: UsageEventRow): UsageEventRecord {
    return {
      id: row.id,
      eventId: row.event_id,
      metric: row.metric as MeteredMetric,
      quantity: row.quantity,
      occurredAt: row.occurred_at,
      recordedAt: row.recorded_at,
    };
  }
}
