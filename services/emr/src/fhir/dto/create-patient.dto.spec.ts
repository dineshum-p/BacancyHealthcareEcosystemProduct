import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';

async function validateDto(payload: unknown) {
  const dto = plainToInstance(CreatePatientDto, payload);
  return validate(dto);
}

describe('CreatePatientDto (BAC-10, AC2/AC3)', () => {
  it('accepts a minimal, conformant FHIR R4 Patient payload', async () => {
    const errors = await validateDto({
      resourceType: 'Patient',
      name: [{ family: 'Shepard', given: ['Jane'] }],
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a fully-populated conformant payload', async () => {
    const errors = await validateDto({
      resourceType: 'Patient',
      active: true,
      identifier: [{ system: 'urn:mrn', value: 'MRN-1' }],
      name: [{ use: 'official', family: 'Shepard', given: ['Jane'] }],
      telecom: [{ system: 'phone', value: '+15551234567' }],
      gender: 'female',
      birthDate: '1990-05-01',
      address: [{ line: ['1 Main St'], city: 'Metropolis' }],
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a payload with the wrong resourceType (AC3)', async () => {
    const errors = await validateDto({
      resourceType: 'Observation',
      name: [{ family: 'Shepard' }],
    });

    expect(errors.some((e) => e.property === 'resourceType')).toBe(true);
  });

  it('rejects a payload missing resourceType entirely (AC3)', async () => {
    const errors = await validateDto({
      name: [{ family: 'Shepard' }],
    });

    expect(errors.some((e) => e.property === 'resourceType')).toBe(true);
  });

  it('rejects a payload with no name at all (AC3)', async () => {
    const errors = await validateDto({ resourceType: 'Patient' });

    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a name entry missing the required family field (AC3)', async () => {
    const errors = await validateDto({
      resourceType: 'Patient',
      name: [{ given: ['Jane'] }],
    });

    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects an invalid gender value (AC3)', async () => {
    const errors = await validateDto({
      resourceType: 'Patient',
      name: [{ family: 'Shepard' }],
      gender: 'not-a-real-gender',
    });

    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('rejects a non-ISO-date birthDate (AC3)', async () => {
    const errors = await validateDto({
      resourceType: 'Patient',
      name: [{ family: 'Shepard' }],
      birthDate: 'not-a-date',
    });

    expect(errors.some((e) => e.property === 'birthDate')).toBe(true);
  });
});
