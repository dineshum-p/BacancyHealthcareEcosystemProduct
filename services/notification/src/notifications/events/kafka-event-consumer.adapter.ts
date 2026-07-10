import { Kafka } from 'kafkajs';
import type { UserRegisteredEvent } from '@hep/shared-types';
import type { EventConsumerConfig } from '../../config/event-consumer.config';
import type { EventConsumer } from './event-consumer.interface';
import { parseUserRegisteredEvent } from './parse-user-registered-event.util';

/** The subset of a `kafkajs` `EachMessagePayload` this adapter reads. */
export interface KafkaMessagePayload {
  message: { value: Buffer | null };
}

/** The subset of a `kafkajs` `Consumer` this adapter depends on -- lets tests inject a fake, no-network client. */
export interface KafkaConsumerLike {
  connect(): Promise<void>;
  subscribe(options: { topic: string; fromBeginning: boolean }): Promise<void>;
  run(options: {
    eachMessage: (payload: KafkaMessagePayload) => Promise<void>;
  }): Promise<void>;
  disconnect(): Promise<void>;
}

/** The subset of a `kafkajs` `Kafka` client this adapter depends on. */
export interface KafkaClientLike {
  consumer(options: { groupId: string }): KafkaConsumerLike;
}

/** Builds the real `kafkajs` client -- the production default for `kafkaClientFactory`. */
function defaultKafkaClientFactory(
  config: EventConsumerConfig,
): KafkaClientLike {
  return new Kafka({ brokers: config.brokers });
}

/**
 * Real, `kafkajs`-backed `EventConsumer` (AC4) subscribing to the
 * `user.registered` topic and dispatching each decoded event to `handler`
 * (`UserRegisteredEventHandler.handle`, wired in `events.module.ts`).
 *
 * NEVER connects to a real broker in this repo's automated tests --
 * `kafkaClientFactory` is always an injected fake there (per this ticket's
 * instructions; there is no Kafka broker anywhere in this sandbox). Nothing
 * in this service calls `start()` automatically either: see
 * `events/README.md` for the explicit scope boundary and
 * `KAFKA_CONSUMER_ENABLED` in `.env.example`.
 *
 * A malformed message, or a handler rejection, is logged and swallowed
 * per-message (`eachMessage` never rejects) -- one bad/unprocessable event
 * must not crash the consumer loop for every subsequent message on the
 * topic. There is no dead-letter-queue/retry-topic wiring in this ticket's
 * scope; see this file's follow-up note in `events/README.md`.
 */
export class KafkaEventConsumerAdapter implements EventConsumer {
  private consumer: KafkaConsumerLike | null = null;

  constructor(
    private readonly config: EventConsumerConfig,
    private readonly handler: (event: UserRegisteredEvent) => Promise<void>,
    private readonly kafkaClientFactory: (
      config: EventConsumerConfig,
    ) => KafkaClientLike = defaultKafkaClientFactory,
  ) {}

  async start(): Promise<void> {
    const client = this.kafkaClientFactory(this.config);
    const consumer = client.consumer({ groupId: this.config.groupId });
    this.consumer = consumer;

    await consumer.connect();
    await consumer.subscribe({
      topic: this.config.topic,
      fromBeginning: false,
    });
    await consumer.run({
      eachMessage: (payload) => this.handleMessage(payload),
    });
  }

  async stop(): Promise<void> {
    await this.consumer?.disconnect();
  }

  private async handleMessage(payload: KafkaMessagePayload): Promise<void> {
    try {
      const event = parseUserRegisteredEvent(payload.message.value);
      await this.handler(event);
    } catch (error) {
      console.error(
        `Failed to process a "${this.config.topic}" message:`,
        error,
      );
    }
  }
}
