import { NoopDomainEventPublisher } from './noop-domain-event-publisher';

describe('NoopDomainEventPublisher', () => {
  it('resolves without throwing for a well-formed event', async () => {
    const publisher = new NoopDomainEventPublisher();

    await expect(
      publisher.publishPatientCreated({
        eventId: 'p1',
        patientId: 'p1',
        tenantId: 't1',
        createdAt: '2026-07-14T00:00:00.000Z',
      }),
    ).resolves.toBeUndefined();
  });
});
