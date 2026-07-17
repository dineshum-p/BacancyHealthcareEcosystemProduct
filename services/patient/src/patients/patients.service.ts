import { Inject, Injectable } from '@nestjs/common';
import type {
  PaginatedPatientsResponse,
  PatientSummary,
} from '@hep/shared-types';
import { PatientsRepository } from './patients.repository';
import { PatientSchemaProvisioner } from './patient-schema.provisioner';
import { PatientRecord } from './patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientSearchQueryDto } from './dto/patient-search-query.dto';
import { DOMAIN_EVENT_PUBLISHER } from '../events/events.constants';
import type { DomainEventPublisher } from '../events/domain-event-publisher.interface';

/**
 * Core patient registration/search logic (BAC-14), deliberately
 * schema-explicit (see `PatientsRepository`'s doc comment) rather than
 * request-scoped, so it is testable independently of any HTTP request and
 * reusable by a future non-HTTP caller (e.g. BAC-15's SOAP encounter notes,
 * which `dependsOn` this ticket per `docs/HEP_ARCHITECTURE.md`) -- same
 * convention `services/emr`'s `PatientsService` established.
 */
@Injectable()
export class PatientsService {
  constructor(
    private readonly patientsRepository: PatientsRepository,
    private readonly schemaProvisioner: PatientSchemaProvisioner,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  /**
   * AC1/AC2: registers a patient, assigning a tenant-unique, sequential MRN
   * (`PatientsRepository.nextMrn`). AC4: always publishes a `patient.created`
   * domain event after a successful creation, through `DomainEventPublisher`
   * -- see that interface's doc comment for why this call is unconditional
   * regardless of which concrete transport is bound.
   */
  async create(
    tenantId: string,
    schemaName: string,
    dto: CreatePatientDto,
  ): Promise<PatientSummary> {
    await this.schemaProvisioner.ensurePatientsTable(schemaName);

    const record = await this.patientsRepository.insert(schemaName, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      phone: dto.phone,
      email: dto.email,
    });
    const summary = this.toSummary(tenantId, record);

    await this.eventPublisher.publishPatientCreated({
      // Reuse the patient id as the idempotency key (NOT a freshly
      // generated UUID) -- see `PatientCreatedEvent.eventId`'s doc comment.
      eventId: record.id,
      patientId: record.id,
      tenantId,
      createdAt: summary.createdAt,
    });

    return summary;
  }

  /** AC3: tenant-scoped, paginated search by name/MRN/date of birth. */
  async search(
    tenantId: string,
    schemaName: string,
    query: PatientSearchQueryDto,
  ): Promise<PaginatedPatientsResponse> {
    await this.schemaProvisioner.ensurePatientsTable(schemaName);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.patientsRepository.search(
      schemaName,
      {
        name: query.name,
        mrn: query.mrn,
        dateOfBirth: query.dateOfBirth,
      },
      { page, limit },
    );

    return {
      items: items.map((record) => this.toSummary(tenantId, record)),
      page,
      limit,
      total,
    };
  }

  private toSummary(tenantId: string, record: PatientRecord): PatientSummary {
    return {
      id: record.id,
      tenantId,
      mrn: record.mrn,
      firstName: record.firstName,
      lastName: record.lastName,
      dateOfBirth: toIsoDate(record.dateOfBirth),
      gender: (record.gender as PatientSummary['gender']) ?? null,
      phone: record.phone,
      email: record.email,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

/**
 * Renders a `date_of_birth` column value as a bare `YYYY-MM-DD` string,
 * regardless of the driver's `Date`/string representation.
 *
 * `pg`'s runtime type parser for a `date` column (`postgres-date`'s
 * `getDate`, registered for OID 1082) builds the `Date` with the
 * *local-timezone* constructor -- `new Date(year, month, day)` -- to
 * represent local midnight on that calendar date, NOT UTC midnight. Reading
 * it back with `.toISOString()` (UTC-based) therefore shifts the result to
 * the previous calendar day in any timezone ahead of UTC, and to the next
 * day in any timezone behind it -- an off-by-one bug. Reading the same
 * *local* components back out (`getFullYear`/`getMonth`/`getDate`) undoes
 * exactly what the parser did, so the calendar date round-trips correctly
 * regardless of the host's timezone.
 */
function toIsoDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
