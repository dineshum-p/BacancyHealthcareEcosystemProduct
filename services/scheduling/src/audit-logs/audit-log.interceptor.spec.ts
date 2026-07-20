import { of, lastValueFrom } from 'rxjs';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLogsService } from './audit-logs.service';
import { Audited } from './audited.decorator';
import { TenantStatus } from '../tenants/tenant-status.enum';

class FakeController {
  @Audited('Appointment')
  create(): void {}

  @Audited('Appointment', {
    resolveBefore: () => ({ snapshot: true }),
  })
  update(): void {}

  read(): void {}
}

function makeContext(
  handlerName: keyof FakeController,
  request: Record<string, unknown>,
  type: 'http' | 'rpc' = 'http',
): ExecutionContext {
  const instance = new FakeController();
  return {
    getType: () => type,
    getHandler: () => instance[handlerName],
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuditLogInterceptor', () => {
  it('passes through non-http contexts untouched', async () => {
    const record = jest.fn();
    const interceptor = new AuditLogInterceptor(new Reflector(), {
      record,
    } as unknown as AuditLogsService);
    const context = makeContext('create', {}, 'rpc');
    const next = { handle: () => of('result') };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toBe('result');
    expect(record).not.toHaveBeenCalled();
  });

  it('passes through a route with no @Audited metadata untouched', async () => {
    const record = jest.fn();
    const interceptor = new AuditLogInterceptor(new Reflector(), {
      record,
    } as unknown as AuditLogsService);
    const context = makeContext('read', { method: 'GET' });
    const next = { handle: () => of('result') };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toBe('result');
    expect(record).not.toHaveBeenCalled();
  });

  it('records an audit entry for an audited mutation and passes the response through', async () => {
    const record = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditLogInterceptor(new Reflector(), {
      record,
    } as unknown as AuditLogsService);
    const request = {
      method: 'POST',
      user: { userId: 'user-1' },
      tenant: {
        id: 't1',
        schemaName: 'acme',
        slug: 'acme',
        status: TenantStatus.ACTIVE,
        name: 'Acme',
        plan: 'starter',
        ownerEmail: null,
      },
    };
    const context = makeContext('create', request);
    const next = { handle: () => of({ id: 'appt-1', status: 'booked' }) };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({ id: 'appt-1', status: 'booked' });
    expect(record).toHaveBeenCalledWith('acme', {
      actorUserId: 'user-1',
      action: 'create',
      resourceType: 'Appointment',
      resourceId: 'appt-1',
      before: null,
      after: { id: 'appt-1', status: 'booked' },
    });
  });

  it('resolves a before snapshot when the decorator supplies resolveBefore', async () => {
    const record = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditLogInterceptor(new Reflector(), {
      record,
    } as unknown as AuditLogsService);
    const request = {
      method: 'PATCH',
      user: undefined,
      tenant: {
        id: 't1',
        schemaName: 'acme',
        slug: 'acme',
        status: TenantStatus.ACTIVE,
        name: 'Acme',
        plan: 'starter',
        ownerEmail: null,
      },
    };
    const context = makeContext('update', request);
    const next = { handle: () => of({ id: 'appt-1' }) };

    await lastValueFrom(interceptor.intercept(context, next));

    expect(record).toHaveBeenCalledWith('acme', {
      actorUserId: null,
      action: 'update',
      resourceType: 'Appointment',
      resourceId: 'appt-1',
      before: { snapshot: true },
      after: { id: 'appt-1' },
    });
  });

  it('throws when no tenant is resolvable for the audit entry', async () => {
    const record = jest.fn();
    const interceptor = new AuditLogInterceptor(new Reflector(), {
      record,
    } as unknown as AuditLogsService);
    const request = { method: 'POST' };
    const context = makeContext('create', request);
    const next = { handle: () => of({ id: 'appt-1' }) };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toThrow(/tenant schema/);
  });
});
