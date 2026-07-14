export interface EventPublisherConfig {
  /**
   * Whether this process should actually connect to Kafka and publish onto
   * a real broker. Defaults to `false` in every environment: no real Kafka
   * broker exists anywhere in this repo/sandbox (mirrors
   * `services/notification`'s BAC-9 `KAFKA_CONSUMER_ENABLED` opt-in
   * convention), so this must never be silently enabled just by this
   * service starting up. When disabled, `EventsModule` binds
   * `DOMAIN_EVENT_PUBLISHER` to a `NoopDomainEventPublisher` instead of
   * `KafkaEventPublisherAdapter` -- `PatientsService` still calls
   * `publishPatientCreated` on every creation either way (BAC-14, AC4), it
   * just never attempts real network I/O unless an operator explicitly
   * opts in against a real, provisioned Kafka cluster.
   */
  enabled: boolean;
  brokers: string[];
  patientCreatedTopic: string;
}

/** Reads BAC-14 AC4's Kafka producer wiring from the environment. */
export function getEventPublisherConfig(): EventPublisherConfig {
  return {
    enabled: process.env.KAFKA_PRODUCER_ENABLED === 'true',
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092')
      .split(',')
      .map((broker) => broker.trim())
      .filter((broker) => broker.length > 0),
    patientCreatedTopic:
      process.env.KAFKA_PATIENT_CREATED_TOPIC ?? 'patient.created',
  };
}
