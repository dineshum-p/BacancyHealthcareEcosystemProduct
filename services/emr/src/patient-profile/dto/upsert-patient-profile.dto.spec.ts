import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertPatientProfileDto } from './upsert-patient-profile.dto';

const VALID_PAYLOAD = {
  allergies: [{ substance: 'Penicillin', severity: 'severe' }],
  chronicConditions: [{ name: 'Asthma' }],
  medications: [{ name: 'Albuterol', dosage: '90mcg' }],
};

async function validateDto(plain: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(UpsertPatientProfileDto, plain);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('UpsertPatientProfileDto', () => {
  it('accepts a fully-populated, valid payload', async () => {
    expect(await validateDto(VALID_PAYLOAD)).toEqual([]);
  });

  it('accepts an entirely empty (but present) baseline: no known allergies/conditions/medications', async () => {
    expect(
      await validateDto({
        allergies: [],
        chronicConditions: [],
        medications: [],
      }),
    ).toEqual([]);
  });

  it('rejects a payload missing the allergies field entirely', async () => {
    const errors = await validateDto({
      chronicConditions: VALID_PAYLOAD.chronicConditions,
      medications: VALID_PAYLOAD.medications,
    });
    expect(errors).toContain('allergies');
  });

  it('rejects a payload missing the chronicConditions field entirely', async () => {
    const errors = await validateDto({
      allergies: VALID_PAYLOAD.allergies,
      medications: VALID_PAYLOAD.medications,
    });
    expect(errors).toContain('chronicConditions');
  });

  it('rejects a payload missing the medications field entirely', async () => {
    const errors = await validateDto({
      allergies: VALID_PAYLOAD.allergies,
      chronicConditions: VALID_PAYLOAD.chronicConditions,
    });
    expect(errors).toContain('medications');
  });

  it('rejects a malformed nested allergy entry (nested array validation)', async () => {
    const errors = await validateDto({
      ...VALID_PAYLOAD,
      allergies: [{ severity: 'severe' }],
    });
    expect(errors).toContain('allergies');
  });

  it('rejects a malformed nested chronic condition entry (nested array validation)', async () => {
    const errors = await validateDto({
      ...VALID_PAYLOAD,
      chronicConditions: [{ diagnosedDate: '2020-01-01' }],
    });
    expect(errors).toContain('chronicConditions');
  });

  it('rejects a malformed nested medication entry (nested array validation)', async () => {
    const errors = await validateDto({
      ...VALID_PAYLOAD,
      medications: [{ dosage: '10mg' }],
    });
    expect(errors).toContain('medications');
  });

  describe('array size bound (defense-in-depth against an oversized payload)', () => {
    it('rejects an allergies list exceeding the max allowed entries', async () => {
      const errors = await validateDto({
        ...VALID_PAYLOAD,
        allergies: Array.from({ length: 101 }, (_, i) => ({
          substance: `Substance ${i}`,
        })),
      });
      expect(errors).toContain('allergies');
    });

    it('rejects a chronicConditions list exceeding the max allowed entries', async () => {
      const errors = await validateDto({
        ...VALID_PAYLOAD,
        chronicConditions: Array.from({ length: 101 }, (_, i) => ({
          name: `Condition ${i}`,
        })),
      });
      expect(errors).toContain('chronicConditions');
    });

    it('rejects a medications list exceeding the max allowed entries', async () => {
      const errors = await validateDto({
        ...VALID_PAYLOAD,
        medications: Array.from({ length: 101 }, (_, i) => ({
          name: `Medication ${i}`,
        })),
      });
      expect(errors).toContain('medications');
    });

    it('accepts a list at exactly the max allowed entries (boundary is inclusive)', async () => {
      const errors = await validateDto({
        ...VALID_PAYLOAD,
        allergies: Array.from({ length: 100 }, (_, i) => ({
          substance: `Substance ${i}`,
        })),
      });
      expect(errors).toEqual([]);
    });
  });
});
