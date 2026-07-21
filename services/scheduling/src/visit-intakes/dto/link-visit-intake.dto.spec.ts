import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LinkVisitIntakeDto } from './link-visit-intake.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(LinkVisitIntakeDto, payload);
  return validate(dto);
}

const VALID_PAYLOAD = {
  providerId: 'provider-1',
  appointmentId: 'appt-1',
};

describe('LinkVisitIntakeDto', () => {
  it('accepts a valid payload', async () => {
    const errors = await validateDto(VALID_PAYLOAD);
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing providerId', async () => {
    const payload: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete payload.providerId;
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'providerId')).toBe(true);
  });

  it('rejects a missing appointmentId', async () => {
    const payload: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete payload.appointmentId;
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'appointmentId')).toBe(true);
  });
});
