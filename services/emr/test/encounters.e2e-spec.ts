import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AccessTokenPayload, EncounterSummary } from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { DOMAIN_EVENT_PUBLISHER } from '../src/events/events.constants';
import { DomainEventPublisher } from '../src/events/domain-event-publisher.interface';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-encounter-notes-test-secret';

/**
 * Proves BAC-15's acceptance criteria end-to-end against a real (not
 * mocked) SQL engine (`pg-mem`), the same approach every other service in
 * this repo established. `DOMAIN_EVENT_PUBLISHER` is swapped for a fake spy
 * so AC4 can be asserted without a real Kafka broker (mirrors
 * `services/patient`'s BAC-14 e2e convention exactly).
 */
describe('SOAP encounter notes (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;
  let fakeEventPublisher: jest.Mocked<DomainEventPublisher>;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);
    jwtService = new JwtService();
    fakeEventPublisher = {
      publishEncounterCreated: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .overrideProvider(DOMAIN_EVENT_PUBLISHER)
      .useValue(fakeEventPublisher)
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

  afterEach(() => {
    fakeEventPublisher.publishEncounterCreated.mockClear();
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

  const validSoapNote = {
    subjective: 'Patient reports dizziness and headaches.',
    objective: 'BP 150/95, HR 88, alert and oriented.',
    assessment: 'Suspected hypertension.',
    plan: 'Start lisinopril 10mg daily, follow up in 2 weeks.',
  };

  const validPayload = {
    soapNote: validSoapNote,
    vitals: {
      heartRate: 88,
      bloodPressureSystolic: 150,
      bloodPressureDiastolic: 95,
      temperature: 37.1,
      respiratoryRate: 18,
      spO2: 97,
    },
    allergies: [
      { substance: 'Penicillin', reaction: 'Hives', severity: 'severe' },
    ],
  };

  describe('AC1: POST /patients/:patientId/encounters', () => {
    it('saves a structured SOAP note, vitals, and allergies, returning 201 with the created encounter', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(201);

      const body = response.body as EncounterSummary;
      expect(body.id).toEqual(expect.any(String));
      expect(body.tenantId).toBe(tenants.tenantA.id);
      expect(body.patientId).toBe(patientId);
      expect(body.soapNote).toEqual(validSoapNote);
      expect(body.vitals).toEqual(validPayload.vitals);
      expect(body.allergies).toEqual(validPayload.allergies);
    });

    it('accepts an encounter with no vitals/allergies (both optional), returning null vitals and an empty allergies list', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ soapNote: validSoapNote })
        .expect(201);

      const body = response.body as EncounterSummary;
      expect(body.vitals).toBeNull();
      expect(body.allergies).toEqual([]);
    });

    it('rejects a payload missing required SOAP fields with 400', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ soapNote: { subjective: 'Only subjective' } })
        .expect(400);
    });

    it('rejects a malformed (non-UUID) patientId with 400', async () => {
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post('/patients/not-a-uuid/encounters')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ soapNote: validSoapNote })
        .expect(400);
    });

    it('rejects a STAFF role from creating an encounter with 403 (RBAC: WRITE_ENCOUNTER required)', async () => {
      const patientId = randomUUID();
      const staffToken = tokenFor(tenants.tenantA, 'staff');

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ soapNote: validSoapNote })
        .expect(403);
    });

    it('allows a CLINIC_ADMIN role to create an encounter', async () => {
      const patientId = randomUUID();
      const adminToken = tokenFor(tenants.tenantA, 'clinic_admin');

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ soapNote: validSoapNote })
        .expect(201);
    });
  });

  describe('AC3: vitals must fall within a plausible clinical range', () => {
    it.each([
      [{ heartRate: 999 }],
      [{ bloodPressureSystolic: 10 }],
      [{ bloodPressureDiastolic: 999 }],
      [{ temperature: 200 }],
      [{ respiratoryRate: 0 }],
      [{ spO2: 150 }],
    ])('rejects an out-of-range vitals payload %j with 400', async (vitals) => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ soapNote: validSoapNote, vitals })
        .expect(400);
    });
  });

  describe('AC2: GET /patients/:patientId/encounters', () => {
    it("returns the patient's encounter history, most recent first", async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      const first = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          soapNote: { ...validSoapNote, subjective: 'First visit' },
        })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          soapNote: { ...validSoapNote, subjective: 'Second visit' },
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as EncounterSummary[];
      expect(body.map((e) => e.id)).toEqual([
        (second.body as EncounterSummary).id,
        (first.body as EncounterSummary).id,
      ]);
    });

    it('never returns encounters for a different patient', async () => {
      const patientId = randomUUID();
      const otherPatientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post(`/patients/${otherPatientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ soapNote: validSoapNote })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('never returns encounters recorded under a different tenant (multi-tenant isolation)', async () => {
      const patientId = randomUUID();
      const tokenA = tokenFor(tenants.tenantA);
      const tokenB = tokenFor(tenants.tenantB);

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ soapNote: validSoapNote })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('allows a STAFF role to read encounter history (READ_ENCOUNTER granted to every role)', async () => {
      const patientId = randomUUID();
      const staffToken = tokenFor(tenants.tenantA, 'staff');

      await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });
  });

  describe('AC4: creating an encounter emits an encounter.created domain event', () => {
    it('publishes encounter.created with the correct shape (eventId = the encounter id) after a successful save', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      const response = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ soapNote: validSoapNote })
        .expect(201);

      const body = response.body as EncounterSummary;
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(fakeEventPublisher.publishEncounterCreated).toHaveBeenCalledTimes(
        1,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(fakeEventPublisher.publishEncounterCreated).toHaveBeenCalledWith({
        eventId: body.id,
        encounterId: body.id,
        patientId,
        tenantId: tenants.tenantA.id,
        createdAt: body.createdAt,
      });
    });

    it('does not publish an event for a rejected (400) encounter', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ soapNote: { subjective: 'Incomplete' } })
        .expect(400);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(fakeEventPublisher.publishEncounterCreated).not.toHaveBeenCalled();
    });
  });

  describe('tenant/auth guard composition (shared with every route)', () => {
    it('rejects POST .../encounters with no Authorization header (401)', async () => {
      const patientId = randomUUID();

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .send({ soapNote: validSoapNote })
        .expect(401);
    });

    it('rejects POST .../encounters with no X-Tenant-Id (404)', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.tenantA);

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('Authorization', `Bearer ${token}`)
        .send({ soapNote: validSoapNote })
        .expect(404);
    });

    it('rejects POST .../encounters for an inactive tenant (403)', async () => {
      const patientId = randomUUID();
      const token = tokenFor(tenants.inactiveTenant);

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.inactiveTenant.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({ soapNote: validSoapNote })
        .expect(403);
    });

    it('rejects a token issued for a DIFFERENT tenant than X-Tenant-Id claims (401)', async () => {
      const patientId = randomUUID();
      const tokenForTenantB = tokenFor(tenants.tenantB);

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${tokenForTenantB}`)
        .send({ soapNote: validSoapNote })
        .expect(401);
    });
  });
});
