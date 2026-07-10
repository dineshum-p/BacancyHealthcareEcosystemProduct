import { AuditLogsService } from './audit-logs.service';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLogEntry } from './audit-log.entity';

describe('AuditLogsService', () => {
  let repository: jest.Mocked<AuditLogsRepository>;
  let service: AuditLogsService;

  beforeEach(() => {
    repository = {
      insert: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<AuditLogsRepository>;
    service = new AuditLogsService(repository);
  });

  describe('record', () => {
    it('delegates to the repository with a generated id', async () => {
      await service.record('tenant_acme', {
        actorUserId: 'user-1',
        action: 'create',
        resourceType: 'item',
        resourceId: '1',
        before: null,
        after: { id: 1, name: 'widget' },
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.insert).toHaveBeenCalledWith(
        'tenant_acme',
        expect.objectContaining({
          actorUserId: 'user-1',
          action: 'create',
          resourceType: 'item',
          resourceId: '1',
          before: null,
          after: { id: 1, name: 'widget' },
        }),
      );
      const [, entry] = repository.insert.mock.calls[0];
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
    });
  });

  describe('list', () => {
    it('applies default pagination (page 1, limit 20) and maps entries to the response shape', async () => {
      const entry: AuditLogEntry = {
        id: 'log-1',
        actorUserId: 'user-1',
        action: 'create',
        resourceType: 'item',
        resourceId: '1',
        before: null,
        after: { id: 1 },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      repository.findAll.mockResolvedValue({ items: [entry], total: 1 });

      const result = await service.list('tenant_acme', {});

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.findAll).toHaveBeenCalledWith(
        'tenant_acme',
        {},
        { page: 1, limit: 20 },
      );
      expect(result).toEqual({
        items: [
          {
            id: 'log-1',
            actorUserId: 'user-1',
            action: 'create',
            resourceType: 'item',
            resourceId: '1',
            before: null,
            after: { id: 1 },
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
      });
    });

    it('passes actor/resourceType/resourceId filters and explicit pagination through', async () => {
      repository.findAll.mockResolvedValue({ items: [], total: 0 });

      await service.list('tenant_acme', {
        actor: 'user-2',
        resourceType: 'tenant',
        resourceId: 'tenant-1',
        page: 3,
        limit: 5,
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.findAll).toHaveBeenCalledWith(
        'tenant_acme',
        {
          actorUserId: 'user-2',
          resourceType: 'tenant',
          resourceId: 'tenant-1',
        },
        { page: 3, limit: 5 },
      );
    });
  });
});
