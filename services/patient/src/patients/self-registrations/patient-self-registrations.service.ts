import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  PatientSelfRegistrationStatus,
  PatientSelfRegistrationSummary,
  SelfRegistrationReceipt,
} from '@hep/shared-types';
import { PatientsRepository } from '../patients.repository';
import { PatientSchemaProvisioner } from '../patient-schema.provisioner';
import { toIsoDate } from '../date.util';
import { PatientSelfRegistrationsRepository } from './patient-self-registrations.repository';
import { PatientSelfRegistrationRecord } from './patient-self-registration.entity';
import { SelfRegisterPatientDto } from './dto/self-register-patient.dto';
import { SelfRegistrationNotPendingError } from './errors/self-registration-not-pending.error';
import { DOMAIN_EVENT_PUBLISHER } from '../../events/events.constants';
import type { DomainEventPublisher } from '../../events/domain-event-publisher.interface';

/**
 * Core logic for BAC-36's patient self-registration lifecycle: a patient
 * submits their own registration online (no in-person identity check), it
 * is duplicate-checked against this tenant's existing patients and stored as
 * `pending`, and later reviewed by staff (approve/reject/merge). Deliberately
 * schema-explicit, not request-scoped -- same convention as `PatientsService`
 * (see that class's doc comment).
 */
@Injectable()
export class PatientSelfRegistrationsService {
  constructor(
    private readonly selfRegistrationsRepository: PatientSelfRegistrationsRepository,
    private readonly patientsRepository: PatientsRepository,
    private readonly schemaProvisioner: PatientSchemaProvisioner,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  /**
   * Handles a public, unauthenticated submission (`POST
   * /public/tenants/:tenantSlug/patients`): runs duplicate detection against
   * this tenant's existing `patients` table and stores the submission as a
   * `pending` self-registration -- it NEVER auto-creates a `patients` row,
   * matched or not, so a patient who already has an MRN can never end up
   * with a second, disconnected record purely from a self-registration
   * submission (that decision is always staff's, via `approve`/`merge`).
   */
  async register(
    tenantId: string,
    schemaName: string,
    dto: SelfRegisterPatientDto,
  ): Promise<SelfRegistrationReceipt> {
    await this.schemaProvisioner.ensurePatientsTable(schemaName);
    await this.schemaProvisioner.ensureSelfRegistrationsTable(schemaName);

    const duplicate = await this.patientsRepository.findPotentialDuplicate(
      schemaName,
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth,
        phone: dto.phone,
        email: dto.email,
      },
    );

    const record = await this.selfRegistrationsRepository.insert(schemaName, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      phone: dto.phone,
      email: dto.email,
      matchedPatientId: duplicate?.patient.id ?? null,
      matchReason: duplicate?.matchReason ?? null,
    });

    return {
      id: record.id,
      tenantId,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
    };
  }

  /** Staff-facing pending-review queue (default) or any other single lifecycle state. */
  async list(
    tenantId: string,
    schemaName: string,
    status?: PatientSelfRegistrationStatus,
  ): Promise<PatientSelfRegistrationSummary[]> {
    await this.schemaProvisioner.ensureSelfRegistrationsTable(schemaName);
    const records = await this.selfRegistrationsRepository.list(
      schemaName,
      status,
    );
    return records.map((record) => this.toSummary(tenantId, record));
  }

  /**
   * Confirms a self-registration is a genuinely new patient: creates the
   * real `patients` row (assigning an MRN, exactly like BAC-14's staff-driven
   * `POST /patients`) and flips this self-registration to `approved` --
   * this is the ONLY way a self-registration ever becomes searchable via
   * `GET /patients`. Publishes `patient.created` afterwards, reusing
   * `PatientsService.create`'s exact event contract/idempotency-key
   * convention.
   */
  async approve(
    tenantId: string,
    schemaName: string,
    id: string,
    actorUserId: string | null,
  ): Promise<PatientSelfRegistrationSummary> {
    const pending = await this.requirePending(schemaName, id);

    const patientRecord = await this.patientsRepository.insert(schemaName, {
      firstName: pending.firstName,
      lastName: pending.lastName,
      dateOfBirth: toIsoDate(pending.dateOfBirth),
      gender: pending.gender ?? undefined,
      phone: pending.phone ?? undefined,
      email: pending.email ?? undefined,
    });

    const reviewed = await this.selfRegistrationsRepository.review(
      schemaName,
      id,
      {
        status: 'approved',
        resultingPatientId: patientRecord.id,
        reviewedBy: actorUserId,
      },
    );

    await this.eventPublisher.publishPatientCreated({
      eventId: patientRecord.id,
      patientId: patientRecord.id,
      tenantId,
      createdAt: patientRecord.createdAt.toISOString(),
    });

    return this.toSummary(tenantId, reviewed);
  }

  /** Staff determine this submission is not legitimate; it never becomes a `patients` row. */
  async reject(
    tenantId: string,
    schemaName: string,
    id: string,
    reason: string | undefined,
    actorUserId: string | null,
  ): Promise<PatientSelfRegistrationSummary> {
    await this.requirePending(schemaName, id);

    const reviewed = await this.selfRegistrationsRepository.review(
      schemaName,
      id,
      {
        status: 'rejected',
        reviewNote: reason ?? null,
        reviewedBy: actorUserId,
      },
    );

    return this.toSummary(tenantId, reviewed);
  }

  /**
   * Staff confirm this submission IS the same person as an existing patient
   * (`targetPatientId`, e.g. duplicate detection's proposed candidate, or a
   * different one staff picked instead): links the self-registration to that
   * existing patient rather than creating a new, disconnected record. Does
   * NOT touch the existing patient's own demographic fields.
   */
  async merge(
    tenantId: string,
    schemaName: string,
    id: string,
    targetPatientId: string,
    actorUserId: string | null,
  ): Promise<PatientSelfRegistrationSummary> {
    await this.requirePending(schemaName, id);
    await this.schemaProvisioner.ensurePatientsTable(schemaName);

    const targetPatient = await this.patientsRepository.findById(
      schemaName,
      targetPatientId,
    );
    if (!targetPatient) {
      throw new NotFoundException(
        `Patient "${targetPatientId}" was not found in this tenant.`,
      );
    }

    const reviewed = await this.selfRegistrationsRepository.review(
      schemaName,
      id,
      {
        status: 'merged',
        resultingPatientId: targetPatient.id,
        reviewedBy: actorUserId,
      },
    );

    return this.toSummary(tenantId, reviewed);
  }

  private async requirePending(
    schemaName: string,
    id: string,
  ): Promise<PatientSelfRegistrationRecord> {
    await this.schemaProvisioner.ensureSelfRegistrationsTable(schemaName);
    const record = await this.selfRegistrationsRepository.findById(
      schemaName,
      id,
    );
    if (!record) {
      throw new NotFoundException(`Self-registration "${id}" was not found.`);
    }
    if (record.status !== 'pending') {
      // Translated into a 409 Conflict at this boundary -- mirrors
      // `services/tenant`'s `TenantsService`/`services/auth`'s
      // `AuthService` translating a domain error into `ConflictException`
      // right where it is detected, same convention this repo uses
      // throughout (see `SlugAlreadyExistsError`'s doc comment).
      throw new ConflictException(
        new SelfRegistrationNotPendingError(id, record.status).message,
      );
    }
    return record;
  }

  private toSummary(
    tenantId: string,
    record: PatientSelfRegistrationRecord,
  ): PatientSelfRegistrationSummary {
    return {
      id: record.id,
      tenantId,
      firstName: record.firstName,
      lastName: record.lastName,
      dateOfBirth: toIsoDate(record.dateOfBirth),
      gender:
        (record.gender as PatientSelfRegistrationSummary['gender']) ?? null,
      phone: record.phone,
      email: record.email,
      status: record.status,
      matchedPatientId: record.matchedPatientId,
      matchReason: record.matchReason,
      resultingPatientId: record.resultingPatientId,
      reviewedBy: record.reviewedBy,
      reviewedAt: record.reviewedAt ? record.reviewedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
