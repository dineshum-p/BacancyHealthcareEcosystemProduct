import { AuditLogsService } from './audit-logs.service';
import { AuditLogsRepository } from './audit-logs.repository';

describe('AuditLogsService', () => {
  it('records an entry with a generated id, delegating to the repository', async () => {
    const insert = jest.fn().mockResolvedValue(undefined);
    const repository = { insert } as unknown as AuditLogsRepository;
    const service = new AuditLogsService(repository);

    await service.record('acme', {
      actorUserId: 'user-1',
      action: 'create',
      resourceType: 'Patient',
      resourceId: 'patient-1',
      before: null,
      after: { id: 'patient-1' },
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const [schemaName, entry] = insert.mock.calls[0] as [
      string,
      { id: string },
    ];
    expect(schemaName).toBe('acme');
    expect(entry.id).toEqual(expect.any(String));
    expect(entry).toMatchObject({
      actorUserId: 'user-1',
      action: 'create',
      resourceType: 'Patient',
      resourceId: 'patient-1',
      before: null,
      after: { id: 'patient-1' },
    });
  });
});
