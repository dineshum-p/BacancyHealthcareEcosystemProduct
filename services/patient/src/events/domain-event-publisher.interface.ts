import type { PatientCreatedEvent } from '@hep/shared-types';

/**
 * Port every domain-event transport this service publishes onto implements
 * (BAC-14, AC4). `KafkaEventPublisherAdapter` is the real, `kafkajs`-backed
 * implementation (used when `KAFKA_PRODUCER_ENABLED=true`);
 * `NoopDomainEventPublisher` is the default (see `events.module.ts` and
 * `../config/event-publisher.config.ts`'s doc comments for the full "no
 * real broker provisioned in this repo/sandbox yet" scope boundary, mirrored
 * from `services/notification`'s BAC-9 `EventConsumer` port).
 *
 * `PatientsService.create` always calls `publishPatientCreated` after
 * successfully persisting a new patient -- the wiring itself is what this
 * ticket's AC4 requires to be correct, independent of which concrete
 * transport is bound.
 */
export interface DomainEventPublisher {
  publishPatientCreated(event: PatientCreatedEvent): Promise<void>;
}
