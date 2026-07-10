/**
 * Port every domain-event transport this service consumes from implements
 * (AC4). `KafkaEventConsumerAdapter` is the (only, today) real
 * implementation -- see that file and `events/README.md` for the scope
 * boundary (no real broker/publisher exists in this repo/sandbox yet).
 */
export interface EventConsumer {
  start(): Promise<void>;
  stop(): Promise<void>;
}
