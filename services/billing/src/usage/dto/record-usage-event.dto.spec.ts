import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecordUsageEventDto } from './record-usage-event.dto';

async function validateDto(payload: unknown) {
  const dto = plainToInstance(RecordUsageEventDto, payload);
  return validate(dto);
}

describe('RecordUsageEventDto (BAC-11, AC1)', () => {
  it('accepts a conformant patient.created event payload', async () => {
    const errors = await validateDto({
      eventId: 'evt-1',
      tenantId: 'tenant-a',
      metric: 'patient.created',
      quantity: 1,
      occurredAt: '2026-07-01T00:00:00.000Z',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a conformant encounter.created event payload', async () => {
    const errors = await validateDto({
      eventId: 'evt-2',
      tenantId: 'tenant-a',
      metric: 'encounter.created',
      quantity: 3,
      occurredAt: '2026-07-01T00:00:00.000Z',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a missing eventId', async () => {
    const errors = await validateDto({
      tenantId: 'tenant-a',
      metric: 'patient.created',
      quantity: 1,
      occurredAt: '2026-07-01T00:00:00.000Z',
    });

    expect(errors.some((e) => e.property === 'eventId')).toBe(true);
  });

  it('rejects an unknown metric (not in the closed MeteredMetric catalog)', async () => {
    const errors = await validateDto({
      eventId: 'evt-1',
      tenantId: 'tenant-a',
      metric: 'prescription.filled',
      quantity: 1,
      occurredAt: '2026-07-01T00:00:00.000Z',
    });

    expect(errors.some((e) => e.property === 'metric')).toBe(true);
  });

  it('rejects a non-positive quantity', async () => {
    const errors = await validateDto({
      eventId: 'evt-1',
      tenantId: 'tenant-a',
      metric: 'patient.created',
      quantity: 0,
      occurredAt: '2026-07-01T00:00:00.000Z',
    });

    expect(errors.some((e) => e.property === 'quantity')).toBe(true);
  });

  it('rejects a non-integer quantity', async () => {
    const errors = await validateDto({
      eventId: 'evt-1',
      tenantId: 'tenant-a',
      metric: 'patient.created',
      quantity: 1.5,
      occurredAt: '2026-07-01T00:00:00.000Z',
    });

    expect(errors.some((e) => e.property === 'quantity')).toBe(true);
  });

  it('rejects a non-ISO-8601 occurredAt', async () => {
    const errors = await validateDto({
      eventId: 'evt-1',
      tenantId: 'tenant-a',
      metric: 'patient.created',
      quantity: 1,
      occurredAt: 'not-a-date',
    });

    expect(errors.some((e) => e.property === 'occurredAt')).toBe(true);
  });
});
