import type { MeteredMetric } from '@hep/shared-types';

/**
 * The closed catalog of metrics `services/billing` currently meters
 * (BAC-11, AC1). Kept as a runtime array (class-validator's `@IsIn` needs a
 * concrete list, not just a compile-time type) alongside
 * `@hep/shared-types`' `MeteredMetric` union -- extend BOTH together, plus
 * `billing-plan-limits.map.ts`, when a new billable domain event is added.
 */
export const METERED_METRICS: readonly MeteredMetric[] = [
  'patient.created',
  'encounter.created',
];
