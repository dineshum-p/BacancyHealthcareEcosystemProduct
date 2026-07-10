import { toFhirPatientResource } from './patient-fhir.mapper';
import { CreatePatientDto } from './dto/create-patient.dto';

describe('toFhirPatientResource', () => {
  it('builds a FHIR Patient resource with the server-assigned id (AC1/AC2)', () => {
    const dto = new CreatePatientDto();
    dto.resourceType = 'Patient';
    dto.name = [{ family: 'Shepard', given: ['Jane'] }];
    dto.gender = 'female';
    dto.birthDate = '1990-05-01';

    const resource = toFhirPatientResource(dto, 'patient-1');

    expect(resource).toEqual({
      resourceType: 'Patient',
      id: 'patient-1',
      active: undefined,
      identifier: undefined,
      name: [{ family: 'Shepard', given: ['Jane'] }],
      telecom: undefined,
      gender: 'female',
      birthDate: '1990-05-01',
      address: undefined,
    });
  });

  it('carries optional fields through when present', () => {
    const dto = new CreatePatientDto();
    dto.resourceType = 'Patient';
    dto.active = true;
    dto.identifier = [{ system: 'urn:mrn', value: 'MRN-1' }];
    dto.name = [{ family: 'Doe' }];
    dto.telecom = [{ system: 'phone', value: '+15551234567' }];
    dto.address = [{ city: 'Metropolis' }];

    const resource = toFhirPatientResource(dto, 'patient-2');

    expect(resource.active).toBe(true);
    expect(resource.identifier).toEqual([
      { system: 'urn:mrn', value: 'MRN-1' },
    ]);
    expect(resource.telecom).toEqual([
      { system: 'phone', value: '+15551234567' },
    ]);
    expect(resource.address).toEqual([{ city: 'Metropolis' }]);
  });
});
