import type { NotificationChannel } from '@hep/shared-types';
import type {
  NotificationProviderAdapter,
  ProviderSendOutcome,
  RenderedNotificationContent,
} from './notification-provider-adapter.interface';

/**
 * Dispatches to whichever concrete adapter matches the requested channel.
 * `NotificationDeliveryWorker` depends on a single
 * `NotificationProviderAdapter`, so this composes the (possibly different)
 * SMS and email adapters behind one implementation of the same port,
 * keeping the worker channel-agnostic.
 */
export class ChannelProviderAdapter implements NotificationProviderAdapter {
  constructor(
    private readonly smsAdapter: NotificationProviderAdapter,
    private readonly emailAdapter: NotificationProviderAdapter,
  ) {}

  send(
    channel: NotificationChannel,
    to: string,
    content: RenderedNotificationContent,
  ): Promise<ProviderSendOutcome> {
    const adapter = channel === 'sms' ? this.smsAdapter : this.emailAdapter;
    return adapter.send(channel, to, content);
  }
}
