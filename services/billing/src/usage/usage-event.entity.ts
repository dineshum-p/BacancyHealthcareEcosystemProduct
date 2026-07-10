import type { MeteredMetric } from '@hep/shared-types';

/** A row in a tenant's `<schema>.usage_events` table (BAC-11). */
export interface UsageEventRecord {
  id: string;
  eventId: string;
  metric: MeteredMetric;
  quantity: number;
  occurredAt: Date;
  recordedAt: Date;
}
