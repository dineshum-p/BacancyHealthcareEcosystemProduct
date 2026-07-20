import { getPublicRegistrationThrottleConfig } from './public-registration-throttle.config';

describe('getPublicRegistrationThrottleConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('defaults to a sensible limit/ttl', () => {
    delete process.env.PUBLIC_PATIENT_REGISTRATION_RATE_LIMIT;
    delete process.env.PUBLIC_PATIENT_REGISTRATION_RATE_TTL_MS;

    expect(getPublicRegistrationThrottleConfig()).toEqual({
      limit: 20,
      ttlMs: 60_000,
    });
  });

  it('reads an overridden limit/ttl from the environment', () => {
    process.env.PUBLIC_PATIENT_REGISTRATION_RATE_LIMIT = '2';
    process.env.PUBLIC_PATIENT_REGISTRATION_RATE_TTL_MS = '5000';

    expect(getPublicRegistrationThrottleConfig()).toEqual({
      limit: 2,
      ttlMs: 5000,
    });
  });

  it('falls back to the default when given a non-numeric or non-positive override', () => {
    process.env.PUBLIC_PATIENT_REGISTRATION_RATE_LIMIT = 'not-a-number';
    expect(getPublicRegistrationThrottleConfig().limit).toBe(20);

    process.env.PUBLIC_PATIENT_REGISTRATION_RATE_LIMIT = '0';
    expect(getPublicRegistrationThrottleConfig().limit).toBe(20);

    process.env.PUBLIC_PATIENT_REGISTRATION_RATE_LIMIT = '-5';
    expect(getPublicRegistrationThrottleConfig().limit).toBe(20);
  });
});
