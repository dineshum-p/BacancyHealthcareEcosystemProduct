import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { AppointmentRecord } from './appointment.entity';
import { AppointmentStatus } from './appointment-status.enum';

interface AppointmentRow {
  id: string;
  provider_id: string;
  patient_id: string;
  start_time: Date;
  end_time: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAppointmentInput {
  providerId: string;
  patientId: string;
  startTime: Date;
  endTime: Date;
}

/**
 * Data access for a tenant's `<schema>.appointments` table (BAC-16). Every
 * query is fully-qualified with the caller's tenant schema (never relies on
 * `search_path` alone), same convention as every other schema-scoped
 * repository in this repo.
 */
@Injectable()
export class AppointmentsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * AC1: true if `providerId` already has a `booked` appointment whose time
   * range overlaps `[startTime, endTime)` -- i.e. `existing.start < endTime
   * AND existing.end > startTime`. `excludeAppointmentId` lets a reschedule
   * (AC3) check for a conflict against every OTHER appointment without
   * always conflicting with itself.
   *
   * Checked by `AppointmentsService` immediately before `insert`/
   * `reschedule` -- a plain check-then-act, not a single atomic statement:
   * this ticket explicitly excludes cross-provider conflict detection/
   * resource allocation (single-provider-at-a-time scheduling only), so a
   * lightweight, readable check is an intentional, documented trade-off over
   * a fully race-proof `SERIALIZABLE` transaction or a DB-level exclusion
   * constraint. A true concurrent double-submit of the exact same slot is
   * not guaranteed to be caught; a sequential (or DB-serialized, e.g. real
   * Postgres under load) double-booking attempt always is.
   */
  async hasConflict(
    schemaName: string,
    providerId: string,
    startTime: Date,
    endTime: Date,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const schema = quoteSchemaIdentifier(schemaName);
    const values: unknown[] = [providerId, startTime, endTime];
    let excludeClause = '';
    if (excludeAppointmentId) {
      values.push(excludeAppointmentId);
      excludeClause = `AND id != $${values.length}`;
    }

    const result: QueryResult<{ exists: boolean }> = await this.pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM ${schema}.appointments
         WHERE provider_id = $1
           AND status = '${AppointmentStatus.BOOKED}'
           AND start_time < $3
           AND end_time > $2
           ${excludeClause}
       ) AS exists`,
      values,
    );
    return result.rows[0]?.exists === true;
  }

  async insert(
    schemaName: string,
    input: CreateAppointmentInput,
  ): Promise<AppointmentRecord> {
    const schema = quoteSchemaIdentifier(schemaName);
    const id = randomUUID();

    const result: QueryResult<AppointmentRow> = await this.pool.query(
      `INSERT INTO ${schema}.appointments
         (id, provider_id, patient_id, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, provider_id, patient_id, start_time, end_time, status, created_at, updated_at`,
      [
        id,
        input.providerId,
        input.patientId,
        input.startTime,
        input.endTime,
        AppointmentStatus.BOOKED,
      ],
    );
    return this.toEntity(result.rows[0]);
  }

  async findById(
    schemaName: string,
    id: string,
  ): Promise<AppointmentRecord | null> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result: QueryResult<AppointmentRow> = await this.pool.query(
      `SELECT id, provider_id, patient_id, start_time, end_time, status, created_at, updated_at
       FROM ${schema}.appointments
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  /**
   * AC2: every appointment for `providerId` overlapping `[rangeStart,
   * rangeEnd)` -- i.e. the calendar day being requested -- regardless of
   * status, ordered by start time. Includes cancelled appointments
   * deliberately: a front-desk day view needs to show a cancelled slot
   * (crossed out), not silently omit it.
   */
  async findByProviderAndRange(
    schemaName: string,
    providerId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<AppointmentRecord[]> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result: QueryResult<AppointmentRow> = await this.pool.query(
      `SELECT id, provider_id, patient_id, start_time, end_time, status, created_at, updated_at
       FROM ${schema}.appointments
       WHERE provider_id = $1
         AND start_time < $3
         AND end_time > $2
       ORDER BY start_time ASC`,
      [providerId, rangeStart, rangeEnd],
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  /** AC3 (reschedule): updates the time range of a still-`booked` appointment. */
  async updateTimes(
    schemaName: string,
    id: string,
    startTime: Date,
    endTime: Date,
  ): Promise<AppointmentRecord | null> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result: QueryResult<AppointmentRow> = await this.pool.query(
      `UPDATE ${schema}.appointments
       SET start_time = $2, end_time = $3, updated_at = now()
       WHERE id = $1 AND status = '${AppointmentStatus.BOOKED}'
       RETURNING id, provider_id, patient_id, start_time, end_time, status, created_at, updated_at`,
      [id, startTime, endTime],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  /** AC3 (cancel): transitions a still-`booked` appointment to `cancelled`. */
  async cancel(
    schemaName: string,
    id: string,
  ): Promise<AppointmentRecord | null> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result: QueryResult<AppointmentRow> = await this.pool.query(
      `UPDATE ${schema}.appointments
       SET status = '${AppointmentStatus.CANCELLED}', updated_at = now()
       WHERE id = $1 AND status = '${AppointmentStatus.BOOKED}'
       RETURNING id, provider_id, patient_id, start_time, end_time, status, created_at, updated_at`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.toEntity(row) : null;
  }

  private toEntity(row: AppointmentRow): AppointmentRecord {
    return {
      id: row.id,
      providerId: row.provider_id,
      patientId: row.patient_id,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status as AppointmentStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
