import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import type { FhirPatientResource } from '@hep/shared-types';
import { PG_POOL } from '../database/database.tokens';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { PatientRecord } from './patient.entity';

interface PatientRow {
  id: string;
  resource: FhirPatientResource | string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Data access for a tenant's `<schema>.patients` table (BAC-10). Stores the
 * FHIR resource as a single JSONB document (deliberately not normalized
 * into per-field columns): this gateway's job is to validate and persist a
 * conformant FHIR R4 `Patient` resource, not to re-model FHIR's own
 * datatypes as relational columns -- the same "store the whole resource"
 * approach `services/notification`'s `NotificationsRepository` takes for
 * its own JSONB `data` column.
 *
 * Takes an explicit `schemaName` on every method (never a request-scoped
 * provider), same convention as every other schema-scoped repository in
 * this repo.
 */
@Injectable()
export class PatientsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(
    schemaName: string,
    id: string,
    resource: FhirPatientResource,
  ): Promise<PatientRecord> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result: QueryResult<PatientRow> = await this.pool.query(
      `INSERT INTO ${schema}.patients (id, resource)
       VALUES ($1, $2)
       RETURNING id, resource, created_at, updated_at`,
      [id, JSON.stringify(resource)],
    );
    return this.toEntity(result.rows[0]);
  }

  async findById(
    schemaName: string,
    id: string,
  ): Promise<PatientRecord | null> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result: QueryResult<PatientRow> = await this.pool.query(
      `SELECT id, resource, created_at, updated_at FROM ${schema}.patients WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  private toEntity(row: PatientRow): PatientRecord {
    return {
      id: row.id,
      resource:
        typeof row.resource === 'string'
          ? (JSON.parse(row.resource) as FhirPatientResource)
          : row.resource,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
