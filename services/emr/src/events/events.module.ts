import { Module } from '@nestjs/common';
import { getEventPublisherConfig } from '../config/event-publisher.config';
import { DOMAIN_EVENT_PUBLISHER } from './events.constants';
import { DomainEventPublisher } from './domain-event-publisher.interface';
import { KafkaEventPublisherAdapter } from './kafka-event-publisher.adapter';
import { NoopDomainEventPublisher } from './noop-domain-event-publisher';

/**
 * Binds `DOMAIN_EVENT_PUBLISHER` to a real, `kafkajs`-backed
 * `KafkaEventPublisherAdapter` when `KAFKA_PRODUCER_ENABLED=true`, or to a
 * `NoopDomainEventPublisher` otherwise (the default in every environment
 * today -- see `../config/event-publisher.config.ts`'s doc comment for the
 * full scope boundary). `EncountersModule` imports this and injects
 * `DOMAIN_EVENT_PUBLISHER` into `EncountersService` so
 * `POST /patients/:patientId/encounters` always publishes
 * `encounter.created` (BAC-15, AC4) through the SAME code path regardless of
 * which concrete transport is bound. Mirrors `services/patient`'s BAC-14
 * `EventsModule` exactly.
 */
@Module({
  providers: [
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useFactory: (): DomainEventPublisher => {
        const config = getEventPublisherConfig();
        return config.enabled
          ? new KafkaEventPublisherAdapter(config)
          : new NoopDomainEventPublisher();
      },
    },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER],
})
export class EventsModule {}
