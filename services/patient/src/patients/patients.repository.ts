import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { PatientRecord } from './patient.entity';

interface PatientRow {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: Date;
  gender: string | null;
  phone: string | null;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

const MRN_PREFIX = 'MRN-';
const MRN_DIGITS = 6;

export interface CreatePatientInput {
  firstName: string;
  lastName: string;
  /** ISO-8601 date/date-time string; only the date component is persisted. */
  dateOfBirth: string;
  gender?: string;
  phone?: string;
  email?: string;
}

export interface PatientSearchFilter {
  name?: string;
  mrn?: string;
  /** Exact match, `YYYY-MM-DD`. */
  dateOfBirth?: string;
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface PatientPage {
  items: PatientRecord[];
  total: number;
}

/** Why a candidate self-registration was flagged as a probable duplicate (BAC-36). */
export type DuplicateMatchReason = 'name_dob' | 'phone' | 'email';

export interface DuplicateCandidate {
  patient: PatientRecord;
  matchReason: DuplicateMatchReason;
}

export interface DuplicateDetectionInput {
  firstName: string;
  lastName: string;
  /** `YYYY-MM-DD`. */
  dateOfBirth: string;
  phone?: string;
  email?: string;
}

/**
 * Data access for a tenant's `<schema>.patients` table (BAC-14). Every query
 * is fully-qualified with the caller's tenant schema (never relies on
 * `search_path` alone), same convention as every other schema-scoped
 * repository in this repo.
 */
@Injectable()
export class PatientsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Allocates the next tenant-unique, sequential MRN (AC1/AC2) by an atomic
   * `UPDATE ... RETURNING` against the tenant schema's single seeded
   * `patient_mrn_counters` row -- see `PatientSchemaProvisioner`'s doc
   * comment for why this is a counter table rather than a Postgres
   * `SEQUENCE`. A real Postgres row-level lock on this single-row UPDATE
   * serializes concurrent callers within the SAME tenant schema, so two
   * concurrent registrations in the same tenant can never be assigned the
   * same MRN; a different tenant's counter lives in ITS OWN schema, so MRN
   * numbering is entirely independent across tenants (AC2).
   */
  async nextMrn(schemaName: string): Promise<string> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result: QueryResult<{ assigned: string }> = await this.pool.query(
      `UPDATE ${schema}.patient_mrn_counters
       SET next_value = next_value + 1
       WHERE id = 1
       RETURNING (next_value - 1)::text AS assigned`,
    );
    const assigned = result.rows[0]?.assigned;
    if (assigned === undefined) {
      // Unreachable once `PatientSchemaProvisioner.ensurePatientsTable` has
      // seeded the counter row -- guarded defensively rather than allowing a
      // silent `undefined` to propagate into an MRN.
      throw new Error(
        `Failed to allocate an MRN for schema "${schemaName}": no counter row found.`,
      );
    }
    return `${MRN_PREFIX}${assigned.padStart(MRN_DIGITS, '0')}`;
  }

  async insert(
    schemaName: string,
    input: CreatePatientInput,
  ): Promise<PatientRecord> {
    const schema = quoteSchemaIdentifier(schemaName);
    const mrn = await this.nextMrn(schemaName);
    const id = randomUUID();

    const result: QueryResult<PatientRow> = await this.pool.query(
      `INSERT INTO ${schema}.patients
         (id, mrn, first_name, last_name, date_of_birth, gender, phone, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, mrn, first_name, last_name, date_of_birth, gender, phone, email, created_at, updated_at`,
      [
        id,
        mrn,
        input.firstName,
        input.lastName,
        input.dateOfBirth,
        input.gender ?? null,
        input.phone ?? null,
        input.email ?? null,
      ],
    );
    return this.toEntity(result.rows[0]);
  }

  async search(
    schemaName: string,
    filter: PatientSearchFilter,
    pagination: Pagination,
  ): Promise<PatientPage> {
    const schema = quoteSchemaIdentifier(schemaName);

    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter.name) {
      values.push(`%${filter.name}%`);
      conditions.push(
        `(first_name ILIKE $${values.length} OR last_name ILIKE $${values.length})`,
      );
    }
    if (filter.mrn) {
      values.push(`%${filter.mrn}%`);
      conditions.push(`mrn ILIKE $${values.length}`);
    }
    if (filter.dateOfBirth) {
      values.push(filter.dateOfBirth);
      conditions.push(`date_of_birth = $${values.length}`);
    }
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const countResult: QueryResult<{ count: string }> = await this.pool.query(
      `SELECT COUNT(*) AS count FROM ${schema}.patients ${whereClause}`,
      values,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const limitValues = [
      ...values,
      pagination.limit,
      (pagination.page - 1) * pagination.limit,
    ];
    const limitIndex = limitValues.length - 1;
    const offsetIndex = limitValues.length;

    const result: QueryResult<PatientRow> = await this.pool.query(
      `SELECT id, mrn, first_name, last_name, date_of_birth, gender, phone, email, created_at, updated_at
       FROM ${schema}.patients
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      limitValues,
    );

    return { items: result.rows.map((row) => this.toEntity(row)), total };
  }

  /** Looks up a single patient by id, tenant-scoped via `schemaName`. Returns `null` if not found. */
  async findById(
    schemaName: string,
    id: string,
  ): Promise<PatientRecord | null> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result: QueryResult<PatientRow> = await this.pool.query(
      `SELECT id, mrn, first_name, last_name, date_of_birth, gender, phone, email, created_at, updated_at
       FROM ${schema}.patients
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  /**
   * Duplicate detection for BAC-36's public self-registration flow: looks
   * for an existing patient in this tenant schema who is PROBABLY the same
   * person as the submitted demographics, so staff can review the match
   * instead of a new (possibly duplicate) record being auto-created.
   *
   * Tries two independent signals, in order of confidence, and returns the
   * first hit (a name a self-registrant typed themselves is less reliable
   * than a match already recorded on an existing patient's DOB, in turn
   * still worth flagging even if a phone/email also happens to match a
   * different person -- e.g. a shared family land line -- which is why
   * `'name_dob'` is checked first):
   *
   * 1. `'name_dob'` -- case-insensitive exact first/last name AND exact date
   *    of birth. The strongest signal: this combination is very unlikely to
   *    collide by chance.
   * 2. `'phone'`/`'email'` -- an exact match on either contact detail alone
   *    (only when the submitted registration supplied one), in case the
   *    self-registrant's name was mistyped/nicknamed/misspelled relative to
   *    their existing record.
   *
   * Deliberately two simple, sequential `SELECT ... LIMIT 1` queries (not one
   * query with a `CASE`-ranked `ORDER BY`): easier to reason about, and this
   * repo's Postgres test double (`pg-mem`) is less reliable against more
   * exotic single-query rankings than against a sequence of plain
   * equality-filtered selects.
   */
  async findPotentialDuplicate(
    schemaName: string,
    input: DuplicateDetectionInput,
  ): Promise<DuplicateCandidate | null> {
    const schema = quoteSchemaIdentifier(schemaName);

    const nameDobResult: QueryResult<PatientRow> = await this.pool.query(
      `SELECT id, mrn, first_name, last_name, date_of_birth, gender, phone, email, created_at, updated_at
       FROM ${schema}.patients
       WHERE lower(first_name) = lower($1)
         AND lower(last_name) = lower($2)
         AND date_of_birth = $3
       LIMIT 1`,
      [input.firstName, input.lastName, input.dateOfBirth],
    );
    if (nameDobResult.rows[0]) {
      return {
        patient: this.toEntity(nameDobResult.rows[0]),
        matchReason: 'name_dob',
      };
    }

    if (input.phone) {
      const phoneResult: QueryResult<PatientRow> = await this.pool.query(
        `SELECT id, mrn, first_name, last_name, date_of_birth, gender, phone, email, created_at, updated_at
         FROM ${schema}.patients
         WHERE phone = $1
         LIMIT 1`,
        [input.phone],
      );
      if (phoneResult.rows[0]) {
        return {
          patient: this.toEntity(phoneResult.rows[0]),
          matchReason: 'phone',
        };
      }
    }

    if (input.email) {
      const emailResult: QueryResult<PatientRow> = await this.pool.query(
        `SELECT id, mrn, first_name, last_name, date_of_birth, gender, phone, email, created_at, updated_at
         FROM ${schema}.patients
         WHERE lower(email) = lower($1)
         LIMIT 1`,
        [input.email],
      );
      if (emailResult.rows[0]) {
        return {
          patient: this.toEntity(emailResult.rows[0]),
          matchReason: 'email',
        };
      }
    }

    return null;
  }

  private toEntity(row: PatientRow): PatientRecord {
    return {
      id: row.id,
      mrn: row.mrn,
      firstName: row.first_name,
      lastName: row.last_name,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      phone: row.phone,
      email: row.email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
