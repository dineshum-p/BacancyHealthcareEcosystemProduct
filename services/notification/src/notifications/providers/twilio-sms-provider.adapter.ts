import type { NotificationChannel } from '@hep/shared-types';
import type {
  NotificationProviderAdapter,
  ProviderSendOutcome,
  RenderedNotificationContent,
} from './notification-provider-adapter.interface';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/** The subset of the global `fetch` signature this adapter depends on -- lets tests inject a mock without touching the network. */
export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}>;

/**
 * Real, production-shaped adapter calling Twilio's actual Messages HTTP API
 * (https://www.twilio.com/docs/sms/api/message-resource). Built for
 * production-readiness per this ticket's instructions, but NEVER exercised
 * by this repo's automated tests against the real network -- see this
 * file's `.spec.ts` (fetch is always injected) and
 * `provider-adapter.module.ts` (this adapter is only wired up when an
 * operator explicitly sets `NOTIFICATION_PROVIDER_MODE=real` with real
 * credentials).
 */
export class TwilioSmsProviderAdapter implements NotificationProviderAdapter {
  constructor(
    private readonly config: TwilioConfig,
    private readonly fetchFn: FetchLike = (url, init) =>
      globalThis.fetch(url, init),
  ) {}

  async send(
    _channel: NotificationChannel,
    to: string,
    content: RenderedNotificationContent,
  ): Promise<ProviderSendOutcome> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: to,
      From: this.config.fromNumber,
      Body: content.body,
    });
    const basicAuth = Buffer.from(
      `${this.config.accountSid}:${this.config.authToken}`,
    ).toString('base64');

    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
      const payload = (await response.json()) as {
        sid?: string;
        message?: string;
      };

      if (!response.ok) {
        return {
          outcome: 'failed',
          error: payload.message ?? `Twilio responded with ${response.status}`,
        };
      }
      return { outcome: 'sent', providerMessageId: payload.sid ?? '' };
    } catch (error) {
      return {
        outcome: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
