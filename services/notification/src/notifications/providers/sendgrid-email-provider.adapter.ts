import type { NotificationChannel } from '@hep/shared-types';
import type {
  NotificationProviderAdapter,
  ProviderSendOutcome,
  RenderedNotificationContent,
} from './notification-provider-adapter.interface';

export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
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
  headers: { get(name: string): string | null };
  json: () => Promise<unknown>;
}>;

/**
 * Real, production-shaped adapter calling SendGrid's actual `v3/mail/send`
 * HTTP API (https://docs.sendgrid.com/api-reference/mail-send/mail-send).
 * Built for production-readiness per this ticket's instructions, but NEVER
 * exercised by this repo's automated tests against the real network -- see
 * this file's `.spec.ts` (fetch is always injected) and
 * `provider-adapter.module.ts`.
 *
 * SendGrid's `mail/send` returns `202 Accepted` with an EMPTY body on
 * success; the provider message id comes back in the `X-Message-Id`
 * response header, not the JSON body.
 */
export class SendGridEmailProviderAdapter implements NotificationProviderAdapter {
  constructor(
    private readonly config: SendGridConfig,
    private readonly fetchFn: FetchLike = (url, init) =>
      globalThis.fetch(url, init),
  ) {}

  async send(
    _channel: NotificationChannel,
    to: string,
    content: RenderedNotificationContent,
  ): Promise<ProviderSendOutcome> {
    const url = 'https://api.sendgrid.com/v3/mail/send';
    const requestBody = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: this.config.fromEmail },
      subject: content.subject ?? '',
      content: [{ type: 'text/plain', value: content.body }],
    };

    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const payload = (await response.json()) as {
          errors?: { message: string }[];
        };
        const error =
          payload.errors?.map((e) => e.message).join('; ') ??
          `SendGrid responded with ${response.status}`;
        return { outcome: 'failed', error };
      }

      return {
        outcome: 'sent',
        providerMessageId: response.headers.get('X-Message-Id') ?? '',
      };
    } catch (error) {
      return {
        outcome: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
