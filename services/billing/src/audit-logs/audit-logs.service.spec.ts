import { AuditLogsService } from './audit-logs.service';
import { AuditLogsRepository } from './audit-logs.repository';

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
        resourceType: 'UsageEvent',
        resourceId: 'evt-1',
        before: null,
        after: { eventId: 'evt-1' },
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.insert).toHaveBeenCalledWith(
        'tenant_acme',
        expect.objectContaining({
          actorUserId: 'user-1',
          action: 'create',
          resourceType: 'UsageEvent',
          resourceId: 'evt-1',
          before: null,
          after: { eventId: 'evt-1' },
        }),
      );
      const [, entry] = repository.insert.mock.calls[0];
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
    });
  });
});
