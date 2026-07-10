import type { MeteredDomainEvent } from '@hep/shared-types';
import { UsageService } from './usage.service';
import { UsageEventsRepository } from './usage-events.repository';
import { BillingSchemaProvisioner } from './billing-schema.provisioner';
import { UsageEventRecord } from './usage-event.entity';

describe('UsageService', () => {
  let repository: jest.Mocked<UsageEventsRepository>;
  let schemaProvisioner: jest.Mocked<BillingSchemaProvisioner>;
  let service: UsageService;

  beforeEach(() => {
    repository = {
      recordIfNew: jest.fn(),
      sumByMetric: jest.fn(),
    } as unknown as jest.Mocked<UsageEventsRepository>;
    schemaProvisioner = {
      ensureUsageEventsTable: jest.fn().mockResolvedValue(undefined),
      ensureAuditLogsTable: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BillingSchemaProvisioner>;
    service = new UsageService(repository, schemaProvisioner);
  });

  describe('recordEvent', () => {
    const event: MeteredDomainEvent = {
      eventId: 'evt-1',
      tenantId: 'tenant-1',
      metric: 'patient.created',
      quantity: 1,
      occurredAt: '2026-07-01T00:00:00.000Z',
    };

    it('provisions the schema, delegates to the repository, and maps the response (AC1)', async () => {
      const record: UsageEventRecord = {
        id: 'record-1',
        eventId: 'evt-1',
        metric: 'patient.created',
        quantity: 1,
        occurredAt: new Date('2026-07-01T00:00:00.000Z'),
        recordedAt: new Date('2026-07-01T00:05:00.000Z'),
      };
      repository.recordIfNew.mockResolvedValue({ record, wasNew: true });

      const result = await service.recordEvent('tenant_acme', event);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensureUsageEventsTable).toHaveBeenCalledWith(
        'tenant_acme',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.recordIfNew).toHaveBeenCalledWith('tenant_acme', {
        eventId: 'evt-1',
        metric: 'patient.created',
        quantity: 1,
        occurredAt: '2026-07-01T00:00:00.000Z',
      });
      expect(result).toEqual({
        id: 'record-1',
        eventId: 'evt-1',
        tenantId: 'tenant-1',
        metric: 'patient.created',
        quantity: 1,
        occurredAt: '2026-07-01T00:00:00.000Z',
        recordedAt: '2026-07-01T00:05:00.000Z',
      });
    });

    it('AC3: a duplicate eventId returns the ORIGINALLY recorded values, not the replay payload', async () => {
      const originalRecord: UsageEventRecord = {
        id: 'record-1',
        eventId: 'evt-1',
        metric: 'patient.created',
        quantity: 1,
        occurredAt: new Date('2026-07-01T00:00:00.000Z'),
        recordedAt: new Date('2026-07-01T00:05:00.000Z'),
      };
      repository.recordIfNew.mockResolvedValue({
        record: originalRecord,
        wasNew: false,
      });

      const replay: MeteredDomainEvent = {
        ...event,
        metric: 'encounter.created',
        quantity: 999,
      };

      const result = await service.recordEvent('tenant_acme', replay);

      expect(result.metric).toBe('patient.created');
      expect(result.quantity).toBe(1);
    });
  });

  describe('getUsageSummary', () => {
    it('AC2/AC4: zero-fills every known metric and flags one that exceeds its plan limit', async () => {
      repository.sumByMetric.mockResolvedValue(
        new Map([['patient.created', 150]]),
      );

      const result = await service.getUsageSummary(
        'tenant_acme',
        'tenant-1',
        'starter',
        '2026-07',
      );

      expect(result.tenantId).toBe('tenant-1');
      expect(result.period).toBe('2026-07');
      expect(result.metrics).toEqual(
        expect.arrayContaining([
          {
            metric: 'patient.created',
            quantity: 150,
            limit: 100,
            limitExceeded: true,
          },
          {
            metric: 'encounter.created',
            quantity: 0,
            limit: 250,
            limitExceeded: false,
          },
        ]),
      );
      expect(result.metrics).toHaveLength(2);
    });

    it('flags exactly-at-limit usage as exceeded (>= semantics)', async () => {
      repository.sumByMetric.mockResolvedValue(
        new Map([['patient.created', 100]]),
      );

      const result = await service.getUsageSummary(
        'tenant_acme',
        'tenant-1',
        'starter',
        '2026-07',
      );

      const patientMetric = result.metrics.find(
        (m) => m.metric === 'patient.created',
      );
      expect(patientMetric?.limitExceeded).toBe(true);
    });

    it('resolves limits per the tenant plan, not a fixed default', async () => {
      repository.sumByMetric.mockResolvedValue(
        new Map([['patient.created', 150]]),
      );

      const result = await service.getUsageSummary(
        'tenant_acme',
        'tenant-1',
        'growth',
        '2026-07',
      );

      const patientMetric = result.metrics.find(
        (m) => m.metric === 'patient.created',
      );
      expect(patientMetric).toEqual({
        metric: 'patient.created',
        quantity: 150,
        limit: 1000,
        limitExceeded: false,
      });
    });

    it('provisions the schema before aggregating', async () => {
      repository.sumByMetric.mockResolvedValue(new Map());

      await service.getUsageSummary(
        'tenant_acme',
        'tenant-1',
        'starter',
        '2026-07',
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensureUsageEventsTable).toHaveBeenCalledWith(
        'tenant_acme',
      );
    });
  });
});
