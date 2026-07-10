import { EventConsumerBootstrapService } from './event-consumer-bootstrap.service';
import { UserRegisteredEventHandler } from './user-registered-event.handler';
import type { EventConsumer } from './event-consumer.interface';
import type { EventConsumerConfig } from '../../config/event-consumer.config';

describe('EventConsumerBootstrapService', () => {
  function makeHandler(): jest.Mocked<UserRegisteredEventHandler> {
    return {
      handle: jest.fn(),
    } as unknown as jest.Mocked<UserRegisteredEventHandler>;
  }
  function makeFakeConsumer(): jest.Mocked<EventConsumer> {
    return {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('does NOT start a consumer when the config is disabled (the default)', async () => {
    const consumer = makeFakeConsumer();
    const consumerFactory = jest.fn().mockReturnValue(consumer);
    const config: EventConsumerConfig = {
      enabled: false,
      brokers: ['broker-1:9092'],
      topic: 'user.registered',
      groupId: 'notification-service',
    };
    const service = new EventConsumerBootstrapService(
      makeHandler(),
      () => config,
      consumerFactory,
    );

    await service.onApplicationBootstrap();

    expect(consumerFactory).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(consumer.start).not.toHaveBeenCalled();
  });

  it('starts the consumer when the config is enabled', async () => {
    const consumer = makeFakeConsumer();
    const consumerFactory = jest.fn().mockReturnValue(consumer);
    const config: EventConsumerConfig = {
      enabled: true,
      brokers: ['broker-1:9092'],
      topic: 'user.registered',
      groupId: 'notification-service',
    };
    const service = new EventConsumerBootstrapService(
      makeHandler(),
      () => config,
      consumerFactory,
    );

    await service.onApplicationBootstrap();

    expect(consumerFactory).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(consumer.start).toHaveBeenCalledTimes(1);
  });

  it('stops the consumer on shutdown only if one was started', async () => {
    const consumer = makeFakeConsumer();
    const consumerFactory = jest.fn().mockReturnValue(consumer);
    const config: EventConsumerConfig = {
      enabled: true,
      brokers: ['broker-1:9092'],
      topic: 'user.registered',
      groupId: 'notification-service',
    };
    const service = new EventConsumerBootstrapService(
      makeHandler(),
      () => config,
      consumerFactory,
    );
    await service.onApplicationBootstrap();

    await service.onApplicationShutdown();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(consumer.stop).toHaveBeenCalledTimes(1);
  });

  it('does not throw calling shutdown when no consumer was ever started', async () => {
    const config: EventConsumerConfig = {
      enabled: false,
      brokers: ['broker-1:9092'],
      topic: 'user.registered',
      groupId: 'notification-service',
    };
    const service = new EventConsumerBootstrapService(
      makeHandler(),
      () => config,
      jest.fn(),
    );

    await expect(service.onApplicationShutdown()).resolves.toBeUndefined();
  });

  it('wires the consumer to call handler.handle for each decoded event', async () => {
    const handler = makeHandler();
    handler.handle.mockResolvedValue({
      id: 'notif-1',
      channel: 'email',
      to: 'a@example.com',
      templateId: 'user.registered.welcome',
      status: 'queued',
      providerMessageId: null,
      attempts: 0,
      lastError: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const config: EventConsumerConfig = {
      enabled: true,
      brokers: ['broker-1:9092'],
      topic: 'user.registered',
      groupId: 'notification-service',
    };
    let capturedHandler: ((event: unknown) => Promise<void>) | undefined;
    const consumer = makeFakeConsumer();
    const consumerFactory = jest
      .fn()
      .mockImplementation((_config, dispatch) => {
        capturedHandler = dispatch as (event: unknown) => Promise<void>;
        return consumer;
      });
    const service = new EventConsumerBootstrapService(
      handler,
      () => config,
      consumerFactory,
    );
    await service.onApplicationBootstrap();

    await capturedHandler?.({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@example.com',
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(handler.handle).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@example.com',
    });
  });
});
