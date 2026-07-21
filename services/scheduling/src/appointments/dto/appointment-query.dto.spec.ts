import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppointmentQueryDto } from './appointment-query.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(AppointmentQueryDto, payload);
  return validate(dto);
}

describe('AppointmentQueryDto', () => {
  it('accepts a bare date', async () => {
    const errors = await validateDto({ date: '2026-07-20' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a date with a providerId', async () => {
    const errors = await validateDto({
      date: '2026-07-20',
      providerId: 'provider-1',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing date', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });

  it('rejects a malformed date', async () => {
    const errors = await validateDto({ date: '07/20/2026' });
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });
});
