import type { EncounterCreatedEvent } from '@hep/shared-types';

/**
 * Port every domain-event transport this service publishes onto implements
 * (BAC-15, AC4). Mirrors `services/patient`'s BAC-14 `DomainEventPublisher`
 * port exactly, just for this service's own `encounter.created` event:
 * `KafkaEventPublisherAdapter` is the real, `kafkajs`-backed implementation
 * (used when `KAFKA_PRODUCER_ENABLED=true`); `NoopDomainEventPublisher` is
 * the default (see `events.module.ts` and
 * `../config/event-publisher.config.ts`'s doc comments for the full "no
 * real broker provisioned in this repo/sandbox yet" scope boundary).
 *
 * `EncountersService.create` always calls `publishEncounterCreated` after
 * successfully persisting a new encounter -- the wiring itself is what this
 * ticket's AC4 requires to be correct, independent of which concrete
 * transport is bound.
 */
export interface DomainEventPublisher {
  publishEncounterCreated(event: EncounterCreatedEvent): Promise<void>;
}
