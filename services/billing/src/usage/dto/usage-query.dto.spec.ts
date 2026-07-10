import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UsageQueryDto } from './usage-query.dto';

async function validateDto(payload: unknown) {
  const dto = plainToInstance(UsageQueryDto, payload);
  return validate(dto);
}

describe('UsageQueryDto (BAC-11, AC2)', () => {
  it('accepts a well-formed query', async () => {
    const errors = await validateDto({
      tenantId: 'tenant-a',
      period: '2026-07',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing tenantId', async () => {
    const errors = await validateDto({ period: '2026-07' });
    expect(errors.some((e) => e.property === 'tenantId')).toBe(true);
  });

  it('rejects a malformed period (not YYYY-MM)', async () => {
    const errors = await validateDto({
      tenantId: 'tenant-a',
      period: '2026/07',
    });
    expect(errors.some((e) => e.property === 'period')).toBe(true);
  });

  it('rejects an out-of-range month', async () => {
    const errors = await validateDto({
      tenantId: 'tenant-a',
      period: '2026-13',
    });
    expect(errors.some((e) => e.property === 'period')).toBe(true);
  });

  it('rejects a missing period', async () => {
    const errors = await validateDto({ tenantId: 'tenant-a' });
    expect(errors.some((e) => e.property === 'period')).toBe(true);
  });
});
