import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import type { PatientSelfRegistrationStatus } from '@hep/shared-types';
import { PG_POOL } from '../../database/database.tokens';
import { quoteSchemaIdentifier } from '../../tenants/schema-identifier.util';
import { PatientSelfRegistrationRecord } from './patient-self-registration.entity';

interface SelfRegistrationRow {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: Date;
  gender: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  matched_patient_id: string | null;
  match_reason: string | null;
  resulting_patient_id: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSelfRegistrationInput {
  firstName: string;
  lastName: string;
  /** ISO-8601 date/date-time string; only the date component is persisted. */
  dateOfBirth: string;
  gender?: string;
  phone?: string;
  email?: string;
  matchedPatientId?: string | null;
  matchReason?: string | null;
}

export interface ReviewSelfRegistrationInput {
  status: PatientSelfRegistrationStatus;
  resultingPatientId?: string | null;
  reviewNote?: string | null;
  reviewedBy: string | null;
}

/**
 * Data access for a tenant's `<schema>.patient_self_registrations` table
 * (BAC-36). Every query is fully-qualified with the caller's tenant schema,
 * same convention as `PatientsRepository`.
 */
@Injectable()
export class PatientSelfRegistrationsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private static readonly COLUMNS = `id, first_name, last_name, date_of_birth, gender, phone, email,
       status, matched_patient_id, match_reason, resulting_patient_id,
       review_note, reviewed_by, reviewed_at, created_at, updated_at`;

  async insert(
    schemaName: string,
    input: CreateSelfRegistrationInput,
  ): Promise<PatientSelfRegistrationRecord> {
    const schema = quoteSchemaIdentifier(schemaName);
    const id = randomUUID();

    const result: QueryResult<SelfRegistrationRow> = await this.pool.query(
      `INSERT INTO ${schema}.patient_self_registrations
         (id, first_name, last_name, date_of_birth, gender, phone, email, status, matched_patient_id, match_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
       RETURNING ${PatientSelfRegistrationsRepository.COLUMNS}`,
      [
        id,
        input.firstName,
        input.lastName,
        input.dateOfBirth,
        input.gender ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.matchedPatientId ?? null,
        input.matchReason ?? null,
      ],
    );
    return this.toEntity(result.rows[0]);
  }

  async findById(
    schemaName: string,
    id: string,
  ): Promise<PatientSelfRegistrationRecord | null> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result: QueryResult<SelfRegistrationRow> = await this.pool.query(
      `SELECT ${PatientSelfRegistrationsRepository.COLUMNS}
       FROM ${schema}.patient_self_registrations
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  /** Lists self-registrations for this tenant, newest first; `status` optionally narrows to one lifecycle state. */
  async list(
    schemaName: string,
    status?: PatientSelfRegistrationStatus,
  ): Promise<PatientSelfRegistrationRecord[]> {
    const schema = quoteSchemaIdentifier(schemaName);
    const whereClause = status ? 'WHERE status = $1' : '';
    const values = status ? [status] : [];

    const result: QueryResult<SelfRegistrationRow> = await this.pool.query(
      `SELECT ${PatientSelfRegistrationsRepository.COLUMNS}
       FROM ${schema}.patient_self_registrations
       ${whereClause}
       ORDER BY created_at DESC, id DESC`,
      values,
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  /** Applies a staff review decision (approve/reject/merge) to a self-registration. */
  async review(
    schemaName: string,
    id: string,
    input: ReviewSelfRegistrationInput,
  ): Promise<PatientSelfRegistrationRecord> {
    const schema = quoteSchemaIdentifier(schemaName);

    const result: QueryResult<SelfRegistrationRow> = await this.pool.query(
      `UPDATE ${schema}.patient_self_registrations
       SET status = $2,
           resulting_patient_id = $3,
           review_note = $4,
           reviewed_by = $5,
           reviewed_at = now(),
           updated_at = now()
       WHERE id = $1
       RETURNING ${PatientSelfRegistrationsRepository.COLUMNS}`,
      [
        id,
        input.status,
        input.resultingPatientId ?? null,
        input.reviewNote ?? null,
        input.reviewedBy,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(
        `Failed to review self-registration "${id}": no such row in schema "${schemaName}".`,
      );
    }
    return this.toEntity(row);
  }

  private toEntity(row: SelfRegistrationRow): PatientSelfRegistrationRecord {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      phone: row.phone,
      email: row.email,
      status: row.status as PatientSelfRegistrationStatus,
      matchedPatientId: row.matched_patient_id,
      matchReason: row.match_reason,
      resultingPatientId: row.resulting_patient_id,
      reviewNote: row.review_note,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
