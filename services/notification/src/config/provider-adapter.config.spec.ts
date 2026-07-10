import { getProviderAdapterConfig } from './provider-adapter.config';

describe('getProviderAdapterConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('defaults to fake mode when NOTIFICATION_PROVIDER_MODE is unset', () => {
    delete process.env.NOTIFICATION_PROVIDER_MODE;
    expect(getProviderAdapterConfig().mode).toBe('fake');
  });

  it('defaults to fake mode for any value other than exactly "real"', () => {
    process.env.NOTIFICATION_PROVIDER_MODE = 'REAL';
    expect(getProviderAdapterConfig().mode).toBe('fake');
  });

  it('switches to real mode only when explicitly set to "real"', () => {
    process.env.NOTIFICATION_PROVIDER_MODE = 'real';
    expect(getProviderAdapterConfig().mode).toBe('real');
  });

  it('reads Twilio/SendGrid credentials from the environment', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    process.env.TWILIO_FROM_NUMBER = '+15550000000';
    process.env.SENDGRID_API_KEY = 'SG.key';
    process.env.SENDGRID_FROM_EMAIL = 'noreply@example.com';

    expect(getProviderAdapterConfig()).toMatchObject({
      twilio: {
        accountSid: 'AC123',
        authToken: 'token123',
        fromNumber: '+15550000000',
      },
      sendgrid: {
        apiKey: 'SG.key',
        fromEmail: 'noreply@example.com',
      },
    });
  });

  it('defaults credentials to empty strings when unset', () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;

    expect(getProviderAdapterConfig()).toMatchObject({
      twilio: { accountSid: '', authToken: '', fromNumber: '' },
      sendgrid: { apiKey: '', fromEmail: '' },
    });
  });
});
