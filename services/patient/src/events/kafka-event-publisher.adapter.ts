import { Kafka } from 'kafkajs';
import type { PatientCreatedEvent } from '@hep/shared-types';
import type { EventPublisherConfig } from '../config/event-publisher.config';
import type { DomainEventPublisher } from './domain-event-publisher.interface';

/** The subset of a `kafkajs` `Producer` this adapter depends on -- lets tests inject a fake, no-network client. */
export interface KafkaProducerLike {
  connect(): Promise<void>;
  send(record: {
    topic: string;
    messages: { value: string }[];
  }): Promise<unknown>;
  disconnect(): Promise<void>;
}

/** The subset of a `kafkajs` `Kafka` client this adapter depends on. */
export interface KafkaClientLike {
  producer(): KafkaProducerLike;
}

/** Builds the real `kafkajs` client -- the production default for `kafkaClientFactory`. */
function defaultKafkaClientFactory(
  config: EventPublisherConfig,
): KafkaClientLike {
  return new Kafka({ brokers: config.brokers });
}

/**
 * Real, `kafkajs`-backed `DomainEventPublisher` (BAC-14, AC4), publishing
 * `patient.created` onto the configured topic. Mirrors
 * `services/notification`'s BAC-9 `KafkaEventConsumerAdapter` exactly, just
 * on the producing side: connects lazily (on the first `publishPatientCreated`
 * call, not at construction), and NEVER connects to a real broker in this
 * repo's automated tests -- `kafkaClientFactory` is always an injected fake
 * there (per this ticket's instructions; there is no Kafka broker anywhere
 * in this sandbox). See `events.module.ts`/`events/README.md` for the full
 * scope boundary and why this adapter is only bound when
 * `KAFKA_PRODUCER_ENABLED=true`.
 */
export class KafkaEventPublisherAdapter implements DomainEventPublisher {
  private producer: KafkaProducerLike | null = null;

  constructor(
    private readonly config: EventPublisherConfig,
    private readonly kafkaClientFactory: (
      config: EventPublisherConfig,
    ) => KafkaClientLike = defaultKafkaClientFactory,
  ) {}

  async publishPatientCreated(event: PatientCreatedEvent): Promise<void> {
    const producer = await this.getProducer();
    await producer.send({
      topic: this.config.patientCreatedTopic,
      messages: [{ value: JSON.stringify(event) }],
    });
  }

  async disconnect(): Promise<void> {
    await this.producer?.disconnect();
    this.producer = null;
  }

  private async getProducer(): Promise<KafkaProducerLike> {
    if (!this.producer) {
      const client = this.kafkaClientFactory(this.config);
      const producer = client.producer();
      await producer.connect();
      this.producer = producer;
    }
    return this.producer;
  }
}
