import { getEventConsumerConfig } from './event-consumer.config';

describe('getEventConsumerConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('defaults to disabled with sensible broker/topic/group defaults', () => {
    delete process.env.KAFKA_CONSUMER_ENABLED;
    delete process.env.KAFKA_BROKERS;
    delete process.env.KAFKA_USER_REGISTERED_TOPIC;
    delete process.env.KAFKA_CONSUMER_GROUP;

    expect(getEventConsumerConfig()).toEqual({
      enabled: false,
      brokers: ['localhost:9092'],
      topic: 'user.registered',
      groupId: 'notification-service',
    });
  });

  it('is enabled only when set to exactly "true"', () => {
    process.env.KAFKA_CONSUMER_ENABLED = 'TRUE';
    expect(getEventConsumerConfig().enabled).toBe(false);

    process.env.KAFKA_CONSUMER_ENABLED = 'true';
    expect(getEventConsumerConfig().enabled).toBe(true);
  });

  it('parses a comma-separated broker list, trimming whitespace', () => {
    process.env.KAFKA_BROKERS = ' broker-1:9092 ,broker-2:9092,broker-3:9092 ';
    expect(getEventConsumerConfig().brokers).toEqual([
      'broker-1:9092',
      'broker-2:9092',
      'broker-3:9092',
    ]);
  });

  it('reads topic/groupId overrides from the environment', () => {
    process.env.KAFKA_USER_REGISTERED_TOPIC = 'custom.topic';
    process.env.KAFKA_CONSUMER_GROUP = 'custom-group';

    expect(getEventConsumerConfig()).toMatchObject({
      topic: 'custom.topic',
      groupId: 'custom-group',
    });
  });
});
