import { getCorsConfig, isAllowedOrigin } from './cors.config';

describe('getCorsConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('falls back to the common local dev origin when CORS_ALLOWED_ORIGINS is unset', () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.CORS_ALLOWED_ORIGIN_SUFFIX;

    expect(getCorsConfig()).toEqual({
      origin: ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT'],
      allowedHeaders: ['Authorization', 'X-Tenant-Id', 'Content-Type'],
      credentials: true,
    });
  });

  it('reads a comma-separated allow-list from CORS_ALLOWED_ORIGINS', () => {
    process.env.CORS_ALLOWED_ORIGINS =
      'https://emr.example.com, https://admin.example.com';

    expect(getCorsConfig().origin).toEqual([
      'https://emr.example.com',
      'https://admin.example.com',
    ]);
  });

  it('always allows the methods and headers the FHIR gateway actually uses', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://emr.example.com';

    const config = getCorsConfig();
    expect(config.methods).toEqual(['GET', 'POST', 'PUT']);
    expect(config.allowedHeaders).toEqual([
      'Authorization',
      'X-Tenant-Id',
      'Content-Type',
    ]);
    expect(config.credentials).toBe(true);
  });
});

describe('isAllowedOrigin (BAC-38: subdomain-per-tenant)', () => {
  it('allows an origin from the exact allow-list regardless of root domain', () => {
    expect(
      isAllowedOrigin(
        'https://clinic.example.com',
        ['https://clinic.example.com'],
        'yourapp.com',
      ),
    ).toBe(true);
  });

  it('allows a subdomain of the configured root domain', () => {
    expect(
      isAllowedOrigin('https://acme-clinic.yourapp.com', [], 'yourapp.com'),
    ).toBe(true);
  });

  it('allows the bare root domain itself', () => {
    expect(isAllowedOrigin('https://yourapp.com', [], 'yourapp.com')).toBe(
      true,
    );
  });

  it('rejects a lookalike domain that merely contains the root domain as a substring', () => {
    expect(isAllowedOrigin('https://evil-yourapp.com', [], 'yourapp.com')).toBe(
      false,
    );
    expect(
      isAllowedOrigin('https://yourapp.com.evil.com', [], 'yourapp.com'),
    ).toBe(false);
  });

  it('rejects any subdomain when no root domain is configured', () => {
    expect(
      isAllowedOrigin('https://acme-clinic.yourapp.com', [], undefined),
    ).toBe(false);
  });

  it('rejects a malformed origin safely instead of throwing', () => {
    expect(isAllowedOrigin('not-a-url', [], 'yourapp.com')).toBe(false);
  });
});

describe('getCorsConfig (BAC-38: CORS_ALLOWED_ORIGIN_SUFFIX)', () => {
  it('keeps the plain exact-list array when CORS_ALLOWED_ORIGIN_SUFFIX is unset (backward compatible)', () => {
    delete process.env.CORS_ALLOWED_ORIGIN_SUFFIX;
    process.env.CORS_ALLOWED_ORIGINS = 'https://clinic.example.com';

    expect(getCorsConfig().origin).toEqual(['https://clinic.example.com']);
  });

  it('switches to a validator function that allows a tenant subdomain when the suffix is set', () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGIN_SUFFIX = 'yourapp.com';

    const originFn = getCorsConfig().origin as (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => void;
    const callback = jest.fn();

    originFn('https://acme-clinic.yourapp.com', callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects a non-matching origin through the validator function', () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGIN_SUFFIX = 'yourapp.com';

    const originFn = getCorsConfig().origin as (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => void;
    const callback = jest.fn();

    originFn('https://not-allowed.com', callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });
});
