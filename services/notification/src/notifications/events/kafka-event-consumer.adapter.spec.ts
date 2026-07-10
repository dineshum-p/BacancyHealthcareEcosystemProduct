import { KafkaEventConsumerAdapter } from './kafka-event-consumer.adapter';
import type { KafkaConsumerLike } from './kafka-event-consumer.adapter';

const CONFIG = {
  enabled: true,
  brokers: ['broker-1:9092'],
  topic: 'user.registered',
  groupId: 'notification-service',
};

/**
 * NEVER connects to a real Kafka broker: `kafkaClientFactory` is always an
 * injected fake here, per this ticket's instructions ("do NOT attempt to
 * spin up a real Kafka broker for testing"). These tests prove the
 * consumer WIRING (connect/subscribe/run/disconnect, and how a message maps
 * to `handler`) is correct.
 */
describe('KafkaEventConsumerAdapter', () => {
  function makeFakeConsumer(): jest.Mocked<KafkaConsumerLike> {
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('connects, subscribes to the configured topic, and starts running on start()', async () => {
    const consumer = makeFakeConsumer();
    const clientFactory = jest.fn().mockReturnValue({
      consumer: () => consumer,
    });
    const handler = jest.fn().mockResolvedValue(undefined);
    const adapter = new KafkaEventConsumerAdapter(
      CONFIG,
      handler,
      clientFactory,
    );

    await adapter.start();

    expect(clientFactory).toHaveBeenCalledWith(CONFIG);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(consumer.connect).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(consumer.subscribe).toHaveBeenCalledWith({
      topic: CONFIG.topic,
      fromBeginning: false,
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(consumer.run).toHaveBeenCalledTimes(1);
  });

  it('disconnects on stop()', async () => {
    const consumer = makeFakeConsumer();
    const clientFactory = jest
      .fn()
      .mockReturnValue({ consumer: () => consumer });
    const adapter = new KafkaEventConsumerAdapter(
      CONFIG,
      jest.fn(),
      clientFactory,
    );
    await adapter.start();

    await adapter.stop();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(consumer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('parses a valid message and calls the handler with the decoded event', async () => {
    const consumer = makeFakeConsumer();
    const clientFactory = jest
      .fn()
      .mockReturnValue({ consumer: () => consumer });
    const handler = jest.fn().mockResolvedValue(undefined);
    const adapter = new KafkaEventConsumerAdapter(
      CONFIG,
      handler,
      clientFactory,
    );
    await adapter.start();
    const eachMessage = consumer.run.mock.calls[0][0].eachMessage;

    await eachMessage({
      message: {
        value: Buffer.from(
          JSON.stringify({
            userId: 'user-1',
            tenantId: 'tenant-1',
            email: 'a@example.com',
          }),
        ),
      },
    });

    expect(handler).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@example.com',
      name: undefined,
    });
  });

  it('does not throw, and does not call the handler, for a malformed message (logs and continues)', async () => {
    const consumer = makeFakeConsumer();
    const clientFactory = jest
      .fn()
      .mockReturnValue({ consumer: () => consumer });
    const handler = jest.fn().mockResolvedValue(undefined);
    const adapter = new KafkaEventConsumerAdapter(
      CONFIG,
      handler,
      clientFactory,
    );
    await adapter.start();
    const eachMessage = consumer.run.mock.calls[0][0].eachMessage;

    await expect(
      eachMessage({ message: { value: Buffer.from('not json') } }),
    ).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not throw when the handler itself rejects for a well-formed message (logs and continues)', async () => {
    const consumer = makeFakeConsumer();
    const clientFactory = jest
      .fn()
      .mockReturnValue({ consumer: () => consumer });
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const adapter = new KafkaEventConsumerAdapter(
      CONFIG,
      handler,
      clientFactory,
    );
    await adapter.start();
    const eachMessage = consumer.run.mock.calls[0][0].eachMessage;

    await expect(
      eachMessage({
        message: {
          value: Buffer.from(
            JSON.stringify({
              userId: 'user-1',
              tenantId: 'tenant-1',
              email: 'a@example.com',
            }),
          ),
        },
      }),
    ).resolves.toBeUndefined();
  });
});
