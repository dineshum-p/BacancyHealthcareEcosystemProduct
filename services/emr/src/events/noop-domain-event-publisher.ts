import { Injectable, Logger } from '@nestjs/common';
import type { EncounterCreatedEvent } from '@hep/shared-types';
import { DomainEventPublisher } from './domain-event-publisher.interface';

/**
 * Default `DomainEventPublisher` bound when `KAFKA_PRODUCER_ENABLED` is
 * `false` (every environment today, including production -- see
 * `../config/event-publisher.config.ts`'s doc comment): no real Kafka
 * broker is provisioned anywhere in this repo/sandbox, so this never
 * attempts network I/O. It still runs the EXACT same call path
 * `EncountersService.create` always exercises, logging the event instead of
 * publishing it onto a real broker, so BAC-15 AC4's "emits an
 * encounter.created domain event" requirement is satisfied by the wiring
 * being correct and unconditional, not by a real broker being reachable in
 * this environment.
 */
@Injectable()
export class NoopDomainEventPublisher implements DomainEventPublisher {
  private readonly logger = new Logger(NoopDomainEventPublisher.name);

  publishEncounterCreated(event: EncounterCreatedEvent): Promise<void> {
    this.logger.log(
      `[encounter.created] (KAFKA_PRODUCER_ENABLED=false, no real broker configured) ${JSON.stringify(event)}`,
    );
    return Promise.resolve();
  }
}
