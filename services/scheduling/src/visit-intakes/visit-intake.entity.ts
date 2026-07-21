import { VisitIntakeStatus } from './visit-intake-status.enum';

/**
 * A row in a tenant's `<schema>.visit_intakes` table (BAC-45): a patient's
 * own, per-visit intake submission -- decrypted (`reasonForVisit`/
 * `symptoms`/`whatsNewSinceLastVisit` are stored as `pgcrypto`-encrypted
 * `BYTEA`, see `VisitIntakesRepository`) and deserialized back into plain
 * strings by the time this leaves the repository layer.
 *
 * Every `POST /visit-intakes` creates a BRAND NEW row -- there is no
 * uniqueness constraint on `patient_id`, deliberately unlike BAC-44's
 * `patient_profiles` table -- so a repeat patient submitting intake for
 * another visit always gets a fresh, standalone record ("fresh at every
 * booking"), never merged into a prior one.
 *
 * `assignedProviderId`/`appointmentId` are both `null` until staff link a
 * specific provider + BAC-16/21 appointment to this intake (`status`
 * transitions `pending` -> `linked` at the same time).
 */
export interface VisitIntakeRecord {
  id: string;
  patientId: string;
  reasonForVisit: string;
  symptoms: string;
  whatsNewSinceLastVisit: string;
  status: VisitIntakeStatus;
  assignedProviderId: string | null;
  appointmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
