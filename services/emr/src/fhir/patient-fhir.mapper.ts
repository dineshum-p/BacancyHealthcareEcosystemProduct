import type { FhirPatientResource } from '@hep/shared-types';
import { CreatePatientDto } from './dto/create-patient.dto';

/**
 * Builds the canonical FHIR R4 `Patient` resource this gateway stores/serves
 * from a validated `CreatePatientDto` plus the server-assigned `id` (BAC-10,
 * AC1/AC2): the `id` a FHIR client receives is always the one this service
 * assigns at creation time, never a client-supplied value (see
 * `CreatePatientDto`'s doc comment).
 */
export function toFhirPatientResource(
  dto: CreatePatientDto,
  id: string,
): FhirPatientResource {
  return {
    resourceType: 'Patient',
    id,
    active: dto.active,
    identifier: dto.identifier,
    name: dto.name,
    telecom: dto.telecom,
    gender: dto.gender,
    birthDate: dto.birthDate,
    address: dto.address,
  };
}
