import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MedicationDto } from './medication.dto';

async function validateMedication(
  plain: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(MedicationDto, plain);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('MedicationDto', () => {
  it('accepts a fully-populated medication entry', async () => {
    const errors = await validateMedication({
      name: 'Metformin',
      dosage: '500mg',
      frequency: 'twice daily',
      notes: 'Taken with food',
    });
    expect(errors).toEqual([]);
  });

  it('accepts an entry with only a name (dosage/frequency/notes optional)', async () => {
    const errors = await validateMedication({ name: 'Albuterol' });
    expect(errors).toEqual([]);
  });

  it('rejects a missing name', async () => {
    const errors = await validateMedication({ dosage: '10mg' });
    expect(errors).toContain('name');
  });
});
