import { Injectable } from '@nestjs/common';
import type {
  AccessTokenPayload,
  PatientProfileDemographics,
  PatientProfileResponse,
} from '@hep/shared-types';
import { PatientProfileRepository } from './patient-profile.repository';
import { PatientProfileRecord } from './patient-profile.entity';
import { EmrSchemaProvisioner } from '../fhir/emr-schema.provisioner';
import { PatientsRepository } from '../fhir/patients.repository';
import { assertPatientScope } from '../auth/patient-scope.util';
import { toPatientProfileDemographics } from './demographics.util';
import { UpsertPatientProfileDto } from './dto/upsert-patient-profile.dto';

/**
 * Core patient baseline-profile logic (BAC-44), deliberately schema-explicit
 * (see `PatientProfileRepository`'s doc comment) rather than request-scoped,
 * mirroring `EncountersService`/`PatientsService`'s exact convention.
 *
 * Row-level ownership (BAC-41's `assertPatientScope`) is enforced HERE, not
 * in the controller: a `patient` caller reaches this far only because
 * `PermissionsGuard` already confirmed their role holds
 * `READ_PATIENT_PROFILE`/`WRITE_PATIENT_PROFILE` (a coarse, role-level
 * grant -- see `role-permissions.map.ts`); `assertPatientScope` is the
 * finer, per-request check that a `patient` caller's OWN `userId` equals
 * the `:patientId` they are trying to reach, 403ing otherwise. Every
 * staff-side role (`super_admin`/`clinic_admin`/`provider`/`staff`) passes
 * this check unconditionally for ANY patient, per BAC-44's brief.
 */
@Injectable()
export class PatientProfileService {
  constructor(
    private readonly patientProfileRepository: PatientProfileRepository,
    private readonly schemaProvisioner: EmrSchemaProvisioner,
    private readonly patientsRepository: PatientsRepository,
  ) {}

  /**
   * Returns the patient's baseline profile, or the well-formed
   * `hasProfile: false` empty shape if none has ever been saved -- never a
   * 404 (see `PatientProfileResponse`'s doc comment in `@hep/shared-types`).
   */
  async getProfile(
    tenantId: string,
    schemaName: string,
    patientId: string,
    callingUser: AccessTokenPayload,
  ): Promise<PatientProfileResponse> {
    assertPatientScope(callingUser, patientId);

    await this.schemaProvisioner.ensurePatientProfilesTable(schemaName);
    const record = await this.patientProfileRepository.findByPatientId(
      schemaName,
      patientId,
    );

    const demographics = await this.resolveDemographics(schemaName, patientId);
    return this.toResponse(tenantId, patientId, demographics, record);
  }

  /**
   * Upserts the patient's baseline profile: creates it if none exists yet,
   * or edits the existing one in place otherwise (never versioned).
   */
  async upsertProfile(
    tenantId: string,
    schemaName: string,
    patientId: string,
    callingUser: AccessTokenPayload,
    dto: UpsertPatientProfileDto,
  ): Promise<PatientProfileResponse> {
    assertPatientScope(callingUser, patientId);

    await this.schemaProvisioner.ensurePatientProfilesTable(schemaName);
    const record = await this.patientProfileRepository.upsert(
      schemaName,
      patientId,
      {
        allergies: dto.allergies,
        chronicConditions: dto.chronicConditions,
        medications: dto.medications,
      },
    );

    const demographics = await this.resolveDemographics(schemaName, patientId);
    return this.toResponse(tenantId, patientId, demographics, record);
  }

  /**
   * Best-effort, SAME-SERVICE demographics lookup -- see
   * `demographics.util.ts`'s doc comment for the full, documented scope
   * boundary of why this is a same-schema FHIR `Patient` lookup rather than
   * a cross-service call, and what that means for accuracy.
   */
  private async resolveDemographics(
    schemaName: string,
    patientId: string,
  ): Promise<PatientProfileDemographics> {
    await this.schemaProvisioner.ensurePatientsTable(schemaName);
    const patient = await this.patientsRepository.findById(
      schemaName,
      patientId,
    );
    return toPatientProfileDemographics(patient?.resource ?? null);
  }

  private toResponse(
    tenantId: string,
    patientId: string,
    demographics: PatientProfileDemographics,
    record: PatientProfileRecord | null,
  ): PatientProfileResponse {
    if (!record) {
      return {
        id: null,
        patientId,
        tenantId,
        hasProfile: false,
        demographics,
        allergies: [],
        chronicConditions: [],
        medications: [],
        createdAt: null,
        updatedAt: null,
      };
    }

    return {
      id: record.id,
      patientId,
      tenantId,
      hasProfile: true,
      demographics,
      allergies: record.allergies,
      chronicConditions: record.chronicConditions,
      medications: record.medications,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
