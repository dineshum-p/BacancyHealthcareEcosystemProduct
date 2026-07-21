import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import type { VisitIntakeStatus } from '@hep/shared-types';
import { PG_POOL } from '../database/database.tokens';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { getPgcryptoConfig } from '../config/pgcrypto.config';
import { VisitIntakeRecord } from './visit-intake.entity';
import { VisitIntakeStatus as VisitIntakeStatusEnum } from './visit-intake-status.enum';

interface VisitIntakeRow {
  id: string;
  patient_id: string;
  reason_for_visit: string;
  symptoms: string;
  whats_new_since_last_visit: string;
  status: string;
  assigned_provider_id: string | null;
  appointment_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateVisitIntakeInput {
  patientId: string;
  reasonForVisit: string;
  symptoms: string;
  whatsNewSinceLastVisit: string;
}

export interface LinkVisitIntakeInput {
  assignedProviderId: string;
  appointmentId: string;
}

/**
 * A `RETURNING`/`SELECT` projection shared by every query in this
 * repository: `pgp_sym_decrypt(reason_for_visit, $1)`/
 * `pgp_sym_decrypt(symptoms, $1)`/`pgp_sym_decrypt(whats_new_since_last_visit,
 * $1)` decrypt the pgcrypto-encrypted columns back into plaintext INLINE, in
 * the same statement that reads them -- this repository never receives the
 * raw encrypted bytes and separately decrypts them in application code,
 * mirroring `services/emr`'s BAC-44 `PatientProfileRepository`'s
 * `DECRYPTED_PROJECTION` exactly (see that class's doc comment for the full
 * pattern this replicates).
 */
const DECRYPTED_PROJECTION = `
  id, patient_id,
  pgp_sym_decrypt(reason_for_visit, $1) AS reason_for_visit,
  pgp_sym_decrypt(symptoms, $1) AS symptoms,
  pgp_sym_decrypt(whats_new_since_last_visit, $1) AS whats_new_since_last_visit,
  status, assigned_provider_id, appointment_id, created_at, updated_at
`;

/**
 * Data access for a tenant's `<schema>.visit_intakes` table (BAC-45). Every
 * query is fully-qualified with the caller's tenant schema, same convention
 * as every other schema-scoped repository in this repo.
 *
 * `insert` is the ONLY write path that creates a row -- there is no
 * upsert/update-in-place for the PHI fields themselves (unlike BAC-44's
 * `PatientProfileRepository.upsert`): every `POST /visit-intakes` is a
 * brand-new, standalone record ("fresh at every booking"). `link` is the
 * only other mutation, and it only ever touches
 * `status`/`assigned_provider_id`/`appointment_id` -- never the encrypted
 * PHI columns.
 */
@Injectable()
export class VisitIntakesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(
    schemaName: string,
    input: CreateVisitIntakeInput,
  ): Promise<VisitIntakeRecord> {
    const schema = quoteSchemaIdentifier(schemaName);
    const key = getPgcryptoConfig().columnEncryptionKey;
    const id = randomUUID();

    const result: QueryResult<VisitIntakeRow> = await this.pool.query(
      `INSERT INTO ${schema}.visit_intakes
         (id, patient_id, reason_for_visit, symptoms, whats_new_since_last_visit, status)
       VALUES ($2, $3, pgp_sym_encrypt($4, $1), pgp_sym_encrypt($5, $1), pgp_sym_encrypt($6, $1), $7)
       RETURNING ${DECRYPTED_PROJECTION}`,
      [
        key,
        id,
        input.patientId,
        input.reasonForVisit,
        input.symptoms,
        input.whatsNewSinceLastVisit,
        VisitIntakeStatusEnum.PENDING,
      ],
    );
    return this.toEntity(result.rows[0]);
  }

  async findById(
    schemaName: string,
    id: string,
  ): Promise<VisitIntakeRecord | null> {
    const schema = quoteSchemaIdentifier(schemaName);
    const key = getPgcryptoConfig().columnEncryptionKey;

    const result: QueryResult<VisitIntakeRow> = await this.pool.query(
      `SELECT ${DECRYPTED_PROJECTION}
       FROM ${schema}.visit_intakes
       WHERE id = $2
       LIMIT 1`,
      [key, id],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  /** AC2: the staff-facing triage queue (`status = 'pending'`) or any other single lifecycle state; tenant-wide (no patient/provider filter). */
  async list(
    schemaName: string,
    status?: VisitIntakeStatus,
  ): Promise<VisitIntakeRecord[]> {
    const schema = quoteSchemaIdentifier(schemaName);
    const key = getPgcryptoConfig().columnEncryptionKey;
    const whereClause = status ? 'WHERE status = $2' : '';
    const values = status ? [key, status] : [key];

    const result: QueryResult<VisitIntakeRow> = await this.pool.query(
      `SELECT ${DECRYPTED_PROJECTION}
       FROM ${schema}.visit_intakes
       ${whereClause}
       ORDER BY created_at DESC, id DESC`,
      values,
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  /** AC3: associates a specific provider + BAC-16/21 appointment with a pending intake, transitioning it to `linked`. */
  async link(
    schemaName: string,
    id: string,
    input: LinkVisitIntakeInput,
  ): Promise<VisitIntakeRecord | null> {
    const schema = quoteSchemaIdentifier(schemaName);
    const key = getPgcryptoConfig().columnEncryptionKey;

    const result: QueryResult<VisitIntakeRow> = await this.pool.query(
      `UPDATE ${schema}.visit_intakes
       SET assigned_provider_id = $3,
           appointment_id = $4,
           status = $5,
           updated_at = now()
       WHERE id = $2
       RETURNING ${DECRYPTED_PROJECTION}`,
      [
        key,
        id,
        input.assignedProviderId,
        input.appointmentId,
        VisitIntakeStatusEnum.LINKED,
      ],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  private toEntity(row: VisitIntakeRow): VisitIntakeRecord {
    return {
      id: row.id,
      patientId: row.patient_id,
      reasonForVisit: row.reason_for_visit,
      symptoms: row.symptoms,
      whatsNewSinceLastVisit: row.whats_new_since_last_visit,
      status: row.status as VisitIntakeStatusEnum,
      assignedProviderId: row.assigned_provider_id,
      appointmentId: row.appointment_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
