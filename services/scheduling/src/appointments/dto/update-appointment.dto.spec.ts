import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAppointmentDto } from './update-appointment.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateAppointmentDto, payload);
  return validate(dto);
}

describe('UpdateAppointmentDto', () => {
  it('accepts a valid cancel action with no time range', async () => {
    const errors = await validateDto({ action: 'cancel' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid reschedule action with a new time range', async () => {
    const errors = await validateDto({
      action: 'reschedule',
      startTime: '2026-07-20T15:00:00.000Z',
      endTime: '2026-07-20T15:30:00.000Z',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid action', async () => {
    const errors = await validateDto({ action: 'delete' });
    expect(errors.some((e) => e.property === 'action')).toBe(true);
  });

  it('rejects a reschedule missing startTime/endTime', async () => {
    const errors = await validateDto({ action: 'reschedule' });
    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
    expect(errors.some((e) => e.property === 'endTime')).toBe(true);
  });

  it('rejects a reschedule with a malformed startTime', async () => {
    const errors = await validateDto({
      action: 'reschedule',
      startTime: 'not-a-date',
      endTime: '2026-07-20T15:30:00.000Z',
    });
    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });

  it('does not validate startTime/endTime format for a cancel action', async () => {
    const errors = await validateDto({
      action: 'cancel',
      startTime: 'garbage',
    });
    expect(errors).toHaveLength(0);
  });
});
