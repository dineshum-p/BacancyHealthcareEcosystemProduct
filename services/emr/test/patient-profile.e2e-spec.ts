import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool, QueryResult } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AccessTokenPayload,
  PatientProfileResponse,
} from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { quoteSchemaIdentifier } from '../src/tenants/schema-identifier.util';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-patient-profile-test-secret';

/**
 * Proves BAC-44's acceptance criteria end-to-end against a real (not
 * mocked) SQL engine (`pg-mem`), the same approach every other service in
 * this repo established (see `encounters.e2e-spec.ts`).
 */
describe('Patient baseline profile (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;
    process.env.PGCRYPTO_COLUMN_KEY = 'e2e-patient-profile-column-key';

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);
    jwtService = new JwtService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function signToken(payload: AccessTokenPayload): string {
    return jwtService.sign(payload, {
      secret: JWT_ACCESS_SECRET,
      algorithm: 'HS256',
      expiresIn: 900,
    });
  }

  function tokenFor(
    tenant: { id: string },
    role: AccessTokenPayload['role'] = 'provider',
    userId = 'user-1',
  ): string {
    return signToken({ userId, tenantId: tenant.id, role });
  }

  const validPayload = {
    allergies: [
      { substance: 'Penicillin', reaction: 'Hives', severity: 'severe' },
    ],
    chronicConditions: [{ name: 'Asthma', diagnosedDate: '2015-06-01' }],
    medications: [
      { name: 'Albuterol', dosage: '90mcg', frequency: 'as needed' },
    ],
  };

  describe('GET /patients/:patientId/profile: no profile yet', () => {
    it('returns 200 with hasProfile: false, empty arrays, and null timestamps (never a 404)', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .get(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as PatientProfileResponse;
      expect(body.hasProfile).toBe(false);
      expect(body.id).toBeNull();
      expect(body.patientId).toBe(patientId);
      expect(body.allergies).toEqual([]);
      expect(body.chronicConditions).toEqual([]);
      expect(body.medications).toEqual([]);
      expect(body.createdAt).toBeNull();
      expect(body.updatedAt).toBeNull();
      expect(body.demographics).toEqual({
        firstName: null,
        lastName: null,
        dateOfBirth: null,
      });
    });
  });

  describe('PUT /patients/:patientId/profile: upsert semantics', () => {
    it('creates a new profile and returns 200 with hasProfile: true', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .put(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(200);

      const body = response.body as PatientProfileResponse;
      expect(body.hasProfile).toBe(true);
      expect(body.id).toEqual(expect.any(String));
      expect(body.patientId).toBe(patientId);
      expect(body.allergies).toEqual(validPayload.allergies);
      expect(body.chronicConditions).toEqual(validPayload.chronicConditions);
      expect(body.medications).toEqual(validPayload.medications);
    });

    it('edits the SAME profile in place on a second PUT (id stable, not versioned)', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      const first = await request(app.getHttpServer())
        .put(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(200);

      const second = await request(app.getHttpServer())
        .put(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          allergies: [],
          chronicConditions: [],
          medications: [{ name: 'Ibuprofen' }],
        })
        .expect(200);

      expect((second.body as PatientProfileResponse).id).toBe(
        (first.body as PatientProfileResponse).id,
      );
      expect((second.body as PatientProfileResponse).allergies).toEqual([]);
      expect((second.body as PatientProfileResponse).medications).toEqual([
        { name: 'Ibuprofen' },
      ]);

      // A subsequent GET reflects the SECOND put's state, proving the edit
      // was applied in place (not appended as a new record).
      const getResponse = await request(app.getHttpServer())
        .get(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((getResponse.body as PatientProfileResponse).medications).toEqual([
        { name: 'Ibuprofen' },
      ]);
    });

    it('rejects a payload missing a required field (e.g. medications) with 400', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .put(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ allergies: [], chronicConditions: [] })
        .expect(400);
    });

    it('rejects a malformed (non-UUID) patientId with 400', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .put('/patients/not-a-uuid/profile')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(400);
    });
  });

  describe('RBAC: staff-side roles may act on ANY patient (BAC-44)', () => {
    it.each(['super_admin', 'clinic_admin', 'provider', 'staff'] as const)(
      '%s can GET any patient profile',
      async (role) => {
        const patientId = randomUUID();
        const token = tokenFor(tenants.tenantA, role);

        await request(app.getHttpServer())
          .get(`/patients/${patientId}/profile`)
          .set('X-Tenant-Id', tenants.tenantA.slug)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      },
    );

    it.each(['super_admin', 'clinic_admin', 'provider', 'staff'] as const)(
      '%s can PUT (write) any patient profile',
      async (role) => {
        const patientId = randomUUID();
        const token = tokenFor(tenants.tenantA, role);

        await request(app.getHttpServer())
          .put(`/patients/${patientId}/profile`)
          .set('X-Tenant-Id', tenants.tenantA.slug)
          .set('Authorization', `Bearer ${token}`)
          .send(validPayload)
          .expect(200);
      },
    );
  });

  describe('RBAC: a patient may only touch their OWN profile (BAC-41 self-scoping)', () => {
    it('allows a patient to GET their OWN profile', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA, 'patient', patientId);

      await request(app.getHttpServer())
        .get(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it("forbids a patient from GETting a DIFFERENT patient's profile (403)", async () => {
      const ownPatientId = randomUUID();
      const otherPatientId = randomUUID();
      const token = tokenFor(tenants.tenantA, 'patient', ownPatientId);

      await request(app.getHttpServer())
        .get(`/patients/${otherPatientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('allows a patient to PUT (write) their OWN profile', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA, 'patient', patientId);

      await request(app.getHttpServer())
        .put(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(200);
    });

    it("forbids a patient from PUTting a DIFFERENT patient's profile (403)", async () => {
      const ownPatientId = randomUUID();
      const otherPatientId = randomUUID();
      const token = tokenFor(tenants.tenantA, 'patient', ownPatientId);

      await request(app.getHttpServer())
        .put(`/patients/${otherPatientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(403);
    });
  });

  describe('multi-tenant isolation', () => {
    it('never returns a profile saved under a different tenant', async () => {
      const patientId = randomUUID();
      const tokenA = tokenFor(tenants.tenantA);
      const tokenB = tokenFor(tenants.tenantB);

      await request(app.getHttpServer())
        .put(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(validPayload)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect((response.body as PatientProfileResponse).hasProfile).toBe(false);
    });
  });

  describe('PHI encryption (BAC-44): pgcrypto column-level encryption, end-to-end', () => {
    it('stores allergies/chronic_conditions as non-plaintext bytes in the underlying table', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .put(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          allergies: [{ substance: 'VerySensitivePenicillinAllergy' }],
          chronicConditions: [{ name: 'VerySensitiveHIVDiagnosis' }],
          medications: [],
        })
        .expect(200);

      const raw: QueryResult<{
        allergies: Buffer;
        chronic_conditions: Buffer;
      }> = await pool.query(
        `SELECT allergies, chronic_conditions FROM ${quoteSchemaIdentifier(
          tenants.tenantA.schemaName,
        )}.patient_profiles WHERE patient_id = $1`,
        [patientId],
      );
      const rawAllergies = raw.rows[0].allergies;
      const rawChronicConditions = raw.rows[0].chronic_conditions;
      expect(Buffer.isBuffer(rawAllergies)).toBe(true);
      expect(rawAllergies.toString('latin1')).not.toContain(
        'VerySensitivePenicillinAllergy',
      );
      expect(rawChronicConditions.toString('latin1')).not.toContain(
        'VerySensitiveHIVDiagnosis',
      );
    });

    it('still returns the decrypted plaintext through the API despite the encrypted storage', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .put(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as PatientProfileResponse;
      expect(body.allergies).toEqual(validPayload.allergies);
      expect(body.chronicConditions).toEqual(validPayload.chronicConditions);
    });
  });

  describe("demographics (read-through from services/emr's own FHIR Patient gateway, BAC-10)", () => {
    it('echoes back name/birthDate from a matching same-schema FHIR Patient resource', async () => {
      const token = tokenFor(tenants.tenantA);
      const patientResponse = await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          resourceType: 'Patient',
          name: [{ family: 'Doe', given: ['Jane'] }],
          birthDate: '1990-05-01',
        })
        .expect(201);
      const patientId = (patientResponse.body as { id: string }).id;

      const response = await request(app.getHttpServer())
        .get(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect((response.body as PatientProfileResponse).demographics).toEqual({
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-01',
      });
    });
  });

  describe('tenant/auth guard composition (shared with every route)', () => {
    it('rejects GET .../profile with no Authorization header (401)', async () => {
      const patientId = randomUUID();

      await request(app.getHttpServer())
        .get(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .expect(401);
    });

    it('rejects PUT .../profile for an inactive tenant (403)', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.inactiveTenant);

      await request(app.getHttpServer())
        .put(`/patients/${patientId}/profile`)
        .set('X-Tenant-Id', tenants.inactiveTenant.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(403);
    });
  });
});
