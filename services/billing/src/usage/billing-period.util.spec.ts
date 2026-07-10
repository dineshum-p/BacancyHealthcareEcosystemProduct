import { parseBillingPeriod } from './billing-period.util';

describe('parseBillingPeriod', () => {
  it('resolves a mid-year month to its UTC [start, endExclusive) range', () => {
    expect(parseBillingPeriod('2026-07')).toEqual({
      start: new Date('2026-07-01T00:00:00.000Z'),
      endExclusive: new Date('2026-08-01T00:00:00.000Z'),
    });
  });

  it('rolls over into January of the next year for December', () => {
    expect(parseBillingPeriod('2026-12')).toEqual({
      start: new Date('2026-12-01T00:00:00.000Z'),
      endExclusive: new Date('2027-01-01T00:00:00.000Z'),
    });
  });

  it('handles January correctly', () => {
    expect(parseBillingPeriod('2026-01')).toEqual({
      start: new Date('2026-01-01T00:00:00.000Z'),
      endExclusive: new Date('2026-02-01T00:00:00.000Z'),
    });
  });

  it('throws on a malformed period string', () => {
    expect(() => parseBillingPeriod('2026/07')).toThrow(
      /Invalid billing period/,
    );
    expect(() => parseBillingPeriod('not-a-period')).toThrow(
      /Invalid billing period/,
    );
  });

  it('throws on an out-of-range month', () => {
    expect(() => parseBillingPeriod('2026-13')).toThrow(/month must be 01-12/);
    expect(() => parseBillingPeriod('2026-00')).toThrow(/month must be 01-12/);
  });
});
