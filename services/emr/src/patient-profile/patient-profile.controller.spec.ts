import type { PatientProfileResponse } from '@hep/shared-types';
import { PatientProfileController } from './patient-profile.controller';
import { PatientProfileService } from './patient-profile.service';
import { RequestWithAuth } from '../auth/request-with-auth.interface';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { UpsertPatientProfileDto } from './dto/upsert-patient-profile.dto';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

function makeRequest(
  overrides: Partial<RequestWithAuth> = {},
): RequestWithAuth {
  return {
    tenant: {
      id: 'tenant-1',
      slug: 'acme',
      name: 'Acme Inc',
      plan: 'starter',
      status: TenantStatus.ACTIVE,
      schemaName: 'tenant_acme',
      ownerEmail: 'owner@example.com',
    },
    user: { userId: 'user-1', tenantId: 'tenant-1', role: 'provider' },
    ...overrides,
  } as unknown as RequestWithAuth;
}

function makeResponse(
  overrides: Partial<PatientProfileResponse> = {},
): PatientProfileResponse {
  return {
    id: 'profile-1',
    patientId: PATIENT_ID,
    tenantId: 'tenant-1',
    hasProfile: true,
    demographics: {
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
    },
    allergies: [],
    chronicConditions: [],
    medications: [],
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('PatientProfileController', () => {
  let patientProfileService: jest.Mocked<PatientProfileService>;
  let controller: PatientProfileController;

  beforeEach(() => {
    patientProfileService = {
      getProfile: jest.fn(),
      upsertProfile: jest.fn(),
    } as unknown as jest.Mocked<PatientProfileService>;
    controller = new PatientProfileController(patientProfileService);
  });

  describe('get', () => {
    it('delegates to patientProfileService.getProfile with the resolved tenant, schema, patientId, and caller', async () => {
      const request = makeRequest();
      const response = makeResponse();
      patientProfileService.getProfile.mockResolvedValue(response);

      const result = await controller.get(request, PATIENT_ID);

      expect(result).toBe(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(patientProfileService.getProfile).toHaveBeenCalledWith(
        'tenant-1',
        'tenant_acme',
        PATIENT_ID,
        request.user,
      );
    });

    it('throws if request.tenant was never resolved (must be protected by TenantGuard)', async () => {
      const request = makeRequest({ tenant: undefined });

      await expect(controller.get(request, PATIENT_ID)).rejects.toThrow();
    });

    it('throws if request.user was never resolved (must be protected by AccessTokenGuard)', async () => {
      const request = makeRequest({ user: undefined });

      await expect(controller.get(request, PATIENT_ID)).rejects.toThrow();
    });
  });

  describe('upsert', () => {
    it('delegates to patientProfileService.upsertProfile with the resolved tenant, schema, patientId, caller, and dto', async () => {
      const request = makeRequest();
      const dto = new UpsertPatientProfileDto();
      dto.allergies = [];
      dto.chronicConditions = [];
      dto.medications = [];
      const response = makeResponse();
      patientProfileService.upsertProfile.mockResolvedValue(response);

      const result = await controller.upsert(request, PATIENT_ID, dto);

      expect(result).toBe(response);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(patientProfileService.upsertProfile).toHaveBeenCalledWith(
        'tenant-1',
        'tenant_acme',
        PATIENT_ID,
        request.user,
        dto,
      );
    });

    it('throws if request.tenant was never resolved (must be protected by TenantGuard)', async () => {
      const request = makeRequest({ tenant: undefined });
      const dto = new UpsertPatientProfileDto();
      dto.allergies = [];
      dto.chronicConditions = [];
      dto.medications = [];

      await expect(
        controller.upsert(request, PATIENT_ID, dto),
      ).rejects.toThrow();
    });

    it('throws if request.user was never resolved (must be protected by AccessTokenGuard)', async () => {
      const request = makeRequest({ user: undefined });
      const dto = new UpsertPatientProfileDto();
      dto.allergies = [];
      dto.chronicConditions = [];
      dto.medications = [];

      await expect(
        controller.upsert(request, PATIENT_ID, dto),
      ).rejects.toThrow();
    });
  });
});
