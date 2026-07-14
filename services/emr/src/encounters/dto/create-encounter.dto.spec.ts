import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEncounterDto } from './create-encounter.dto';

const VALID_PAYLOAD = {
  soapNote: {
    subjective: 'Patient reports dizziness.',
    objective: 'BP 150/95, HR 88.',
    assessment: 'Suspected hypertension.',
    plan: 'Start lisinopril, follow up in 2 weeks.',
  },
  vitals: {
    heartRate: 88,
    bloodPressureSystolic: 150,
    bloodPressureDiastolic: 95,
    temperature: 37.1,
    respiratoryRate: 18,
    spO2: 97,
  },
  allergies: [{ substance: 'Penicillin', severity: 'severe' }],
};

async function validateDto(plain: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(CreateEncounterDto, plain);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('CreateEncounterDto', () => {
  it('accepts a fully-populated, valid payload (AC1)', async () => {
    expect(await validateDto(VALID_PAYLOAD)).toEqual([]);
  });

  it('accepts a payload with no vitals/allergies at all (both optional)', async () => {
    expect(await validateDto({ soapNote: VALID_PAYLOAD.soapNote })).toEqual([]);
  });

  it('rejects a payload missing the soapNote entirely', async () => {
    const errors = await validateDto({ vitals: VALID_PAYLOAD.vitals });
    expect(errors).toContain('soapNote');
  });

  it('rejects a payload with an incomplete soapNote (nested validation, AC1)', async () => {
    const errors = await validateDto({
      soapNote: { ...VALID_PAYLOAD.soapNote, plan: '' },
    });
    expect(errors).toContain('soapNote');
  });

  it('rejects a payload with an out-of-range vital (nested validation, AC3)', async () => {
    const errors = await validateDto({
      soapNote: VALID_PAYLOAD.soapNote,
      vitals: { heartRate: 999 },
    });
    expect(errors).toContain('vitals');
  });

  it('rejects a payload with a malformed allergy entry (nested array validation)', async () => {
    const errors = await validateDto({
      soapNote: VALID_PAYLOAD.soapNote,
      allergies: [{ severity: 'severe' }],
    });
    expect(errors).toContain('allergies');
  });
});
