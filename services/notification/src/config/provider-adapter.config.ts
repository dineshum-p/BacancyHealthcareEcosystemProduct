export type ProviderMode = 'fake' | 'real';

export interface ProviderAdapterConfig {
  mode: ProviderMode;
  twilio: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
  sendgrid: {
    apiKey: string;
    fromEmail: string;
  };
}

/**
 * Reads provider-adapter selection/credentials from the environment.
 * `mode` deliberately defaults to `'fake'` in every environment (including
 * an unset `NODE_ENV`) -- unlike this codebase's usual
 * fail-fast-on-insecure-default pattern (BAC-5/6, `auth.config.ts`), the
 * safe default here is the OPPOSITE: never silently attempt a real network
 * call to an SMS/email vendor for lack of an explicit env var. Only
 * `NOTIFICATION_PROVIDER_MODE=real`, set by an operator who has also
 * provisioned real Twilio/SendGrid credentials, switches this.
 */
export function getProviderAdapterConfig(): ProviderAdapterConfig {
  return {
    mode: process.env.NOTIFICATION_PROVIDER_MODE === 'real' ? 'real' : 'fake',
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
      fromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY ?? '',
      fromEmail: process.env.SENDGRID_FROM_EMAIL ?? '',
    },
  };
}
