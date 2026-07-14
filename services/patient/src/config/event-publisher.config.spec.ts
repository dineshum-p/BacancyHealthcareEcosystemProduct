import { getEventPublisherConfig } from './event-publisher.config';

describe('getEventPublisherConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('defaults to disabled with sensible broker/topic defaults', () => {
    delete process.env.KAFKA_PRODUCER_ENABLED;
    delete process.env.KAFKA_BROKERS;
    delete process.env.KAFKA_PATIENT_CREATED_TOPIC;

    expect(getEventPublisherConfig()).toEqual({
      enabled: false,
      brokers: ['localhost:9092'],
      patientCreatedTopic: 'patient.created',
    });
  });

  it('is enabled only when set to exactly "true"', () => {
    process.env.KAFKA_PRODUCER_ENABLED = 'TRUE';
    expect(getEventPublisherConfig().enabled).toBe(false);

    process.env.KAFKA_PRODUCER_ENABLED = 'true';
    expect(getEventPublisherConfig().enabled).toBe(true);
  });

  it('parses a comma-separated broker list, trimming whitespace', () => {
    process.env.KAFKA_BROKERS = ' broker-1:9092 ,broker-2:9092,broker-3:9092 ';
    expect(getEventPublisherConfig().brokers).toEqual([
      'broker-1:9092',
      'broker-2:9092',
      'broker-3:9092',
    ]);
  });

  it('reads a topic override from the environment', () => {
    process.env.KAFKA_PATIENT_CREATED_TOPIC = 'custom.patient.created';
    expect(getEventPublisherConfig().patientCreatedTopic).toBe(
      'custom.patient.created',
    );
  });
});
