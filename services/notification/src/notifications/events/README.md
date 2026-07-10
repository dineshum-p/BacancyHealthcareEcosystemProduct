# Domain event consumption (BAC-9, AC4) -- scope boundary

This directory delivers the CONSUMPTION side of `user.registered` -- proving
the event-to-notification mapping logic works correctly -- and deliberately
stops there. Explicitly out of scope for this ticket:

- **No real Kafka broker is provisioned anywhere in this repo/sandbox.**
  `KafkaEventConsumerAdapter` is a real, `kafkajs`-backed implementation of
  the `EventConsumer` port (configurable via `KAFKA_BROKERS`,
  `KAFKA_USER_REGISTERED_TOPIC`, `KAFKA_CONSUMER_GROUP` -- see
  `.env.example`), but it is never automatically started:
  `EventConsumerBootstrapService` only calls `start()` when
  `KAFKA_CONSUMER_ENABLED=true`, which defaults to `false` everywhere,
  including production, until an operator explicitly opts in against a real,
  provisioned Kafka cluster.
- **No automated test in this repo ever connects to a real broker**, and
  none should be added that does. `KafkaEventConsumerAdapter`'s own tests
  (`kafka-event-consumer.adapter.spec.ts`) inject a fake, in-process
  `KafkaClientLike`/`KafkaConsumerLike` to prove the connect/subscribe/run/
  dispatch wiring is correct; `parse-user-registered-event.util.spec.ts` and
  `user-registered-event.handler.spec.ts` test the actual event-HANDLING
  logic (decoding a message, resolving the tenant, calling
  `NotificationsService.createForSchema`) directly, with representative
  payloads, exactly as this ticket instructs.
- **`services/auth` does not publish a `user.registered` event to any real
  broker, and this ticket does not add that.** Wiring a real Kafka
  producer into `services/auth` (or any other publisher) is a separate,
  cross-service, infrastructure-dependent follow-up ticket. `UserRegisteredEvent`
  (`@hep/shared-types`) documents the CONTRACT a future publisher must
  produce; this service is ready to consume it the moment one exists.
- **No dead-letter-queue/redelivery topic.** A malformed message or a
  handler failure (e.g. an event referencing an unknown/inactive tenant) is
  logged and the consumer loop continues to the next message
  (`KafkaEventConsumerAdapter.handleMessage`) -- there is no retry-topic or
  poison-message quarantine in this ticket's scope. A future ticket
  standing up real Kafka infrastructure should also decide on a
  DLQ/redelivery strategy.
