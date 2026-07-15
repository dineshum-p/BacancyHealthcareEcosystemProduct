import { KafkaEventPublisherAdapter } from './kafka-event-publisher.adapter';
import type { KafkaProducerLike } from './kafka-event-publisher.adapter';

const CONFIG = {
  enabled: true,
  brokers: ['broker-1:9092'],
  encounterCreatedTopic: 'encounter.created',
};

const EVENT = {
  eventId: 'encounter-1',
  encounterId: 'encounter-1',
  patientId: 'patient-1',
  tenantId: 'tenant-1',
  createdAt: '2026-07-14T00:00:00.000Z',
};

/**
 * NEVER connects to a real Kafka broker: `kafkaClientFactory` is always an
 * injected fake here, mirroring `services/patient`'s BAC-14
 * `kafka-event-publisher.adapter.spec.ts` convention exactly. These tests
 * prove the producer WIRING (lazy connect/send/disconnect) is correct.
 */
describe('KafkaEventPublisherAdapter', () => {
  function makeFakeProducer(): jest.Mocked<KafkaProducerLike> {
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('lazily connects on the first publish call', async () => {
    const producer = makeFakeProducer();
    const clientFactory = jest.fn().mockReturnValue({
      producer: () => producer,
    });
    const adapter = new KafkaEventPublisherAdapter(CONFIG, clientFactory);

    expect(clientFactory).not.toHaveBeenCalled();

    await adapter.publishEncounterCreated(EVENT);

    expect(clientFactory).toHaveBeenCalledWith(CONFIG);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(producer.connect).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(producer.send).toHaveBeenCalledWith({
      topic: 'encounter.created',
      messages: [{ value: JSON.stringify(EVENT) }],
    });
  });

  it('reuses the same connected producer across multiple publish calls', async () => {
    const producer = makeFakeProducer();
    const clientFactory = jest.fn().mockReturnValue({
      producer: () => producer,
    });
    const adapter = new KafkaEventPublisherAdapter(CONFIG, clientFactory);

    await adapter.publishEncounterCreated(EVENT);
    await adapter.publishEncounterCreated({
      ...EVENT,
      encounterId: 'encounter-2',
      eventId: 'encounter-2',
    });

    expect(clientFactory).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(producer.connect).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(producer.send).toHaveBeenCalledTimes(2);
  });

  it('disconnects and clears the cached producer on disconnect()', async () => {
    const producer = makeFakeProducer();
    const clientFactory = jest.fn().mockReturnValue({
      producer: () => producer,
    });
    const adapter = new KafkaEventPublisherAdapter(CONFIG, clientFactory);
    await adapter.publishEncounterCreated(EVENT);

    await adapter.disconnect();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(producer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnect() before any publish call is a no-op', async () => {
    const adapter = new KafkaEventPublisherAdapter(CONFIG, jest.fn());
    await expect(adapter.disconnect()).resolves.toBeUndefined();
  });
});
