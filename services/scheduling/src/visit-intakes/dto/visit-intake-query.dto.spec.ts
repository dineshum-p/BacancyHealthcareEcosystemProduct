import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VisitIntakeQueryDto } from './visit-intake-query.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(VisitIntakeQueryDto, payload);
  return validate(dto);
}

describe('VisitIntakeQueryDto', () => {
  it('accepts an empty query (status omitted)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts ?status=pending', async () => {
    const errors = await validateDto({ status: 'pending' });
    expect(errors).toHaveLength(0);
  });

  it('accepts ?status=linked', async () => {
    const errors = await validateDto({ status: 'linked' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown status value', async () => {
    const errors = await validateDto({ status: 'archived' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
