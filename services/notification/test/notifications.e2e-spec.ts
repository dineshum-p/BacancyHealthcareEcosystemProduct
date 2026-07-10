import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AccessTokenPayload,
  NotificationResponse,
} from '@hep/shared-types';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.tokens';
import { NOTIFICATION_PROVIDER_ADAPTER } from '../src/notifications/providers/provider-adapter.tokens';
import type {
  NotificationProviderAdapter,
  ProviderSendOutcome,
} from '../src/notifications/providers/notification-provider-adapter.interface';
import {
  createInMemoryPool,
  createTenantsTable,
} from './support/create-in-memory-pool';
import { seedTestTenants, SeededTenants } from './support/tenant-fixtures';

const JWT_ACCESS_SECRET = 'e2e-notifications-test-secret';

/**
 * Controllable stand-in for `FakeNotificationProviderAdapter` whose
 * behaviour can be reconfigured PER TEST after the app has already been
 * built (a single `TestingModule`/app instance is reused across this whole
 * suite, same as `services/tenant`'s e2e specs) -- never makes a real
 * network call, same guarantee as the unit-level fake.
 */
class ControllableProviderAdapter implements NotificationProviderAdapter {
  mode: 'always-succeed' | 'always-fail' | 'fail-then-succeed' =
    'always-succeed';
  failCount = 0;
  callCount = 0;

  send(): Promise<ProviderSendOutcome> {
    this.callCount += 1;
    if (this.mode === 'always-succeed') {
      return Promise.resolve({
        outcome: 'sent',
        providerMessageId: `e2e-${this.callCount}`,
      });
    }
    if (this.mode === 'always-fail') {
      return Promise.resolve({
        outcome: 'failed',
        error: 'Simulated permanent failure.',
      });
    }
    return Promise.resolve(
      this.callCount <= this.failCount
        ? { outcome: 'failed', error: 'Simulated transient failure.' }
        : { outcome: 'sent', providerMessageId: `e2e-${this.callCount}` },
    );
  }

  reset(): void {
    this.mode = 'always-succeed';
    this.failCount = 0;
    this.callCount = 0;
  }
}

/**
 * Proves BAC-9's acceptance criteria end-to-end against a real (not mocked)
 * SQL engine (`pg-mem`), the same approach `services/tenant`/`services/auth`
 * established: production and `docker-compose.test.yml` both use the real
 * `pg` driver against real Postgres; only `PG_POOL` is swapped here.
 *
 * `services/notification` never issues tokens itself, so tests sign tokens
 * with a plain `JwtService` using the SAME secret this app is configured
 * with -- standing in for `services/auth`'s own token issuance, mirroring
 * `services/tenant`'s BAC-8 e2e pattern exactly.
 *
 * Small `NOTIFICATION_MAX_ATTEMPTS`/`NOTIFICATION_BACKOFF_BASE_MS` are set
 * so retry/backoff (AC3) completes fast and deterministically; delivery is
 * still genuinely asynchronous (real `setTimeout`-based backoff), so tests
 * poll `GET /notifications/:id` for a terminal status rather than assuming
 * a fixed delay.
 */
describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tenants: SeededTenants;
  let jwtService: JwtService;
  let providerAdapter: ControllableProviderAdapter;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;
    process.env.NOTIFICATION_MAX_ATTEMPTS = '3';
    process.env.NOTIFICATION_BACKOFF_BASE_MS = '5';

    pool = createInMemoryPool();
    await createTenantsTable(pool);
    tenants = await seedTestTenants(pool);
    jwtService = new JwtService();
    providerAdapter = new ControllableProviderAdapter();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .overrideProvider(NOTIFICATION_PROVIDER_ADAPTER)
      .useValue(providerAdapter)
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

  beforeEach(() => {
    providerAdapter.reset();
  });

  function signToken(payload: AccessTokenPayload): string {
    return jwtService.sign(payload, {
      secret: JWT_ACCESS_SECRET,
      algorithm: 'HS256',
      expiresIn: 900,
    });
  }

  function tokenFor(tenant: { id: string }): string {
    return signToken({ userId: 'user-1', tenantId: tenant.id, role: 'staff' });
  }

  async function waitForTerminalStatus(
    tenantSlug: string,
    token: string,
    id: string,
  ): Promise<NotificationResponse> {
    const deadline = Date.now() + 5000;

    while (true) {
      const response = await request(app.getHttpServer())
        .get(`/notifications/${id}`)
        .set('X-Tenant-Id', tenantSlug)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = response.body as NotificationResponse;
      if (body.status !== 'queued') {
        return body;
      }
      if (Date.now() > deadline) {
        throw new Error(
          'Timed out waiting for a terminal notification status.',
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  it('AC1: POST /notifications renders the template and returns 201 with a queued notification id', async () => {
    const token = tokenFor(tenants.tenantA);

    const response = await request(app.getHttpServer())
      .post('/notifications')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        channel: 'email',
        to: 'newuser@example.com',
        templateId: 'generic.notice',
        data: { message: 'Hello!' },
      })
      .expect(201);

    const body = response.body as NotificationResponse;
    expect(body.id).toEqual(expect.any(String));
    expect(body.status).toBe('queued');
    expect(body.channel).toBe('email');
    expect(body.to).toBe('newuser@example.com');
  });

  it('AC2/AC3: a successful delivery transitions queued -> sent, recording the providerMessageId', async () => {
    providerAdapter.mode = 'always-succeed';
    const token = tokenFor(tenants.tenantA);

    const created = await request(app.getHttpServer())
      .post('/notifications')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
        data: { message: 'hi' },
      })
      .expect(201);
    const { id } = created.body as NotificationResponse;

    const finalState = await waitForTerminalStatus(
      tenants.tenantA.slug,
      token,
      id,
    );

    expect(finalState.status).toBe('sent');
    expect(finalState.providerMessageId).toEqual(expect.any(String));
    expect(finalState.attempts).toBe(1);
  });

  it('AC3: a transient failure is retried and eventually marked sent, with attempts > 1', async () => {
    providerAdapter.mode = 'fail-then-succeed';
    providerAdapter.failCount = 2;
    const token = tokenFor(tenants.tenantA);

    const created = await request(app.getHttpServer())
      .post('/notifications')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        channel: 'sms',
        to: '+15551234567',
        templateId: 'generic.notice',
        data: { message: 'hi' },
      })
      .expect(201);
    const { id } = created.body as NotificationResponse;

    const finalState = await waitForTerminalStatus(
      tenants.tenantA.slug,
      token,
      id,
    );

    expect(finalState.status).toBe('sent');
    expect(finalState.attempts).toBe(3);
  });

  it('AC3: a permanent failure is marked failed only after exhausting max attempts', async () => {
    providerAdapter.mode = 'always-fail';
    const token = tokenFor(tenants.tenantA);

    const created = await request(app.getHttpServer())
      .post('/notifications')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
        data: { message: 'hi' },
      })
      .expect(201);
    const { id } = created.body as NotificationResponse;

    const finalState = await waitForTerminalStatus(
      tenants.tenantA.slug,
      token,
      id,
    );

    expect(finalState.status).toBe('failed');
    expect(finalState.attempts).toBe(3);
    expect(finalState.lastError).toContain('Simulated permanent failure.');
  });

  it('rejects an unknown templateId with 400 before persisting anything', async () => {
    const token = tokenFor(tenants.tenantA);

    await request(app.getHttpServer())
      .post('/notifications')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        channel: 'email',
        to: 'a@example.com',
        templateId: 'does.not.exist',
      })
      .expect(400);
  });

  it('rejects POST /notifications with no Authorization header (401)', async () => {
    await request(app.getHttpServer())
      .post('/notifications')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .send({
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
      })
      .expect(401);
  });

  it('rejects POST /notifications with no X-Tenant-Id (404)', async () => {
    const token = tokenFor(tenants.tenantA);

    await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
      })
      .expect(404);
  });

  it('rejects POST /notifications for an inactive tenant (403)', async () => {
    const token = tokenFor(tenants.inactiveTenant);

    await request(app.getHttpServer())
      .post('/notifications')
      .set('X-Tenant-Id', tenants.inactiveTenant.slug)
      .set('Authorization', `Bearer ${token}`)
      .send({
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
      })
      .expect(403);
  });

  it('rejects a token issued for a DIFFERENT tenant than X-Tenant-Id claims (401, tenant/token mismatch)', async () => {
    const tokenForTenantB = tokenFor(tenants.tenantB);

    await request(app.getHttpServer())
      .post('/notifications')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${tokenForTenantB}`)
      .send({
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
      })
      .expect(401);
  });

  it('AC2: GET /notifications/:id for an unknown id returns 404', async () => {
    const token = tokenFor(tenants.tenantA);

    await request(app.getHttpServer())
      .get('/notifications/00000000-0000-0000-0000-000000000000')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('a notification created under tenant A is invisible to tenant B (multi-tenant isolation)', async () => {
    const tokenA = tokenFor(tenants.tenantA);
    const tokenB = tokenFor(tenants.tenantB);

    const created = await request(app.getHttpServer())
      .post('/notifications')
      .set('X-Tenant-Id', tenants.tenantA.slug)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
      })
      .expect(201);
    const { id } = created.body as NotificationResponse;

    await request(app.getHttpServer())
      .get(`/notifications/${id}`)
      .set('X-Tenant-Id', tenants.tenantB.slug)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });
});
