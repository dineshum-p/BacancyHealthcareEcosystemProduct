import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VitalSignsDto } from './vital-signs.dto';

async function validateVitals(
  plain: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(VitalSignsDto, plain);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

/**
 * BAC-15, AC3: every vital, WHEN PRESENT, must fall within a plausible
 * clinical range or the whole request is rejected with 400 (enforced by
 * `class-validator` decorators, not ad hoc checks -- see this DTO).
 */
describe('VitalSignsDto', () => {
  it('accepts a fully-populated, in-range set of vitals', async () => {
    const errors = await validateVitals({
      heartRate: 80,
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      temperature: 37,
      respiratoryRate: 16,
      spO2: 98,
    });
    expect(errors).toEqual([]);
  });

  it('accepts an empty object (every vital is optional)', async () => {
    const errors = await validateVitals({});
    expect(errors).toEqual([]);
  });

  it.each([
    ['heartRate', 29],
    ['heartRate', 251],
    ['bloodPressureSystolic', 59],
    ['bloodPressureSystolic', 251],
    ['bloodPressureDiastolic', 29],
    ['bloodPressureDiastolic', 151],
    ['temperature', 29],
    ['temperature', 46],
    ['respiratoryRate', 4],
    ['respiratoryRate', 61],
    ['spO2', 49],
    ['spO2', 101],
  ])('rejects an out-of-range %s of %d', async (field, value) => {
    const errors = await validateVitals({ [field]: value });
    expect(errors).toContain(field);
  });

  it('rejects a non-numeric vital', async () => {
    const errors = await validateVitals({ heartRate: 'fast' });
    expect(errors).toContain('heartRate');
  });
});
