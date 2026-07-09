import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AuditLogsRepository } from './audit-logs.repository';
import { TenantSchemaProvisioner } from '../tenants/provisioning/tenant-schema-provisioner';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

describe('AuditLogsRepository', () => {
  let pool: Pool;
  let provisioner: TenantSchemaProvisioner;
  let repository: AuditLogsRepository;

  beforeEach(async () => {
    pool = createInMemoryPool();
    provisioner = new TenantSchemaProvisioner(pool);
    repository = new AuditLogsRepository(pool, provisioner);
    await provisioner.provision('tenant_acme');
  });

  describe('insert', () => {
    it('persists an entry retrievable via findAll', async () => {
      await repository.insert('tenant_acme', {
        id: randomUUID(),
        actorUserId: 'user-1',
        action: 'create',
        resourceType: 'item',
        resourceId: '1',
        before: null,
        after: { id: 1, name: 'widget' },
      });

      const { items, total } = await repository.findAll(
        'tenant_acme',
        {},
        { page: 1, limit: 20 },
      );

      expect(total).toBe(1);
      expect(items).toEqual([
        expect.objectContaining({
          actorUserId: 'user-1',
          action: 'create',
          resourceType: 'item',
          resourceId: '1',
          before: null,
          after: { id: 1, name: 'widget' },
        }),
      ]);
      expect(items[0].createdAt).toBeInstanceOf(Date);
    });

    it('lazily provisions the audit_logs table for a schema that predates BAC-8', async () => {
      await pool.query('CREATE SCHEMA IF NOT EXISTS "tenant_legacy"');

      await expect(
        repository.insert('tenant_legacy', {
          id: randomUUID(),
          actorUserId: null,
          action: 'create',
          resourceType: 'tenant',
          resourceId: 'tenant-legacy',
          before: null,
          after: { id: 'tenant-legacy' },
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await repository.insert('tenant_acme', {
        id: randomUUID(),
        actorUserId: 'user-1',
        action: 'create',
        resourceType: 'item',
        resourceId: '1',
        before: null,
        after: { id: 1, name: 'first' },
      });
      await repository.insert('tenant_acme', {
        id: randomUUID(),
        actorUserId: 'user-2',
        action: 'create',
        resourceType: 'tenant',
        resourceId: 'tenant-acme',
        before: null,
        after: { id: 'tenant-acme' },
      });
    });

    it('filters by actorUserId', async () => {
      const { items, total } = await repository.findAll(
        'tenant_acme',
        { actorUserId: 'user-1' },
        { page: 1, limit: 20 },
      );

      expect(total).toBe(1);
      expect(items).toHaveLength(1);
      expect(items[0].actorUserId).toBe('user-1');
    });

    it('filters by resourceType', async () => {
      const { items, total } = await repository.findAll(
        'tenant_acme',
        { resourceType: 'tenant' },
        { page: 1, limit: 20 },
      );

      expect(total).toBe(1);
      expect(items[0].resourceType).toBe('tenant');
    });

    it('filters by resourceId', async () => {
      const { items, total } = await repository.findAll(
        'tenant_acme',
        { resourceId: '1' },
        { page: 1, limit: 20 },
      );

      expect(total).toBe(1);
      expect(items[0].resourceId).toBe('1');
    });

    it('paginates results, most recent first', async () => {
      const page1 = await repository.findAll(
        'tenant_acme',
        {},
        { page: 1, limit: 1 },
      );
      const page2 = await repository.findAll(
        'tenant_acme',
        {},
        { page: 2, limit: 1 },
      );

      expect(page1.total).toBe(2);
      expect(page1.items).toHaveLength(1);
      expect(page2.items).toHaveLength(1);
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    });

    it('never returns rows from a different tenant schema', async () => {
      await provisioner.provision('tenant_other');
      await repository.insert('tenant_other', {
        id: randomUUID(),
        actorUserId: 'user-3',
        action: 'create',
        resourceType: 'item',
        resourceId: '99',
        before: null,
        after: { id: 99, name: 'other-tenant-item' },
      });

      const { items, total } = await repository.findAll(
        'tenant_acme',
        {},
        { page: 1, limit: 20 },
      );

      expect(total).toBe(2);
      expect(items.some((item) => item.resourceId === '99')).toBe(false);
    });
  });
});
