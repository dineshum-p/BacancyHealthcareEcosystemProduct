import { getLimitForMetric, getLimitsForPlan } from './billing-plan-limits.map';

describe('billing-plan-limits.map', () => {
  it('resolves the starter plan limits', () => {
    expect(getLimitsForPlan('starter')).toEqual({
      'patient.created': 100,
      'encounter.created': 250,
    });
  });

  it('resolves the growth plan limits, higher than starter', () => {
    expect(getLimitsForPlan('growth')).toEqual({
      'patient.created': 1000,
      'encounter.created': 2500,
    });
  });

  it('resolves the enterprise plan limits, highest of all', () => {
    expect(getLimitsForPlan('enterprise')).toEqual({
      'patient.created': 100_000,
      'encounter.created': 250_000,
    });
  });

  it('is case-insensitive on the plan identifier', () => {
    expect(getLimitsForPlan('GROWTH')).toEqual(getLimitsForPlan('growth'));
    expect(getLimitsForPlan('  Growth  ')).toEqual(getLimitsForPlan('growth'));
  });

  it('falls back to the starter (least-generous) limits for an unrecognized plan', () => {
    expect(getLimitsForPlan('some-future-plan')).toEqual(
      getLimitsForPlan('starter'),
    );
    expect(getLimitsForPlan('')).toEqual(getLimitsForPlan('starter'));
  });

  describe('getLimitForMetric', () => {
    it('resolves a single metric limit for a plan', () => {
      expect(getLimitForMetric('starter', 'patient.created')).toBe(100);
      expect(getLimitForMetric('growth', 'encounter.created')).toBe(2500);
    });
  });
});
