import type { Allergy, ChronicCondition, Medication } from '@hep/shared-types';

/**
 * A row in a tenant's `<schema>.patient_profiles` table (BAC-44): the
 * patient's baseline clinical profile, decrypted (`allergies`/
 * `chronic_conditions` are stored as `pgcrypto`-encrypted `BYTEA` -- see
 * `PatientProfileRepository`) and deserialized back into plain arrays by the
 * time this leaves the repository layer. Exactly one row per `patientId`
 * (enforced by the table's `UNIQUE` constraint on `patient_id`) -- this is
 * the "baseline, one-time, editable anytime" tier, never versioned/
 * append-only.
 */
export interface PatientProfileRecord {
  id: string;
  patientId: string;
  allergies: Allergy[];
  chronicConditions: ChronicCondition[];
  medications: Medication[];
  createdAt: Date;
  updatedAt: Date;
}
