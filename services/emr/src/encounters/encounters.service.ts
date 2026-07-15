import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { EncounterSummary, VitalSigns } from '@hep/shared-types';
import { EncountersRepository } from './encounters.repository';
import { EmrSchemaProvisioner } from '../fhir/emr-schema.provisioner';
import { PatientsRepository } from '../fhir/patients.repository';
import { EncounterRecord } from './encounter.entity';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { DOMAIN_EVENT_PUBLISHER } from '../events/events.constants';
import type { DomainEventPublisher } from '../events/domain-event-publisher.interface';

/**
 * Core SOAP-encounter-note logic (BAC-15), deliberately schema-explicit (see
 * `EncountersRepository`'s doc comment) rather than request-scoped, so it is
 * testable independently of any HTTP request -- same convention
 * `services/patient`'s `PatientsService` (BAC-14) and this service's own
 * `PatientsService` (BAC-10) already established.
 */
@Injectable()
export class EncountersService {
  constructor(
    private readonly encountersRepository: EncountersRepository,
    private readonly schemaProvisioner: EmrSchemaProvisioner,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
    private readonly patientsRepository: PatientsRepository,
  ) {}

  /**
   * AC1: saves a structured SOAP note plus vitals and an allergy list
   * against `patientId`. Before persisting, verifies `patientId` resolves to
   * a row in THIS SAME tenant schema's `patients` table (BAC-10's
   * `PatientsRepository.findById`, reused here rather than reinventing a
   * lookup -- see `EncountersController`'s doc comment for the scope of
   * what this check does and does NOT cover) and 404s
   * (`NotFoundException`) if it doesn't, matching the same not-found
   * convention `services/emr`'s own FHIR `PatientsService.findByIdForSchema`
   * already uses for an unresolvable id. AC4: always publishes an
   * `encounter.created` domain event after a successful creation, through
   * `DomainEventPublisher`, with the encounter's own id reused as the
   * event's `eventId` (idempotency key).
   */
  async create(
    tenantId: string,
    schemaName: string,
    patientId: string,
    dto: CreateEncounterDto,
  ): Promise<EncounterSummary> {
    await this.schemaProvisioner.ensurePatientsTable(schemaName);
    const patient = await this.patientsRepository.findById(
      schemaName,
      patientId,
    );
    if (!patient) {
      throw new NotFoundException(`Patient "${patientId}" was not found.`);
    }

    await this.schemaProvisioner.ensureEncountersTable(schemaName);

    const record = await this.encountersRepository.insert(
      schemaName,
      patientId,
      {
        subjective: dto.soapNote.subjective,
        objective: dto.soapNote.objective,
        assessment: dto.soapNote.assessment,
        plan: dto.soapNote.plan,
        heartRate: dto.vitals?.heartRate,
        bloodPressureSystolic: dto.vitals?.bloodPressureSystolic,
        bloodPressureDiastolic: dto.vitals?.bloodPressureDiastolic,
        temperature: dto.vitals?.temperature,
        respiratoryRate: dto.vitals?.respiratoryRate,
        spO2: dto.vitals?.spO2,
        allergies: dto.allergies ?? [],
      },
    );
    const summary = this.toSummary(tenantId, record);

    await this.eventPublisher.publishEncounterCreated({
      eventId: record.id,
      encounterId: record.id,
      patientId,
      tenantId,
      createdAt: summary.createdAt,
    });

    return summary;
  }

  /** AC2: the patient's encounter history, most recent first. */
  async findByPatient(
    tenantId: string,
    schemaName: string,
    patientId: string,
  ): Promise<EncounterSummary[]> {
    await this.schemaProvisioner.ensureEncountersTable(schemaName);

    const records = await this.encountersRepository.findByPatientId(
      schemaName,
      patientId,
    );
    return records.map((record) => this.toSummary(tenantId, record));
  }

  private toSummary(
    tenantId: string,
    record: EncounterRecord,
  ): EncounterSummary {
    return {
      id: record.id,
      tenantId,
      patientId: record.patientId,
      soapNote: {
        subjective: record.subjective,
        objective: record.objective,
        assessment: record.assessment,
        plan: record.plan,
      },
      vitals: this.toVitals(record),
      allergies: record.allergies,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /** `null` when none of the optional vitals fields were captured for this encounter. */
  private toVitals(record: EncounterRecord): VitalSigns | null {
    const vitals: VitalSigns = {};
    if (record.heartRate !== null) {
      vitals.heartRate = record.heartRate;
    }
    if (record.bloodPressureSystolic !== null) {
      vitals.bloodPressureSystolic = record.bloodPressureSystolic;
    }
    if (record.bloodPressureDiastolic !== null) {
      vitals.bloodPressureDiastolic = record.bloodPressureDiastolic;
    }
    if (record.temperature !== null) {
      vitals.temperature = record.temperature;
    }
    if (record.respiratoryRate !== null) {
      vitals.respiratoryRate = record.respiratoryRate;
    }
    if (record.spO2 !== null) {
      vitals.spO2 = record.spO2;
    }
    return Object.keys(vitals).length > 0 ? vitals : null;
  }
}
