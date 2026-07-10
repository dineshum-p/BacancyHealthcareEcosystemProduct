import type { UserRegisteredEvent } from '@hep/shared-types';

/**
 * Parses/validates a raw Kafka message value (a `user.registered` domain
 * event, AC4) into the `UserRegisteredEvent` contract. Kept as a small pure
 * function, independent of `kafkajs`, so it can be unit-tested directly
 * against representative payloads without a live broker (per this ticket's
 * instructions) -- `KafkaEventConsumerAdapter` is the only caller.
 *
 * Throws on anything that doesn't match the expected shape; the adapter
 * catches this per-message so one malformed event does not crash the
 * consumer loop for every subsequent message.
 */
export function parseUserRegisteredEvent(
  raw: Buffer | string | null,
): UserRegisteredEvent {
  if (raw === null) {
    throw new Error('Cannot parse an empty user.registered message value.');
  }

  const text = typeof raw === 'string' ? raw : raw.toString('utf8');
  const payload: unknown = JSON.parse(text);

  if (typeof payload !== 'object' || payload === null) {
    throw new Error('user.registered payload must be a JSON object.');
  }

  const candidate = payload as Record<string, unknown>;
  assertRequiredString(candidate, 'userId');
  assertRequiredString(candidate, 'tenantId');
  assertRequiredString(candidate, 'email');
  if (candidate.name !== undefined && typeof candidate.name !== 'string') {
    throw new Error('user.registered "name", if present, must be a string.');
  }

  return {
    userId: candidate.userId as string,
    tenantId: candidate.tenantId as string,
    email: candidate.email as string,
    name: candidate.name,
  };
}

function assertRequiredString(
  candidate: Record<string, unknown>,
  field: string,
): void {
  if (typeof candidate[field] !== 'string' || candidate[field] === '') {
    throw new Error(
      `user.registered payload is missing a required string field "${field}".`,
    );
  }
}
