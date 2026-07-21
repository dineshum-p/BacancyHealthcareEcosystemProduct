import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AccessTokenPayload,
  PaginatedPatientsResponse,
  PatientSelfRegistrationSummary,
  PatientSummary,
  SelfRegistrationReceipt,
} from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { DOMAIN_EVENT_PUBLISHER } from '../src/events/events.constants';
import { DomainEventPublisher } from '../src/events/domain-event-publisher.interface';
import { quoteSchemaIdentifier } from '../src/tenants/schema-identifier.util';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-patient-self-registration-test-secret';

/**
 * Proves BAC-36's acceptance criteria end-to-end: the public,
 * unauthenticated self-registration submission, duplicate detection, the
 * pending/not-searchable lifecycle, the staff approve/reject/merge review
 * actions, RBAC (including the narrow `staff` `REVIEW_SELF_REGISTRATION`
 * permission), and audit logging. Mirrors BAC-14/BAC-17's
 * `patients.e2e-spec.ts` conventions exactly -- see that file's doc comment.
 * Rate limiting (also an AC) is proven separately, in
 * `bac36-public-registration-rate-limit.e2e-spec.ts`, with its own app
 * instance configured with a tiny limit -- see that file's doc comment for
 * why it is not proven here.
 */
describe('Patient self-registration (e2e, BAC-36)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;
  let fakeEventPublisher: jest.Mocked<DomainEventPublisher>;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;
    // Generous limit: this suite makes well under this many public-endpoint
    // calls, so functional assertions are never confused with throttling.
    process.env.PUBLIC_PATIENT_REGISTRATION_RATE_LIMIT = '1000';
    process.env.PUBLIC_PATIENT_REGISTRATION_RATE_TTL_MS = '60000';

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);
    jwtService = new JwtService();
    fakeEventPublisher = {
      publishPatientCreated: jest.fn().mockResolvedValue(undefined),
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
    fakeEventPublisher.publishPatientCreated.mockClear();
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
    role: AccessTokenPayload['role'] = 'clinic_admin',
  ): string {
    return signToken({ userId: 'staff-1', tenantId: tenant.id, role });
  }

  async function auditLogsFor(
    schemaName: string,
    resourceId: string,
  ): Promise<Array<{ action: string; actor_user_id: string | null }>> {
    const schema = quoteSchemaIdentifier(schemaName);
    const result = await pool.query<{
      action: string;
      actor_user_id: string | null;
    }>(
      `SELECT action, actor_user_id FROM ${schema}.audit_logs WHERE resource_id = $1 ORDER BY created_at ASC`,
      [resourceId],
    );
    return result.rows;
  }

  describe('AC: POST /public/tenants/:tenantSlug/patients (no auth required)', () => {
    it('accepts a submission with no Authorization header and creates a pending, tenant-scoped record', async () => {
      const response = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
        .send({
          firstName: 'SelfReg',
          lastName: 'Patient',
          dateOfBirth: '1992-03-03',
        })
        .expect(201);

      const body = response.body as SelfRegistrationReceipt;
      expect(body.status).toBe('pending');
      expect(body.tenantId).toBe(tenants.tenantA.id);
      expect(body.id).toEqual(expect.any(String));
    });

    it('rejects a payload missing required fields with 400', async () => {
      await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
        .send({ firstName: 'Incomplete' })
        .expect(400);
    });

    it('rejects an unknown tenant slug with 404', async () => {
      await request(app.getHttpServer())
        .post('/public/tenants/no-such-tenant/patients')
        .send({
          firstName: 'Ghost',
          lastName: 'Patient',
          dateOfBirth: '1990-01-01',
        })
        .expect(404);
    });

    it('rejects an inactive tenant with 403', async () => {
      await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.inactiveTenant.slug}/patients`)
        .send({
          firstName: 'Ghost',
          lastName: 'Patient',
          dateOfBirth: '1990-01-01',
        })
        .expect(403);
    });

    it('writes an audit entry with a null actor (anonymous, self-submitted action)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
        .send({
          firstName: 'Audited',
          lastName: 'SelfReg',
          dateOfBirth: '1993-04-04',
        })
        .expect(201);

      const body = response.body as SelfRegistrationReceipt;
      const logs = await auditLogsFor(tenants.tenantA.schemaName, body.id);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('create');
      expect(logs[0].actor_user_id).toBeNull();
    });
  });

  describe('AC: duplicate detection flags a probable match instead of auto-creating a record', () => {
    let existingPatient: PatientSummary;

    beforeAll(async () => {
      const token = tokenFor(tenants.tenantB);
      const response = await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Existing',
          lastName: 'Walkin',
          dateOfBirth: '1980-06-15',
          phone: '555-1000',
          email: 'existing.walkin@example.com',
        })
        .expect(201);
      existingPatient = response.body as PatientSummary;
    });

    it('flags a name+DOB match (case-insensitive) as a probable duplicate, not a new record', async () => {
      const response = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantB.slug}/patients`)
        .send({
          firstName: 'existing',
          lastName: 'WALKIN',
          dateOfBirth: '1980-06-15',
        })
        .expect(201);

      const staffToken = tokenFor(tenants.tenantB);
      const queue = await request(app.getHttpServer())
        .get('/patients/self-registrations')
        .query({ status: 'pending' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const entry = (queue.body as PatientSelfRegistrationSummary[]).find(
        (item) => item.id === (response.body as SelfRegistrationReceipt).id,
      );
      expect(entry?.matchedPatientId).toBe(existingPatient.id);
      expect(entry?.matchReason).toBe('name_dob');
    });

    it('flags an exact phone match as a probable duplicate when name/DOB differ', async () => {
      const response = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantB.slug}/patients`)
        .send({
          firstName: 'Nick',
          lastName: 'Name',
          dateOfBirth: '1985-02-02',
          phone: '555-1000',
        })
        .expect(201);

      const staffToken = tokenFor(tenants.tenantB);
      const queue = await request(app.getHttpServer())
        .get('/patients/self-registrations')
        .query({ status: 'pending' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const entry = (queue.body as PatientSelfRegistrationSummary[]).find(
        (item) => item.id === (response.body as SelfRegistrationReceipt).id,
      );
      expect(entry?.matchedPatientId).toBe(existingPatient.id);
      expect(entry?.matchReason).toBe('phone');
    });

    it('does not flag a submission that matches nothing', async () => {
      const response = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantB.slug}/patients`)
        .send({
          firstName: 'Nobody',
          lastName: 'Matches',
          dateOfBirth: '2005-05-05',
        })
        .expect(201);

      const staffToken = tokenFor(tenants.tenantB);
      const queue = await request(app.getHttpServer())
        .get('/patients/self-registrations')
        .query({ status: 'pending' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const entry = (queue.body as PatientSelfRegistrationSummary[]).find(
        (item) => item.id === (response.body as SelfRegistrationReceipt).id,
      );
      expect(entry?.matchedPatientId).toBeNull();
      expect(entry?.matchReason).toBeNull();
    });
  });

  describe('AC: a pending self-registration is not searchable via GET /patients until confirmed', () => {
    it('does not appear in GET /patients while pending', async () => {
      await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
        .send({
          firstName: 'NotYetSearchable',
          lastName: 'Patient',
          dateOfBirth: '1994-07-07',
        })
        .expect(201);

      const token = tokenFor(tenants.tenantA);
      const search = await request(app.getHttpServer())
        .get('/patients')
        .query({ name: 'NotYetSearchable' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect((search.body as PaginatedPatientsResponse).total).toBe(0);
    });
  });

  describe('AC: staff approve a pending self-registration', () => {
    it('creates a real, searchable patient with an MRN and publishes patient.created', async () => {
      const submission = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
        .send({
          firstName: 'ToApprove',
          lastName: 'Patient',
          dateOfBirth: '1995-08-08',
        })
        .expect(201);
      const registrationId = (submission.body as SelfRegistrationReceipt).id;

      const staffToken = tokenFor(tenants.tenantA, 'staff');
      const approveResponse = await request(app.getHttpServer())
        .post(`/patients/self-registrations/${registrationId}/approve`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(201);

      const approved = approveResponse.body as PatientSelfRegistrationSummary;
      expect(approved.status).toBe('approved');
      expect(approved.resultingPatientId).toEqual(expect.any(String));

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(fakeEventPublisher.publishPatientCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: approved.resultingPatientId,
          tenantId: tenants.tenantA.id,
        }),
      );

      const token = tokenFor(tenants.tenantA);
      const search = await request(app.getHttpServer())
        .get('/patients')
        .query({ name: 'ToApprove' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const results = search.body as PaginatedPatientsResponse;
      expect(results.total).toBe(1);
      expect(results.items[0].id).toBe(approved.resultingPatientId);
      expect(results.items[0].mrn).toEqual(expect.any(String));
    });

    it('writes an audit entry for the approval', async () => {
      const submission = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
        .send({
          firstName: 'AuditApprove',
          lastName: 'Patient',
          dateOfBirth: '1996-09-09',
        })
        .expect(201);
      const registrationId = (submission.body as SelfRegistrationReceipt).id;

      const staffToken = tokenFor(tenants.tenantA, 'clinic_admin');
      await request(app.getHttpServer())
        .post(`/patients/self-registrations/${registrationId}/approve`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(201);

      const logs = await auditLogsFor(
        tenants.tenantA.schemaName,
        registrationId,
      );
      expect(logs.some((log) => log.action === 'create')).toBe(true);
      expect(logs.some((log) => log.actor_user_id === 'staff-1')).toBe(true);
    });

    it('rejects approving the same self-registration twice (409)', async () => {
      const submission = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
        .send({
          firstName: 'DoubleApprove',
          lastName: 'Patient',
          dateOfBirth: '1997-10-10',
        })
        .expect(201);
      const registrationId = (submission.body as SelfRegistrationReceipt).id;

      const staffToken = tokenFor(tenants.tenantA, 'staff');
      await request(app.getHttpServer())
        .post(`/patients/self-registrations/${registrationId}/approve`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/patients/self-registrations/${registrationId}/approve`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(409);
    });
  });

  describe('AC: staff reject a pending self-registration', () => {
    it('marks it rejected and it never becomes searchable', async () => {
      const submission = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
        .send({
          firstName: 'ToReject',
          lastName: 'Patient',
          dateOfBirth: '1998-11-11',
        })
        .expect(201);
      const registrationId = (submission.body as SelfRegistrationReceipt).id;

      const staffToken = tokenFor(tenants.tenantA, 'staff');
      const rejectResponse = await request(app.getHttpServer())
        .post(`/patients/self-registrations/${registrationId}/reject`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'Could not verify identity.' })
        .expect(201);

      const rejected = rejectResponse.body as PatientSelfRegistrationSummary;
      expect(rejected.status).toBe('rejected');
      expect(rejected.resultingPatientId).toBeNull();

      const token = tokenFor(tenants.tenantA);
      const search = await request(app.getHttpServer())
        .get('/patients')
        .query({ name: 'ToReject' })
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((search.body as PaginatedPatientsResponse).total).toBe(0);
    });
  });

  describe('AC: staff merge a pending self-registration into an existing matched patient', () => {
    it('links the self-registration to the target patient without creating a second record', async () => {
      const staffTokenForCreate = tokenFor(tenants.tenantB);
      const existing = await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${staffTokenForCreate}`)
        .send({
          firstName: 'MergeTarget',
          lastName: 'Patient',
          dateOfBirth: '1975-12-12',
        })
        .expect(201);
      const existingPatient = existing.body as PatientSummary;

      const submission = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantB.slug}/patients`)
        .send({
          firstName: 'MergeTarget',
          lastName: 'Patient',
          dateOfBirth: '1975-12-12',
        })
        .expect(201);
      const registrationId = (submission.body as SelfRegistrationReceipt).id;

      const staffToken = tokenFor(tenants.tenantB, 'staff');
      const mergeResponse = await request(app.getHttpServer())
        .post(`/patients/self-registrations/${registrationId}/merge`)
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ targetPatientId: existingPatient.id })
        .expect(201);

      const merged = mergeResponse.body as PatientSelfRegistrationSummary;
      expect(merged.status).toBe('merged');
      expect(merged.resultingPatientId).toBe(existingPatient.id);

      const token = tokenFor(tenants.tenantB);
      const search = await request(app.getHttpServer())
        .get('/patients')
        .query({ name: 'MergeTarget' })
        .set('X-Tenant-Id', tenants.tenantB.slug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      // Only the ORIGINAL walk-in patient exists -- merging never created a
      // second, disconnected record for the self-registration.
      expect((search.body as PaginatedPatientsResponse).total).toBe(1);
    });

    it('rejects merging into a patient id that does not exist in this tenant (404)', async () => {
      const submission = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
        .send({
          firstName: 'MergeGhost',
          lastName: 'Patient',
          dateOfBirth: '1999-01-01',
        })
        .expect(201);
      const registrationId = (submission.body as SelfRegistrationReceipt).id;

      const staffToken = tokenFor(tenants.tenantA, 'staff');
      await request(app.getHttpServer())
        .post(`/patients/self-registrations/${registrationId}/merge`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ targetPatientId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });
  });

  describe('RBAC: only clinic_admin/staff may access the self-registration review queue', () => {
    it('allows staff to view the pending queue (narrow REVIEW_SELF_REGISTRATION permission)', async () => {
      const staffToken = tokenFor(tenants.tenantA, 'staff');
      await request(app.getHttpServer())
        .get('/patients/self-registrations')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });

    it('allows clinic_admin to view the pending queue', async () => {
      const adminToken = tokenFor(tenants.tenantA, 'clinic_admin');
      await request(app.getHttpServer())
        .get('/patients/self-registrations')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('rejects a provider from viewing the pending queue (403)', async () => {
      const providerToken = tokenFor(tenants.tenantA, 'provider');
      await request(app.getHttpServer())
        .get('/patients/self-registrations')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(403);
    });

    it('rejects an unauthenticated caller from viewing the pending queue (401)', async () => {
      await request(app.getHttpServer())
        .get('/patients/self-registrations')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .expect(401);
    });

    it('rejects a provider from approving a pending self-registration (403)', async () => {
      const submission = await request(app.getHttpServer())
        .post(`/public/tenants/${tenants.tenantA.slug}/patients`)
        .send({
          firstName: 'ProviderCannotApprove',
          lastName: 'Patient',
          dateOfBirth: '2001-02-02',
        })
        .expect(201);
      const registrationId = (submission.body as SelfRegistrationReceipt).id;

      const providerToken = tokenFor(tenants.tenantA, 'provider');
      await request(app.getHttpServer())
        .post(`/patients/self-registrations/${registrationId}/approve`)
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(403);
    });

    it("does not grant staff general write_patient just via REVIEW_SELF_REGISTRATION (staff still can't POST /patients)", async () => {
      const staffToken = tokenFor(tenants.tenantA, 'staff');
      await request(app.getHttpServer())
        .post('/patients')
        .set('X-Tenant-Id', tenants.tenantA.slug)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          firstName: 'Staff',
          lastName: 'StillCannotWrite',
          dateOfBirth: '1990-01-01',
        })
        .expect(403);
    });
  });
});
