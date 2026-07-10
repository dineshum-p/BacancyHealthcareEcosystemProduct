export interface EventConsumerConfig {
  /**
   * Whether this process should connect to Kafka at all. Defaults to
   * `false` in every environment: no real Kafka broker exists anywhere in
   * this repo/sandbox (see
   * `src/notifications/events/README.md` for the full scope boundary), so
   * this must never be silently enabled just by this service starting up.
   */
  enabled: boolean;
  brokers: string[];
  topic: string;
  groupId: string;
}

/** Reads AC4's Kafka consumer wiring from the environment. */
export function getEventConsumerConfig(): EventConsumerConfig {
  return {
    enabled: process.env.KAFKA_CONSUMER_ENABLED === 'true',
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092')
      .split(',')
      .map((broker) => broker.trim())
      .filter((broker) => broker.length > 0),
    topic: process.env.KAFKA_USER_REGISTERED_TOPIC ?? 'user.registered',
    groupId: process.env.KAFKA_CONSUMER_GROUP ?? 'notification-service',
  };
}
