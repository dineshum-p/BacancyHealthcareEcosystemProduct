import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreatePatientDto, payload);
  return validate(dto);
}

describe('CreatePatientDto', () => {
  it('accepts a minimal, valid payload', async () => {
    const errors = await validateDto({
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-05-12',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a full, valid payload', async () => {
    const errors = await validateDto({
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-05-12',
      gender: 'female',
      phone: '+15551234567',
      email: 'jane@example.com',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing firstName', async () => {
    const errors = await validateDto({
      lastName: 'Doe',
      dateOfBirth: '1990-05-12',
    });
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('rejects a missing lastName', async () => {
    const errors = await validateDto({
      firstName: 'Jane',
      dateOfBirth: '1990-05-12',
    });
    expect(errors.some((e) => e.property === 'lastName')).toBe(true);
  });

  it('rejects a malformed dateOfBirth', async () => {
    const errors = await validateDto({
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: 'not-a-date',
    });
    expect(errors.some((e) => e.property === 'dateOfBirth')).toBe(true);
  });

  it('rejects an invalid gender', async () => {
    const errors = await validateDto({
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-05-12',
      gender: 'unspecified',
    });
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('rejects a malformed email', async () => {
    const errors = await validateDto({
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-05-12',
      email: 'not-an-email',
    });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});
