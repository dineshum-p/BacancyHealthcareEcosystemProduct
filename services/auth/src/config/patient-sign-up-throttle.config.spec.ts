import { getPatientSignUpThrottleConfig } from './patient-sign-up-throttle.config';

describe('getPatientSignUpThrottleConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('defaults to a sensible limit/ttl', () => {
    delete process.env.PATIENT_SIGN_UP_RATE_LIMIT;
    delete process.env.PATIENT_SIGN_UP_RATE_TTL_MS;

    expect(getPatientSignUpThrottleConfig()).toEqual({
      limit: 20,
      ttlMs: 60_000,
    });
  });

  it('reads an overridden limit/ttl from the environment', () => {
    process.env.PATIENT_SIGN_UP_RATE_LIMIT = '2';
    process.env.PATIENT_SIGN_UP_RATE_TTL_MS = '5000';

    expect(getPatientSignUpThrottleConfig()).toEqual({
      limit: 2,
      ttlMs: 5000,
    });
  });

  it('falls back to the default when given a non-numeric or non-positive override', () => {
    process.env.PATIENT_SIGN_UP_RATE_LIMIT = 'not-a-number';
    expect(getPatientSignUpThrottleConfig().limit).toBe(20);

    process.env.PATIENT_SIGN_UP_RATE_LIMIT = '0';
    expect(getPatientSignUpThrottleConfig().limit).toBe(20);

    process.env.PATIENT_SIGN_UP_RATE_LIMIT = '-5';
    expect(getPatientSignUpThrottleConfig().limit).toBe(20);
  });
});
