/**
 * Raised by `UserRegisteredEventHandler` when a `user.registered` event's
 * `tenantId` does not resolve to a known, active tenant. Kept
 * Nest-exception-free (there is no HTTP request to translate this into --
 * see `NotificationsService`'s doc comment on the event-consumption path)
 * so `KafkaEventConsumerAdapter` can catch and log it per-message without
 * crashing the consumer loop.
 */
export class UnknownTenantForEventError extends Error {
  constructor(public readonly tenantId: string) {
    super(
      `user.registered event referenced unknown or inactive tenantId "${tenantId}".`,
    );
    this.name = 'UnknownTenantForEventError';
  }
}
