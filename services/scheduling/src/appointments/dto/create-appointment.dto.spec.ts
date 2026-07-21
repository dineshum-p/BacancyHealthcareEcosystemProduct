import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAppointmentDto } from './create-appointment.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateAppointmentDto, payload);
  return validate(dto);
}

const VALID_PAYLOAD = {
  providerId: 'provider-1',
  patientId: 'patient-1',
  startTime: '2026-07-20T09:00:00.000Z',
  endTime: '2026-07-20T09:30:00.000Z',
  notifyChannel: 'email',
  notifyTo: 'patient@example.com',
};

describe('CreateAppointmentDto', () => {
  it('accepts a valid payload', async () => {
    const errors = await validateDto(VALID_PAYLOAD);
    expect(errors).toHaveLength(0);
  });

  it('accepts an sms notifyChannel', async () => {
    const errors = await validateDto({
      ...VALID_PAYLOAD,
      notifyChannel: 'sms',
      notifyTo: '+15551234567',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing providerId', async () => {
    const payload: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete payload.providerId;
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'providerId')).toBe(true);
  });

  it('rejects a missing patientId', async () => {
    const payload: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete payload.patientId;
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'patientId')).toBe(true);
  });

  it('rejects a malformed startTime', async () => {
    const errors = await validateDto({
      ...VALID_PAYLOAD,
      startTime: 'not-a-date',
    });
    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });

  it('rejects a malformed endTime', async () => {
    const errors = await validateDto({
      ...VALID_PAYLOAD,
      endTime: 'not-a-date',
    });
    expect(errors.some((e) => e.property === 'endTime')).toBe(true);
  });

  it('rejects an invalid notifyChannel', async () => {
    const errors = await validateDto({
      ...VALID_PAYLOAD,
      notifyChannel: 'carrier-pigeon',
    });
    expect(errors.some((e) => e.property === 'notifyChannel')).toBe(true);
  });

  it('rejects a missing notifyTo', async () => {
    const payload: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete payload.notifyTo;
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'notifyTo')).toBe(true);
  });
});
