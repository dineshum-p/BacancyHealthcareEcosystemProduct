import type { FhirPatientResource } from '@hep/shared-types';
import { toPatientProfileDemographics } from './demographics.util';

describe('toPatientProfileDemographics', () => {
  it('extracts firstName/lastName/dateOfBirth from a FHIR Patient resource', () => {
    const resource: FhirPatientResource = {
      resourceType: 'Patient',
      id: 'p1',
      name: [{ family: 'Doe', given: ['Jane', 'Middle'] }],
      birthDate: '1990-05-01',
    };

    expect(toPatientProfileDemographics(resource)).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-05-01',
    });
  });

  it('returns all-null demographics when no FHIR Patient resource exists for this id', () => {
    expect(toPatientProfileDemographics(null)).toEqual({
      firstName: null,
      lastName: null,
      dateOfBirth: null,
    });
  });

  it('returns all-null fields when the resource has no name/birthDate at all', () => {
    const resource: FhirPatientResource = { resourceType: 'Patient', id: 'p1' };

    expect(toPatientProfileDemographics(resource)).toEqual({
      firstName: null,
      lastName: null,
      dateOfBirth: null,
    });
  });

  it('handles a name entry with no given names', () => {
    const resource: FhirPatientResource = {
      resourceType: 'Patient',
      id: 'p1',
      name: [{ family: 'Doe' }],
    };

    expect(toPatientProfileDemographics(resource)).toEqual({
      firstName: null,
      lastName: 'Doe',
      dateOfBirth: null,
    });
  });
});
