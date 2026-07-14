import { Test } from '@nestjs/testing';
import { EventsModule } from './events.module';
import { DOMAIN_EVENT_PUBLISHER } from './events.constants';
import { DomainEventPublisher } from './domain-event-publisher.interface';
import { KafkaEventPublisherAdapter } from './kafka-event-publisher.adapter';
import { NoopDomainEventPublisher } from './noop-domain-event-publisher';

describe('EventsModule', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('binds DOMAIN_EVENT_PUBLISHER to NoopDomainEventPublisher by default', async () => {
    delete process.env.KAFKA_PRODUCER_ENABLED;
    const moduleRef = await Test.createTestingModule({
      imports: [EventsModule],
    }).compile();

    const publisher = moduleRef.get<DomainEventPublisher>(
      DOMAIN_EVENT_PUBLISHER,
    );
    expect(publisher).toBeInstanceOf(NoopDomainEventPublisher);
  });

  it('binds DOMAIN_EVENT_PUBLISHER to KafkaEventPublisherAdapter when enabled', async () => {
    process.env.KAFKA_PRODUCER_ENABLED = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [EventsModule],
    }).compile();

    const publisher = moduleRef.get<DomainEventPublisher>(
      DOMAIN_EVENT_PUBLISHER,
    );
    expect(publisher).toBeInstanceOf(KafkaEventPublisherAdapter);
  });
});
