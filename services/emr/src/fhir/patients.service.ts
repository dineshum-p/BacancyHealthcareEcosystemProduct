import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { FhirPatientResource } from '@hep/shared-types';
import { PatientsRepository } from './patients.repository';
import { EmrSchemaProvisioner } from './emr-schema.provisioner';
import { CreatePatientDto } from './dto/create-patient.dto';
import { toFhirPatientResource } from './patient-fhir.mapper';

/**
 * Core FHIR `Patient` gateway logic (BAC-10), deliberately schema-explicit
 * (see `PatientsRepository`'s doc comment) rather than request-scoped, so
 * it is testable independently of any HTTP request and reusable by a future
 * non-HTTP caller (e.g. BAC-15's SOAP encounter notes, which `dependsOn`
 * this ticket per `docs/HEP_ARCHITECTURE.md`).
 */
@Injectable()
export class PatientsService {
  constructor(
    private readonly patientsRepository: PatientsRepository,
    private readonly schemaProvisioner: EmrSchemaProvisioner,
  ) {}

  /** AC2: persists a validated FHIR Patient and returns the created resource (with its server-assigned id). */
  async createForSchema(
    schemaName: string,
    dto: CreatePatientDto,
  ): Promise<FhirPatientResource> {
    await this.schemaProvisioner.ensurePatientsTable(schemaName);

    const id = randomUUID();
    const resource = toFhirPatientResource(dto, id);
    const record = await this.patientsRepository.insert(
      schemaName,
      id,
      resource,
    );
    return record.resource;
  }

  /** AC1: the current FHIR Patient resource for an id, scoped to this tenant's schema. */
  async findByIdForSchema(
    schemaName: string,
    id: string,
  ): Promise<FhirPatientResource> {
    // A tenant whose schema has never had a patient created yet has no
    // `patients` table at all (lazy provisioning); ensure it exists first so
    // a lookup against a schema with zero patients 404s (not 500s) the same
    // as a lookup for an id that simply doesn't exist.
    await this.schemaProvisioner.ensurePatientsTable(schemaName);
    const record = await this.patientsRepository.findById(schemaName, id);
    if (!record) {
      throw new NotFoundException(`Patient "${id}" was not found.`);
    }
    return record.resource;
  }
}
