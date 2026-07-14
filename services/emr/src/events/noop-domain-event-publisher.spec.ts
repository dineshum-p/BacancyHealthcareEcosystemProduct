import { NoopDomainEventPublisher } from './noop-domain-event-publisher';

describe('NoopDomainEventPublisher', () => {
  it('resolves without throwing for a well-formed event', async () => {
    const publisher = new NoopDomainEventPublisher();

    await expect(
      publisher.publishEncounterCreated({
        eventId: 'encounter-1',
        encounterId: 'encounter-1',
        patientId: 'patient-1',
        tenantId: 'tenant-1',
        createdAt: '2026-07-14T00:00:00.000Z',
      }),
    ).resolves.toBeUndefined();
  });
});
