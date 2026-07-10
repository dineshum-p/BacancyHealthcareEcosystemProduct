/** A concrete, half-open date range (`[start, endExclusive)`) a billing period resolves to. */
export interface BillingPeriodRange {
  start: Date;
  endExclusive: Date;
}

/**
 * Turns a `YYYY-MM` billing period (BAC-11, AC2) into the concrete UTC
 * calendar-month `[start, endExclusive)` range `UsageEventsRepository.
 * sumByMetric` aggregates over. Assumes the input already matches
 * `UsageQueryDto`'s `period` format (validated by the global
 * `ValidationPipe` before this is ever called) -- still throws defensively
 * on a malformed value rather than silently producing a nonsensical range.
 */
export function parseBillingPeriod(period: string): BillingPeriodRange {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) {
    throw new Error(`Invalid billing period "${period}"; expected YYYY-MM.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid billing period "${period}"; month must be 01-12.`);
  }

  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    // `Date.UTC(year, 12, 1)` correctly rolls over into January of `year + 1`.
    endExclusive: new Date(Date.UTC(year, month, 1)),
  };
}
