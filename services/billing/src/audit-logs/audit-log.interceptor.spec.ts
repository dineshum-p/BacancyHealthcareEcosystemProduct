import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLogsService } from './audit-logs.service';
import { AuditedMetadata } from './audited.decorator';
import { RequestWithAuth } from '../auth/request-with-auth.interface';
import { TenantStatus } from '../tenants/tenant-status.enum';

function makeContext(
  request: Partial<RequestWithAuth>,
  metadata: AuditedMetadata | undefined,
): { context: ExecutionContext; reflectorGet: jest.Mock } {
  const reflectorGet = jest.fn().mockReturnValue(metadata);
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getType: () => 'http',
  } as unknown as ExecutionContext;
  return { context, reflectorGet };
}

function makeHandler(returnValue: unknown): CallHandler {
  return { handle: () => of(returnValue) };
}

const tenant = {
  id: 'tenant-1',
  slug: 'acme',
  name: 'Acme',
  plan: 'starter',
  status: TenantStatus.ACTIVE,
  schemaName: 'tenant_acme',
  ownerEmail: 'owner@example.com',
};

describe('AuditLogInterceptor', () => {
  let auditLogsService: jest.Mocked<AuditLogsService>;
  let reflector: jest.Mocked<Reflector>;
  let interceptor: AuditLogInterceptor;

  beforeEach(() => {
    auditLogsService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogsService>;
    reflector = { get: jest.fn() } as unknown as jest.Mocked<Reflector>;
    interceptor = new AuditLogInterceptor(reflector, auditLogsService);
  });

  it('passes the request through untouched when no @Audited metadata is present', async () => {
    const { context } = makeContext({ method: 'GET' }, undefined);
    reflector.get.mockReturnValue(undefined);
    const handler = makeHandler({ id: '1' });

    const result = await firstValueFrom(
      interceptor.intercept(context, handler),
    );

    expect(result).toEqual({ id: '1' });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(auditLogsService.record).not.toHaveBeenCalled();
  });

  it('records a create with before=null, after=<usage event response>, actorUserId from request.user (BAC-11, AC1)', async () => {
    const metadata: AuditedMetadata = {
      resourceType: 'UsageEvent',
      options: {},
    };
    const { context } = makeContext(
      {
        method: 'POST',
        tenant,
        user: { userId: 'user-1', tenantId: 'tenant-1', role: 'provider' },
      },
      metadata,
    );
    reflector.get.mockReturnValue(metadata);
    const after = {
      id: 'record-1',
      eventId: 'evt-1',
      metric: 'patient.created',
    };
    const handler = makeHandler(after);

    const result = await firstValueFrom(
      interceptor.intercept(context, handler),
    );

    expect(result).toBe(after);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(auditLogsService.record).toHaveBeenCalledWith('tenant_acme', {
      actorUserId: 'user-1',
      action: 'create',
      resourceType: 'UsageEvent',
      resourceId: 'record-1',
      before: null,
      after,
    });
  });

  it('throws (failing the request) when no tenant schema can be resolved for the audit entry', async () => {
    const metadata: AuditedMetadata = {
      resourceType: 'UsageEvent',
      options: {},
    };
    const { context } = makeContext({ method: 'POST' }, metadata);
    reflector.get.mockReturnValue(metadata);
    const handler = makeHandler({ id: 'record-1' });

    await expect(
      firstValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toThrow();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(auditLogsService.record).not.toHaveBeenCalled();
  });

  it('fails the request when the audit write itself fails', async () => {
    const metadata: AuditedMetadata = {
      resourceType: 'UsageEvent',
      options: {},
    };
    const { context } = makeContext({ method: 'POST', tenant }, metadata);
    reflector.get.mockReturnValue(metadata);
    auditLogsService.record.mockRejectedValue(new Error('db down'));
    const handler = makeHandler({ id: 'record-1' });

    await expect(
      firstValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toThrow('db down');
  });

  it('does nothing for non-HTTP execution contexts', async () => {
    const context = {
      getType: () => 'rpc',
    } as unknown as ExecutionContext;
    const handler = makeHandler({ id: 1 });

    const result = await firstValueFrom(
      interceptor.intercept(context, handler),
    );

    expect(result).toEqual({ id: 1 });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(auditLogsService.record).not.toHaveBeenCalled();
  });
});
