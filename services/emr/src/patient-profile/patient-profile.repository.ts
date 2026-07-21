import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import type { Allergy, ChronicCondition, Medication } from '@hep/shared-types';
import { PG_POOL } from '../database/database.tokens';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { getPgcryptoConfig } from '../config/pgcrypto.config';
import { PatientProfileRecord } from './patient-profile.entity';

interface PatientProfileRow {
  id: string;
  patient_id: string;
  allergies_json: string;
  chronic_conditions_json: string;
  medications: Medication[] | string;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertPatientProfileInput {
  allergies: Allergy[];
  chronicConditions: ChronicCondition[];
  medications: Medication[];
}

/**
 * A `RETURNING`/`SELECT` projection shared by every query in this repository:
 * `pgp_sym_decrypt(allergies, $key)`/`pgp_sym_decrypt(chronic_conditions,
 * $key)` decrypt the pgcrypto-encrypted columns back into their original
 * JSON text INLINE, in the same statement that reads them -- this repository
 * never receives the raw encrypted bytes and separately decrypts them in
 * application code; decryption is a SQL-level concern, matching how
 * encryption is (see `upsert`'s doc comment). `medications` is plain JSONB
 * (not pgcrypto-encrypted -- out of this ticket's explicit encryption
 * scope), so it needs no such treatment.
 */
const DECRYPTED_PROJECTION = `
  id, patient_id,
  pgp_sym_decrypt(allergies, $1) AS allergies_json,
  pgp_sym_decrypt(chronic_conditions, $1) AS chronic_conditions_json,
  medications, created_at, updated_at
`;

/**
 * Data access for a tenant's `<schema>.patient_profiles` table (BAC-44).
 * Establishes this service's first column-level PHI encryption pattern via
 * Postgres's `pgcrypto` extension -- documented here in detail so a future
 * ticket (BAC-45) can replicate it exactly for its own PHI fields:
 *
 *   1. The encryption key (`getPgcryptoConfig().columnEncryptionKey`) is
 *      sourced from config/env -- NEVER hardcoded in SQL or application code
 *      -- and is passed as a BOUND QUERY PARAMETER (`$1`/`$key`, never
 *      string-interpolated into the SQL text), the same parameterization
 *      discipline every other query in this repo already follows.
 *   2. Writes encrypt with `pgp_sym_encrypt(plaintext_json_text, $key)`,
 *      producing a `BYTEA` value -- the column itself is typed `BYTEA`
 *      (`EmrSchemaProvisioner.ensurePatientProfilesTable`), so a raw
 *      `SELECT allergies FROM ...` without going through
 *      `pgp_sym_decrypt(...)` returns encrypted bytes, never plaintext.
 *   3. Reads decrypt with `pgp_sym_decrypt(column, $key)` INLINE in the same
 *      `SELECT`/`RETURNING` clause that reads the row (`DECRYPTED_PROJECTION`
 *      above) -- there is no separate "fetch encrypted, decrypt in Node"
 *      step; decryption is symmetric with encryption, at the SQL level.
 *   4. Encrypted columns store JSON TEXT (via `JSON.stringify`/`JSON.parse`
 *      at this repository's boundary) rather than being modeled as
 *      per-field encrypted columns -- `allergies`/`chronic_conditions` are
 *      each a variable-length list of structured entries, the same
 *      "serialize the whole structured value" convention `encounters.allergies`
 *      (BAC-15, unencrypted JSONB) and `patients.resource` (BAC-10,
 *      unencrypted JSONB) already established for this shape of data; this
 *      ticket's contribution is adding the `pgcrypto` encryption layer ON
 *      TOP of that existing serialize-the-whole-value convention, not
 *      replacing it.
 *
 * Upsert semantics (BAC-44: "creates if none exists, edits in place
 * otherwise, never versioned") are implemented as an explicit
 * UPDATE-then-INSERT-if-no-row-affected, NOT `INSERT ... ON CONFLICT ...
 * DO UPDATE`: `services/billing`'s `UsageEventsRepository` (BAC-11)
 * documents a discovered `pg-mem` (this repo's Postgres stand-in for tests)
 * quirk where `ON CONFLICT DO NOTHING` reports a misleadingly "successful"
 * `RETURNING`/`rowCount` even on a genuine no-op; this repository sidesteps
 * that whole class of engine-divergence risk (untested here for `DO UPDATE`
 * specifically) by never relying on `ON CONFLICT`'s `RETURNING` behavior at
 * all.
 */
@Injectable()
export class PatientProfileRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByPatientId(
    schemaName: string,
    patientId: string,
  ): Promise<PatientProfileRecord | null> {
    const schema = quoteSchemaIdentifier(schemaName);
    const key = getPgcryptoConfig().columnEncryptionKey;

    const result: QueryResult<PatientProfileRow> = await this.pool.query(
      `SELECT ${DECRYPTED_PROJECTION}
       FROM ${schema}.patient_profiles
       WHERE patient_id = $2
       LIMIT 1`,
      [key, patientId],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  /**
   * Upserts the patient's baseline profile: updates the existing row in
   * place if one already exists for `patientId`, otherwise inserts a new
   * one. Always returns the row's OWN, stable `id` -- an update never
   * changes it, matching "baseline, not versioned".
   */
  async upsert(
    schemaName: string,
    patientId: string,
    input: UpsertPatientProfileInput,
  ): Promise<PatientProfileRecord> {
    const schema = quoteSchemaIdentifier(schemaName);
    const key = getPgcryptoConfig().columnEncryptionKey;
    const allergiesJson = JSON.stringify(input.allergies);
    const chronicConditionsJson = JSON.stringify(input.chronicConditions);
    const medicationsJson = JSON.stringify(input.medications);

    const updateResult: QueryResult<PatientProfileRow> = await this.pool.query(
      `UPDATE ${schema}.patient_profiles
       SET allergies = pgp_sym_encrypt($3, $1),
           chronic_conditions = pgp_sym_encrypt($4, $1),
           medications = $5,
           updated_at = now()
       WHERE patient_id = $2
       RETURNING ${DECRYPTED_PROJECTION}`,
      [key, patientId, allergiesJson, chronicConditionsJson, medicationsJson],
    );
    if (updateResult.rows[0]) {
      return this.toEntity(updateResult.rows[0]);
    }

    const insertResult: QueryResult<PatientProfileRow> = await this.pool.query(
      `INSERT INTO ${schema}.patient_profiles
         (id, patient_id, allergies, chronic_conditions, medications)
       VALUES ($2, $3, pgp_sym_encrypt($4, $1), pgp_sym_encrypt($5, $1), $6)
       RETURNING ${DECRYPTED_PROJECTION}`,
      [
        key,
        randomUUID(),
        patientId,
        allergiesJson,
        chronicConditionsJson,
        medicationsJson,
      ],
    );
    return this.toEntity(insertResult.rows[0]);
  }

  private toEntity(row: PatientProfileRow): PatientProfileRecord {
    return {
      id: row.id,
      patientId: row.patient_id,
      allergies: JSON.parse(row.allergies_json) as Allergy[],
      chronicConditions: JSON.parse(
        row.chronic_conditions_json,
      ) as ChronicCondition[],
      medications:
        typeof row.medications === 'string'
          ? (JSON.parse(row.medications) as Medication[])
          : row.medications,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
