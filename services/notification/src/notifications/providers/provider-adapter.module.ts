import { Module } from '@nestjs/common';
import { getProviderAdapterConfig } from '../../config/provider-adapter.config';
import { NOTIFICATION_PROVIDER_ADAPTER } from './provider-adapter.tokens';
import { FakeNotificationProviderAdapter } from './fake-notification-provider.adapter';
import { TwilioSmsProviderAdapter } from './twilio-sms-provider.adapter';
import { SendGridEmailProviderAdapter } from './sendgrid-email-provider.adapter';
import { ChannelProviderAdapter } from './channel-provider-adapter';
import type { NotificationProviderAdapter } from './notification-provider-adapter.interface';

/**
 * Selects the `NotificationProviderAdapter` implementation the rest of the
 * app injects, based on `NOTIFICATION_PROVIDER_MODE`:
 *
 * - `'fake'` (the default in every environment, including production, until
 *   explicitly overridden): a SINGLE shared `FakeNotificationProviderAdapter`
 *   instance for both channels. This is deliberate and safety-motivated --
 *   see `provider-adapter.config.ts`'s doc comment -- not just a test
 *   convenience.
 * - `'real'`: composes the production-shaped Twilio (sms) + SendGrid (email)
 *   adapters. Only reachable when an operator has set
 *   `NOTIFICATION_PROVIDER_MODE=real` AND provisioned real credentials; this
 *   repo's automated tests never set that env var, so this branch is never
 *   exercised by CI (by design -- see this ticket's scope notes).
 */
@Module({
  providers: [
    {
      provide: NOTIFICATION_PROVIDER_ADAPTER,
      useFactory: (): NotificationProviderAdapter => {
        const config = getProviderAdapterConfig();
        if (config.mode === 'real') {
          return new ChannelProviderAdapter(
            new TwilioSmsProviderAdapter(config.twilio),
            new SendGridEmailProviderAdapter(config.sendgrid),
          );
        }
        return new FakeNotificationProviderAdapter();
      },
    },
  ],
  exports: [NOTIFICATION_PROVIDER_ADAPTER],
})
export class ProviderAdapterModule {}
