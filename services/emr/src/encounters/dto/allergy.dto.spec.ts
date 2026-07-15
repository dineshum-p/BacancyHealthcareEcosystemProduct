import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AllergyDto } from './allergy.dto';

async function validateAllergy(
  plain: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(AllergyDto, plain);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('AllergyDto', () => {
  it('accepts a fully-populated allergy entry', async () => {
    const errors = await validateAllergy({
      substance: 'Penicillin',
      reaction: 'Hives',
      severity: 'severe',
    });
    expect(errors).toEqual([]);
  });

  it('accepts an allergy with only a substance (reaction/severity optional)', async () => {
    const errors = await validateAllergy({ substance: 'Peanuts' });
    expect(errors).toEqual([]);
  });

  it('rejects a missing substance', async () => {
    const errors = await validateAllergy({ reaction: 'Hives' });
    expect(errors).toContain('substance');
  });

  it('rejects an unrecognized severity', async () => {
    const errors = await validateAllergy({
      substance: 'Penicillin',
      severity: 'extreme',
    });
    expect(errors).toContain('severity');
  });
});
