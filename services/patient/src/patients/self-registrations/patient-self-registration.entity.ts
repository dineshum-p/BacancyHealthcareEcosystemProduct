import type { PatientSelfRegistrationStatus } from '@hep/shared-types';

/** A row in a tenant's `<schema>.patient_self_registrations` table (BAC-36). */
export interface PatientSelfRegistrationRecord {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string | null;
  phone: string | null;
  email: string | null;
  status: PatientSelfRegistrationStatus;
  matchedPatientId: string | null;
  matchReason: string | null;
  resultingPatientId: string | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
