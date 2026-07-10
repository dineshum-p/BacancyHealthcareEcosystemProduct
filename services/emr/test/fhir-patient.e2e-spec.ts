import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AccessTokenPayload,
  FhirPatientResource,
} from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { FhirExceptionFilter } from '../src/fhir/fhir-exception.filter';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-fhir-patient-test-secret';

/**
 * Proves BAC-10's four acceptance criteria end-to-end against a real (not
 * mocked) SQL engine (`pg-mem`), the same approach every other service in
 * this repo established: production and `docker-compose.test.yml` both use
 * the real `pg` driver against real Postgres; only `PG_POOL` is swapped
 * here.
 *
 * `services/emr` never issues tokens itself, so tests sign tokens with a
 * plain `JwtService` using the SAME secret this app is configured with --
 * standing in for `services/auth`'s own token issuance, mirroring
 * `services/tenant`/`services/notification`'s e2e pattern exactly.
 */
describe('FHIR Patient gateway (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;

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
    app.useGlobalFilters(new FhirExceptionFilter());
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
  ): string {
    return signToken({ userId: 'user-1', tenantId: tenant.id, role });
  }

  const minimalPatientPayload = {
    resourceType: 'Patient',
    name: [{ family: 'Shepard', given: ['Jane'] }],
    gender: 'female',
    birthDate: '1990-05-01',
  };

  describe('AC2: POST /fhir/Patient', () => {
    it('accepts a conformant FHIR R4 Patient payload and returns 201 with the created resource id', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(minimalPatientPayload)
        .expect(201);

      const body = response.body as FhirPatientResource;
      expect(body.resourceType).toBe('Patient');
      expect(body.id).toEqual(expect.any(String));
      expect(body.name).toEqual([{ family: 'Shepard', given: ['Jane'] }]);
      expect(body.gender).toBe('female');
    });

    it('a WRITE_PATIENT-capable role (clinic_admin) may also create a patient', async () => {
      const token = tokenFor(tenants.tenantA, 'clinic_admin');

      await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(minimalPatientPayload)
        .expect(201);
    });
  });

  describe('AC1: GET /fhir/Patient/:id', () => {
    it('returns the valid FHIR R4 Patient resource for the resolved tenant', async () => {
      const token = tokenFor(tenants.tenantA);
      const created = await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(minimalPatientPayload)
        .expect(201);
      const { id } = created.body as FhirPatientResource;

      const response = await request(app.getHttpServer())
        .get(`/fhir/Patient/${id}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as FhirPatientResource;
      expect(body).toEqual({
        resourceType: 'Patient',
        id,
        name: [{ family: 'Shepard', given: ['Jane'] }],
        gender: 'female',
        birthDate: '1990-05-01',
      });
    });

    it('returns a 404 OperationOutcome for an unknown patient id (AC3-style consistent error shape)', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .get('/fhir/Patient/00000000-0000-0000-0000-000000000000')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toMatchObject({
        resourceType: 'OperationOutcome',
        issue: [expect.objectContaining({ code: 'not-found' })],
      });
    });
  });

  describe('AC3: malformed / non-R4-conformant payloads', () => {
    it('rejects a payload with the wrong resourceType with a 400 OperationOutcome', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ resourceType: 'Observation', name: [{ family: 'Shepard' }] })
        .expect(400);

      expect(response.body).toMatchObject({
        resourceType: 'OperationOutcome',
        issue: [
          expect.objectContaining({
            severity: 'error',
            code: 'invalid',
          }),
        ],
      });
      expect(response.body).not.toHaveProperty('statusCode');
      expect(response.body).not.toHaveProperty('error');
    });

    it('rejects a payload with no name at all with a 400 OperationOutcome', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ resourceType: 'Patient' })
        .expect(400);

      expect(response.body).toMatchObject({ resourceType: 'OperationOutcome' });
    });

    it('rejects an unknown/extra field (forbidNonWhitelisted) with a 400 OperationOutcome', async () => {
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...minimalPatientPayload, notAFhirField: 'oops' })
        .expect(400);

      expect(response.body).toMatchObject({ resourceType: 'OperationOutcome' });
    });
  });

  describe('AC4: tenant scoping and RBAC', () => {
    it('rejects POST /fhir/Patient with no Authorization header (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .send(minimalPatientPayload)
        .expect(401);

      expect(response.body).toMatchObject({ resourceType: 'OperationOutcome' });
    });

    it('rejects POST /fhir/Patient with no X-Tenant-Id (404)', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('Authorization', `Bearer ${token}`)
        .send(minimalPatientPayload)
        .expect(404);
    });

    it('rejects POST /fhir/Patient for an inactive tenant (403)', async () => {
      const token = tokenFor(tenants.inactiveTenant);

      await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.inactiveTenant.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(minimalPatientPayload)
        .expect(403);
    });

    it('rejects a token issued for a DIFFERENT tenant than X-Tenant-Id claims (401)', async () => {
      const tokenForTenantB = tokenFor(tenants.tenantB);

      await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${tokenForTenantB}`)
        .send(minimalPatientPayload)
        .expect(401);
    });

    it('rejects a STAFF role from creating a patient with 403 (RBAC: WRITE_PATIENT required)', async () => {
      const token = tokenFor(tenants.tenantA, 'staff');

      const response = await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(minimalPatientPayload)
        .expect(403);

      expect(response.body).toMatchObject({
        resourceType: 'OperationOutcome',
        issue: [expect.objectContaining({ code: 'forbidden' })],
      });
    });

    it('allows a STAFF role to read a patient (RBAC: READ_PATIENT granted to every role)', async () => {
      const providerToken = tokenFor(tenants.tenantA, 'provider');
      const created = await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${providerToken}`)
        .send(minimalPatientPayload)
        .expect(201);
      const { id } = created.body as FhirPatientResource;

      const staffToken = tokenFor(tenants.tenantA, 'staff');
      await request(app.getHttpServer())
        .get(`/fhir/Patient/${id}`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });

    it('a patient created under tenant A is invisible to tenant B (multi-tenant isolation)', async () => {
      const tokenA = tokenFor(tenants.tenantA);
      const tokenB = tokenFor(tenants.tenantB);

      const created = await request(app.getHttpServer())
        .post('/fhir/Patient')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(minimalPatientPayload)
        .expect(201);
      const { id } = created.body as FhirPatientResource;

      await request(app.getHttpServer())
        .get(`/fhir/Patient/${id}`)
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });
  });
});
