import { randomUUID } from 'node:crypto';
import type { NotificationChannel } from '@hep/shared-types';
import type {
  NotificationProviderAdapter,
  ProviderSendOutcome,
  RenderedNotificationContent,
} from './notification-provider-adapter.interface';

export type FakeAdapterBehavior =
  /** Every send() succeeds (the default). */
  | { mode: 'always-succeed' }
  /** Every send() fails -- simulates a permanently broken vendor/number. */
  | { mode: 'always-fail'; error?: string }
  /**
   * The first `failCount` calls fail (a transient error); every call after
   * that succeeds -- this is what AC3's retry-then-succeed tests exercise.
   */
  | { mode: 'fail-then-succeed'; failCount: number };

const DEFAULT_BEHAVIOR: FakeAdapterBehavior = { mode: 'always-succeed' };

/**
 * In-process, no-network stand-in for a real SMS/email vendor adapter.
 * THIS is the only adapter this repo's automated tests are ever allowed to
 * exercise (per this ticket's explicit instructions) -- see
 * `twilio-sms-provider.adapter.ts`/`sendgrid-email-provider.adapter.ts` for
 * the real, production-shaped adapters, and `provider-adapter.module.ts` for
 * why this one is the default in every environment until an operator
 * explicitly opts into `real` mode with real vendor credentials.
 */
export class FakeNotificationProviderAdapter implements NotificationProviderAdapter {
  private callCount = 0;

  constructor(
    private readonly behavior: FakeAdapterBehavior = DEFAULT_BEHAVIOR,
  ) {}

  /**
   * Ignores `channel`/`to`/`content` entirely -- the fake's whole point is
   * to simulate PROVIDER outcomes deterministically, regardless of what was
   * being "sent".
   */
  send(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see doc comment above
    channel: NotificationChannel,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see doc comment above
    to: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see doc comment above
    content: RenderedNotificationContent,
  ): Promise<ProviderSendOutcome> {
    this.callCount += 1;

    switch (this.behavior.mode) {
      case 'always-succeed':
        return Promise.resolve(this.sent());
      case 'always-fail':
        return Promise.resolve(
          this.failed(this.behavior.error ?? 'Simulated permanent failure.'),
        );
      case 'fail-then-succeed':
        return Promise.resolve(
          this.callCount <= this.behavior.failCount
            ? this.failed('Simulated transient failure.')
            : this.sent(),
        );
    }
  }

  /** Number of times `send()` has been invoked -- lets tests assert retry counts. */
  getCallCount(): number {
    return this.callCount;
  }

  private sent(): ProviderSendOutcome {
    return { outcome: 'sent', providerMessageId: `fake-${randomUUID()}` };
  }

  private failed(error: string): ProviderSendOutcome {
    return { outcome: 'failed', error };
  }
}
