import { KafkaEventPublisherAdapter } from './kafka-event-publisher.adapter';
import type { KafkaProducerLike } from './kafka-event-publisher.adapter';

const CONFIG = {
  enabled: true,
  brokers: ['broker-1:9092'],
  patientCreatedTopic: 'patient.created',
};

const EVENT = {
  eventId: 'patient-1',
  patientId: 'patient-1',
  tenantId: 'tenant-1',
  createdAt: '2026-07-14T00:00:00.000Z',
};

/**
 * NEVER connects to a real Kafka broker: `kafkaClientFactory` is always an
 * injected fake here, mirroring `services/notification`'s BAC-9
 * `kafka-event-consumer.adapter.spec.ts` convention exactly. These tests
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

    await adapter.publishPatientCreated(EVENT);

    expect(clientFactory).toHaveBeenCalledWith(CONFIG);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(producer.connect).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(producer.send).toHaveBeenCalledWith({
      topic: 'patient.created',
      messages: [{ value: JSON.stringify(EVENT) }],
    });
  });

  it('reuses the same connected producer across multiple publish calls', async () => {
    const producer = makeFakeProducer();
    const clientFactory = jest.fn().mockReturnValue({
      producer: () => producer,
    });
    const adapter = new KafkaEventPublisherAdapter(CONFIG, clientFactory);

    await adapter.publishPatientCreated(EVENT);
    await adapter.publishPatientCreated({ ...EVENT, patientId: 'patient-2' });

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
    await adapter.publishPatientCreated(EVENT);

    await adapter.disconnect();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(producer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnect() before any publish call is a no-op', async () => {
    const adapter = new KafkaEventPublisherAdapter(CONFIG, jest.fn());
    await expect(adapter.disconnect()).resolves.toBeUndefined();
  });
});
