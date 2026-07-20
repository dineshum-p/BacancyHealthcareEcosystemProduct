import { AppointmentStatus } from './appointment-status.enum';

/** A row in a tenant's `<schema>.appointments` table (BAC-16). */
export interface AppointmentRecord {
  id: string;
  providerId: string;
  patientId: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}
