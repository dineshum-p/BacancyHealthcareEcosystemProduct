import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { RequestWithAuth } from '../auth/request-with-auth.interface';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { PaginatedAuditLogsDto } from './dto/audit-log-response.dto';

describe('AuditLogsController', () => {
  let service: jest.Mocked<AuditLogsService>;
  let controller: AuditLogsController;

  const tenant = {
    id: 'tenant-1',
    slug: 'acme',
    name: 'Acme',
    plan: 'starter',
    status: TenantStatus.ACTIVE,
    schemaName: 'tenant_acme',
    ownerEmail: 'owner@example.com',
  };

  beforeEach(() => {
    service = {
      record: jest.fn(),
      list: jest.fn(),
    } as unknown as jest.Mocked<AuditLogsService>;
    controller = new AuditLogsController(service);
  });

  it('delegates listing to the service, scoped to the resolved tenant schema', async () => {
    const request = { tenant } as unknown as RequestWithAuth;
    const query: AuditLogQueryDto = { page: 1, limit: 20 };
    const page: PaginatedAuditLogsDto = {
      items: [],
      page: 1,
      limit: 20,
      total: 0,
    };
    service.list.mockResolvedValue(page);

    await expect(controller.list(request, query)).resolves.toBe(page);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(service.list).toHaveBeenCalledWith('tenant_acme', query);
  });

  it('throws if request.tenant is missing (must be protected by TenantGuard)', async () => {
    const request = {} as unknown as RequestWithAuth;
    const query: AuditLogQueryDto = { page: 1, limit: 20 };

    await expect(controller.list(request, query)).rejects.toThrow();
  });
});
