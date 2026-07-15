import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import type { Allergy } from '@hep/shared-types';
import { PG_POOL } from '../database/database.tokens';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { EncounterRecord } from './encounter.entity';

interface EncounterRow {
  id: string;
  patient_id: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  heart_rate: string | null;
  blood_pressure_systolic: string | null;
  blood_pressure_diastolic: string | null;
  temperature: string | null;
  respiratory_rate: string | null;
  spo2: string | null;
  allergies: Allergy[] | string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEncounterInput {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  temperature?: number;
  respiratoryRate?: number;
  spO2?: number;
  allergies: Allergy[];
}

/**
 * Data access for a tenant's `<schema>.encounters` table (BAC-15). Every
 * query is fully-qualified with the caller's tenant schema (never relies on
 * `search_path` alone), same convention as every other schema-scoped
 * repository in this repo (e.g. `services/patient`'s `PatientsRepository`).
 */
@Injectable()
export class EncountersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(
    schemaName: string,
    patientId: string,
    input: CreateEncounterInput,
  ): Promise<EncounterRecord> {
    const schema = quoteSchemaIdentifier(schemaName);
    const id = randomUUID();

    const result: QueryResult<EncounterRow> = await this.pool.query(
      `INSERT INTO ${schema}.encounters
         (id, patient_id, subjective, objective, assessment, plan,
          heart_rate, blood_pressure_systolic, blood_pressure_diastolic,
          temperature, respiratory_rate, spo2, allergies)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, patient_id, subjective, objective, assessment, plan,
         heart_rate, blood_pressure_systolic, blood_pressure_diastolic,
         temperature, respiratory_rate, spo2, allergies, created_at, updated_at`,
      [
        id,
        patientId,
        input.subjective,
        input.objective,
        input.assessment,
        input.plan,
        input.heartRate ?? null,
        input.bloodPressureSystolic ?? null,
        input.bloodPressureDiastolic ?? null,
        input.temperature ?? null,
        input.respiratoryRate ?? null,
        input.spO2 ?? null,
        JSON.stringify(input.allergies),
      ],
    );
    return this.toEntity(result.rows[0]);
  }

  /** AC2: a patient's encounter history, most recent first. */
  async findByPatientId(
    schemaName: string,
    patientId: string,
  ): Promise<EncounterRecord[]> {
    const schema = quoteSchemaIdentifier(schemaName);

    const result: QueryResult<EncounterRow> = await this.pool.query(
      `SELECT id, patient_id, subjective, objective, assessment, plan,
         heart_rate, blood_pressure_systolic, blood_pressure_diastolic,
         temperature, respiratory_rate, spo2, allergies, created_at, updated_at
       FROM ${schema}.encounters
       WHERE patient_id = $1
       ORDER BY created_at DESC, id DESC`,
      [patientId],
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  private toEntity(row: EncounterRow): EncounterRecord {
    return {
      id: row.id,
      patientId: row.patient_id,
      subjective: row.subjective,
      objective: row.objective,
      assessment: row.assessment,
      plan: row.plan,
      heartRate: toNullableNumber(row.heart_rate),
      bloodPressureSystolic: toNullableNumber(row.blood_pressure_systolic),
      bloodPressureDiastolic: toNullableNumber(row.blood_pressure_diastolic),
      temperature: toNullableNumber(row.temperature),
      respiratoryRate: toNullableNumber(row.respiratory_rate),
      spO2: toNullableNumber(row.spo2),
      allergies:
        typeof row.allergies === 'string'
          ? (JSON.parse(row.allergies) as Allergy[])
          : row.allergies,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/** `NUMERIC` columns round-trip through `pg`/`pg-mem` as strings; normalizes to a real `number` (or `null`). */
function toNullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}
