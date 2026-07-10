import { Pool } from 'pg';
import { UsageEventsRepository } from './usage-events.repository';
import { BillingSchemaProvisioner } from './billing-schema.provisioner';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

describe('UsageEventsRepository', () => {
  let pool: Pool;
  let provisioner: BillingSchemaProvisioner;
  let repository: UsageEventsRepository;

  beforeEach(async () => {
    pool = createInMemoryPool();
    provisioner = new BillingSchemaProvisioner(pool);
    repository = new UsageEventsRepository(pool);
    await pool.query('CREATE SCHEMA "tenant_acme"');
    await provisioner.ensureUsageEventsTable('tenant_acme');
  });

  describe('recordIfNew', () => {
    it('persists a new usage event and reports wasNew=true', async () => {
      const { record, wasNew } = await repository.recordIfNew('tenant_acme', {
        eventId: 'evt-1',
        metric: 'patient.created',
        quantity: 1,
        occurredAt: '2026-07-01T00:00:00.000Z',
      });

      expect(wasNew).toBe(true);
      expect(record).toMatchObject({
        eventId: 'evt-1',
        metric: 'patient.created',
        quantity: 1,
      });
      expect(record.id).toEqual(expect.any(String));
      expect(record.occurredAt).toBeInstanceOf(Date);
      expect(record.recordedAt).toBeInstanceOf(Date);
    });

    it('AC3: recording the SAME eventId twice does not double-count -- returns the original record, wasNew=false', async () => {
      const first = await repository.recordIfNew('tenant_acme', {
        eventId: 'evt-dup',
        metric: 'patient.created',
        quantity: 1,
        occurredAt: '2026-07-01T00:00:00.000Z',
      });

      const second = await repository.recordIfNew('tenant_acme', {
        eventId: 'evt-dup',
        // Deliberately different quantity/metric/timestamp on the "replay":
        // the ORIGINAL values must win, proving this is not a naive upsert.
        metric: 'encounter.created',
        quantity: 99,
        occurredAt: '2026-12-25T00:00:00.000Z',
      });

      expect(second.wasNew).toBe(false);
      expect(second.record.id).toBe(first.record.id);
      expect(second.record).toMatchObject({
        eventId: 'evt-dup',
        metric: 'patient.created',
        quantity: 1,
      });

      const totals = await repository.sumByMetric(
        'tenant_acme',
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2027-01-01T00:00:00.000Z'),
      );
      expect(totals.get('patient.created')).toBe(1);
      expect(totals.get('encounter.created')).toBeUndefined();
    });

    it('treats different eventIds as distinct, even for the same metric', async () => {
      await repository.recordIfNew('tenant_acme', {
        eventId: 'evt-a',
        metric: 'patient.created',
        quantity: 1,
        occurredAt: '2026-07-01T00:00:00.000Z',
      });
      await repository.recordIfNew('tenant_acme', {
        eventId: 'evt-b',
        metric: 'patient.created',
        quantity: 1,
        occurredAt: '2026-07-02T00:00:00.000Z',
      });

      const totals = await repository.sumByMetric(
        'tenant_acme',
        new Date('2026-07-01T00:00:00.000Z'),
        new Date('2026-08-01T00:00:00.000Z'),
      );
      expect(totals.get('patient.created')).toBe(2);
    });
  });

  describe('sumByMetric', () => {
    it('aggregates quantity per metric within the period, excluding events outside it', async () => {
      await repository.recordIfNew('tenant_acme', {
        eventId: 'e1',
        metric: 'patient.created',
        quantity: 1,
        occurredAt: '2026-07-01T00:00:00.000Z',
      });
      await repository.recordIfNew('tenant_acme', {
        eventId: 'e2',
        metric: 'patient.created',
        quantity: 2,
        occurredAt: '2026-07-15T12:00:00.000Z',
      });
      await repository.recordIfNew('tenant_acme', {
        eventId: 'e3',
        metric: 'encounter.created',
        quantity: 5,
        occurredAt: '2026-07-20T00:00:00.000Z',
      });
      // Outside the July 2026 period -- must not be counted.
      await repository.recordIfNew('tenant_acme', {
        eventId: 'e4',
        metric: 'patient.created',
        quantity: 100,
        occurredAt: '2026-06-30T23:59:59.000Z',
      });
      await repository.recordIfNew('tenant_acme', {
        eventId: 'e5',
        metric: 'patient.created',
        quantity: 100,
        occurredAt: '2026-08-01T00:00:00.000Z',
      });

      const totals = await repository.sumByMetric(
        'tenant_acme',
        new Date('2026-07-01T00:00:00.000Z'),
        new Date('2026-08-01T00:00:00.000Z'),
      );

      expect(totals.get('patient.created')).toBe(3);
      expect(totals.get('encounter.created')).toBe(5);
    });

    it('returns an empty map when there is no usage in the period', async () => {
      const totals = await repository.sumByMetric(
        'tenant_acme',
        new Date('2026-07-01T00:00:00.000Z'),
        new Date('2026-08-01T00:00:00.000Z'),
      );
      expect(totals.size).toBe(0);
    });

    it('never mixes totals across tenant schemas', async () => {
      await pool.query('CREATE SCHEMA "tenant_other"');
      await provisioner.ensureUsageEventsTable('tenant_other');

      await repository.recordIfNew('tenant_acme', {
        eventId: 'e1',
        metric: 'patient.created',
        quantity: 3,
        occurredAt: '2026-07-01T00:00:00.000Z',
      });
      await repository.recordIfNew('tenant_other', {
        eventId: 'e2',
        metric: 'patient.created',
        quantity: 7,
        occurredAt: '2026-07-01T00:00:00.000Z',
      });

      const acmeTotals = await repository.sumByMetric(
        'tenant_acme',
        new Date('2026-07-01T00:00:00.000Z'),
        new Date('2026-08-01T00:00:00.000Z'),
      );
      expect(acmeTotals.get('patient.created')).toBe(3);
    });
  });
});
