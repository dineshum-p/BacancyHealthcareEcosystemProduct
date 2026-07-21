import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVisitIntakeDto } from './create-visit-intake.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateVisitIntakeDto, payload);
  return validate(dto);
}

const VALID_PAYLOAD = {
  reasonForVisit: 'Annual checkup',
  symptoms: 'Mild headache for the past two days',
  whatsNewSinceLastVisit: 'Started a new medication',
};

describe('CreateVisitIntakeDto', () => {
  it('accepts a valid payload', async () => {
    const errors = await validateDto(VALID_PAYLOAD);
    expect(errors).toHaveLength(0);
  });

  it('accepts a payload omitting the optional whatsNewSinceLastVisit', async () => {
    const payload: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete payload.whatsNewSinceLastVisit;
    const errors = await validateDto(payload);
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing reasonForVisit', async () => {
    const payload: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete payload.reasonForVisit;
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'reasonForVisit')).toBe(true);
  });

  it('rejects an empty reasonForVisit', async () => {
    const errors = await validateDto({ ...VALID_PAYLOAD, reasonForVisit: '' });
    expect(errors.some((e) => e.property === 'reasonForVisit')).toBe(true);
  });

  it('rejects a missing symptoms', async () => {
    const payload: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete payload.symptoms;
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'symptoms')).toBe(true);
  });

  it('rejects a non-string whatsNewSinceLastVisit', async () => {
    const errors = await validateDto({
      ...VALID_PAYLOAD,
      whatsNewSinceLastVisit: 12345,
    });
    expect(errors.some((e) => e.property === 'whatsNewSinceLastVisit')).toBe(
      true,
    );
  });
});
