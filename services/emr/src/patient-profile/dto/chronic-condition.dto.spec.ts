import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChronicConditionDto } from './chronic-condition.dto';

async function validateChronicCondition(
  plain: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(ChronicConditionDto, plain);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('ChronicConditionDto', () => {
  it('accepts a fully-populated chronic condition entry', async () => {
    const errors = await validateChronicCondition({
      name: 'Type 2 Diabetes',
      diagnosedDate: '2020-05-01',
      notes: 'Managed with metformin',
    });
    expect(errors).toEqual([]);
  });

  it('accepts an entry with only a name (diagnosedDate/notes optional)', async () => {
    const errors = await validateChronicCondition({ name: 'Asthma' });
    expect(errors).toEqual([]);
  });

  it('rejects a missing name', async () => {
    const errors = await validateChronicCondition({ notes: 'no name given' });
    expect(errors).toContain('name');
  });

  it('rejects a malformed diagnosedDate', async () => {
    const errors = await validateChronicCondition({
      name: 'Asthma',
      diagnosedDate: 'not-a-date',
    });
    expect(errors).toContain('diagnosedDate');
  });
});
