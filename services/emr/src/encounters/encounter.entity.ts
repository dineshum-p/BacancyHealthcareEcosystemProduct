import type { Allergy } from '@hep/shared-types';

/** A row in a tenant's `<schema>.encounters` table (BAC-15). */
export interface EncounterRecord {
  id: string;
  patientId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  heartRate: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  temperature: number | null;
  respiratoryRate: number | null;
  spO2: number | null;
  allergies: Allergy[];
  createdAt: Date;
  updatedAt: Date;
}
