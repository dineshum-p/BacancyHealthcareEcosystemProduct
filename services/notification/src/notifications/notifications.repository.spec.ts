import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsSchemaProvisioner } from './notifications-schema.provisioner';
import { NotificationStatus } from './notification-status.enum';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

describe('NotificationsRepository', () => {
  const SCHEMA = 'tenant_a';
  let pool: Pool;
  let repository: NotificationsRepository;

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query(`CREATE SCHEMA ${SCHEMA}`);
    await new NotificationsSchemaProvisioner(pool).ensureProvisioned(SCHEMA);
    repository = new NotificationsRepository(pool);
  });

  describe('insertQueued', () => {
    it('persists a new notification with status queued and 0 attempts', async () => {
      const id = randomUUID();
      const created = await repository.insertQueued(SCHEMA, {
        id,
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
        data: { message: 'hi' },
      });

      expect(created).toMatchObject({
        id,
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
        data: { message: 'hi' },
        status: NotificationStatus.QUEUED,
        providerMessageId: null,
        attempts: 0,
        lastError: null,
      });
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('findById', () => {
    it('returns null when no notification matches the id', async () => {
      await expect(
        repository.findById(SCHEMA, randomUUID()),
      ).resolves.toBeNull();
    });

    it('finds a notification previously inserted in the same schema', async () => {
      const id = randomUUID();
      const created = await repository.insertQueued(SCHEMA, {
        id,
        channel: 'sms',
        to: '+15551234567',
        templateId: 'generic.notice',
        data: {},
      });

      await expect(repository.findById(SCHEMA, id)).resolves.toEqual(created);
    });

    it('does not find a notification that only exists in a different schema', async () => {
      await pool.query('CREATE SCHEMA tenant_b');
      await new NotificationsSchemaProvisioner(pool).ensureProvisioned(
        'tenant_b',
      );
      const id = randomUUID();
      await repository.insertQueued('tenant_b', {
        id,
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
        data: {},
      });

      await expect(repository.findById(SCHEMA, id)).resolves.toBeNull();
    });
  });

  describe('markSent', () => {
    it('transitions a notification to sent with the providerMessageId and attempts recorded', async () => {
      const id = randomUUID();
      await repository.insertQueued(SCHEMA, {
        id,
        channel: 'email',
        to: 'a@example.com',
        templateId: 'generic.notice',
        data: {},
      });

      await repository.markSent(SCHEMA, id, {
        providerMessageId: 'provider-msg-1',
        attempts: 2,
      });

      await expect(repository.findById(SCHEMA, id)).resolves.toMatchObject({
        status: NotificationStatus.SENT,
        providerMessageId: 'provider-msg-1',
        attempts: 2,
      });
    });
  });

  describe('markFailed', () => {
    it('transitions a notification to failed with the lastError and attempts recorded', async () => {
      const id = randomUUID();
      await repository.insertQueued(SCHEMA, {
        id,
        channel: 'sms',
        to: '+15551234567',
        templateId: 'generic.notice',
        data: {},
      });

      await repository.markFailed(SCHEMA, id, {
        lastError: 'Simulated permanent failure.',
        attempts: 3,
      });

      await expect(repository.findById(SCHEMA, id)).resolves.toMatchObject({
        status: NotificationStatus.FAILED,
        lastError: 'Simulated permanent failure.',
        attempts: 3,
      });
    });
  });
});
