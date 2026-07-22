import type { FhirPatientResource } from '@hep/shared-types';

/** A row in a tenant's `<schema>.fhir_patients` table (BAC-10). */
export interface PatientRecord {
  id: string;
  resource: FhirPatientResource;
  createdAt: Date;
  updatedAt: Date;
}
