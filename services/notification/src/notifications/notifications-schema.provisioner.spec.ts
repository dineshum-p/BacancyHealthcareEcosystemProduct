import { Pool } from 'pg';
import { NotificationsSchemaProvisioner } from './notifications-schema.provisioner';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

describe('NotificationsSchemaProvisioner', () => {
  let pool: Pool;
  let provisioner: NotificationsSchemaProvisioner;

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query('CREATE SCHEMA tenant_a');
    provisioner = new NotificationsSchemaProvisioner(pool);
  });

  it('creates the notifications table inside the given schema', async () => {
    await provisioner.ensureProvisioned('tenant_a');

    const result = await pool.query(
      `INSERT INTO ${quoteSchemaIdentifier('tenant_a')}.notifications
         (id, channel, to_address, template_id, data, status, attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        '11111111-1111-1111-1111-111111111111',
        'email',
        'a@example.com',
        'generic.notice',
        '{}',
        'queued',
        0,
      ],
    );
    expect(result.rows).toHaveLength(1);
  });

  it('is idempotent: calling it twice for the same schema does not throw', async () => {
    await provisioner.ensureProvisioned('tenant_a');
    await expect(
      provisioner.ensureProvisioned('tenant_a'),
    ).resolves.toBeUndefined();
  });

  it('caches provisioned schemas in-process (does not re-run DDL on the second call)', async () => {
    const querySpy = jest.spyOn(pool, 'query');
    await provisioner.ensureProvisioned('tenant_a');
    querySpy.mockClear();

    await provisioner.ensureProvisioned('tenant_a');

    expect(querySpy).not.toHaveBeenCalled();
  });

  it('provisions independently for a second, different schema', async () => {
    await pool.query('CREATE SCHEMA tenant_b');
    await provisioner.ensureProvisioned('tenant_a');
    await provisioner.ensureProvisioned('tenant_b');

    await expect(
      pool.query(
        `SELECT * FROM ${quoteSchemaIdentifier('tenant_b')}.notifications`,
      ),
    ).resolves.toBeDefined();
  });
});
