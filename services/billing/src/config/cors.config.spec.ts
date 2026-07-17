import { getCorsConfig } from './cors.config';

describe('getCorsConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('falls back to the common local dev origin when CORS_ALLOWED_ORIGINS is unset', () => {
    delete process.env.CORS_ALLOWED_ORIGINS;

    expect(getCorsConfig()).toEqual({
      origin: ['http://localhost:3000'],
      methods: ['GET', 'POST'],
      allowedHeaders: ['Authorization', 'X-Tenant-Id', 'Content-Type'],
      credentials: true,
    });
  });

  it('reads a comma-separated allow-list from CORS_ALLOWED_ORIGINS', () => {
    process.env.CORS_ALLOWED_ORIGINS =
      'https://billing.example.com, https://admin.example.com';

    expect(getCorsConfig().origin).toEqual([
      'https://billing.example.com',
      'https://admin.example.com',
    ]);
  });

  it('always allows the methods and headers the usage console actually uses', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://billing.example.com';

    const config = getCorsConfig();
    expect(config.methods).toEqual(['GET', 'POST']);
    expect(config.allowedHeaders).toEqual([
      'Authorization',
      'X-Tenant-Id',
      'Content-Type',
    ]);
    expect(config.credentials).toBe(true);
  });
});
