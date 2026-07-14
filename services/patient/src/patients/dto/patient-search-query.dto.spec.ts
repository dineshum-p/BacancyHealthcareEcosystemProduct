import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PatientSearchQueryDto } from './patient-search-query.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(PatientSearchQueryDto, payload);
  return { dto, errors: await validate(dto) };
}

describe('PatientSearchQueryDto', () => {
  it('accepts an empty query and defaults page/limit', async () => {
    const { dto, errors } = await validateDto({});
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('accepts name/mrn/dateOfBirth filters together', async () => {
    const { errors } = await validateDto({
      name: 'Doe',
      mrn: 'MRN-000001',
      dateOfBirth: '1990-05-12',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a malformed dateOfBirth', async () => {
    const { errors } = await validateDto({ dateOfBirth: '05/12/1990' });
    expect(errors.some((e) => e.property === 'dateOfBirth')).toBe(true);
  });

  it('rejects a limit above the max', async () => {
    const { errors } = await validateDto({ limit: 101 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects a page below 1', async () => {
    const { errors } = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });
});
