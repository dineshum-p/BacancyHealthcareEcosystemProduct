import type { NotificationChannel } from '@hep/shared-types';

/** The rendered message content ready to hand to a provider. */
export interface RenderedNotificationContent {
  /** Only meaningful for `email`; ignored by `sms` adapters. */
  subject?: string;
  body: string;
}

/** A provider send attempt either succeeded or failed -- never both/neither. */
export type ProviderSendOutcome =
  | { outcome: 'sent'; providerMessageId: string }
  | { outcome: 'failed'; error: string };

/**
 * Port (in the hexagonal-architecture sense) every SMS/email vendor
 * integration implements. `NotificationDeliveryWorker` (AC3's retry/backoff
 * loop) depends ONLY on this interface, never on a concrete vendor SDK/HTTP
 * client -- this is what makes the retry logic deterministically testable
 * against `FakeNotificationProviderAdapter` without ever touching a network.
 *
 * Deliberately does not throw on a delivery failure: a failed SMS/email send
 * is an ordinary, expected outcome (bad number, vendor outage, rate limit),
 * not an exceptional program state, so callers branch on
 * `ProviderSendOutcome.outcome` rather than a try/catch. An adapter
 * implementation MAY still let an unexpected error (e.g. malformed
 * response, network exception) propagate as a thrown error -- callers
 * should treat a thrown error the same as `{ outcome: 'failed' }` for retry
 * purposes.
 */
export interface NotificationProviderAdapter {
  send(
    channel: NotificationChannel,
    to: string,
    content: RenderedNotificationContent,
  ): Promise<ProviderSendOutcome>;
}
