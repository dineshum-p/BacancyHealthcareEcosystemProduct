/**
 * DI token for the single `NotificationProviderAdapter` the rest of the app
 * injects (`NotificationDeliveryWorker`, event handlers, etc). Resolves to
 * either a shared `FakeNotificationProviderAdapter` or a
 * `ChannelProviderAdapter` composing the real Twilio/SendGrid adapters --
 * see `provider-adapter.module.ts`.
 */
export const NOTIFICATION_PROVIDER_ADAPTER = 'NOTIFICATION_PROVIDER_ADAPTER';
