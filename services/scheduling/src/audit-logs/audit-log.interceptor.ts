import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { AuditLogsService } from './audit-logs.service';
import { AUDITED_METADATA_KEY, AuditedMetadata } from './audited.decorator';
import {
  extractResourceId,
  resolveAuditAction,
  resolveAuditTarget,
} from './audit-target.util';
import { RequestWithAuth } from '../auth/request-with-auth.interface';

/**
 * Generic, resource-agnostic audit-logging mechanism, reusing
 * `services/tenant`'s BAC-8 `AuditLogInterceptor` mechanism: registered ONCE
 * as a global interceptor (`APP_INTERCEPTOR` in `AuditLogsModule`) and
 * activated per-route by `@Audited(resourceType)` -- here,
 * `@Audited('Appointment')` on `AppointmentsController.create()`/
 * `.update()`.
 *
 * Duplicated (not literally imported) rather than a shared `@hep/*`
 * package: every other service's copy is wired to ITS OWN
 * `SchemaProvisioner`/`RequestWithAuth`/`AuditLogsService`, none of which
 * this independently deployable service can import as TypeScript -- exactly
 * the same reasoning `TenantGuard`/`AccessTokenGuard` are duplicated
 * per-service throughout this repo. This is BAC-16's documented answer to
 * CLAUDE.md's "write an audit log entry per BAC-8's existing pattern"
 * instruction: the MECHANISM (interceptor + decorator + append-only
 * repository, with the exact same DDL and behavioural contract) is reused
 * verbatim; only the wiring (this service's own schema provisioner/
 * tenant-context types) is service-local.
 *
 * Fails the whole request if an audit entry cannot be persisted: a mutation
 * whose audit trail failed to write is treated the same as a mutation that
 * failed outright.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const metadata = this.reflector.get<AuditedMetadata | undefined>(
      AUDITED_METADATA_KEY,
      context.getHandler(),
    );
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const action = resolveAuditAction(request.method);

    return from(this.resolveBefore(metadata, request)).pipe(
      concatMap((before) =>
        next
          .handle()
          .pipe(
            concatMap((after) =>
              from(this.persist(metadata, request, action, before, after)).pipe(
                concatMap(() => from(Promise.resolve(after))),
              ),
            ),
          ),
      ),
    );
  }

  private resolveBefore(
    metadata: AuditedMetadata,
    request: RequestWithAuth,
  ): Promise<unknown> {
    if (!metadata.options.resolveBefore) {
      return Promise.resolve(null);
    }
    return Promise.resolve(metadata.options.resolveBefore(request));
  }

  private async persist(
    metadata: AuditedMetadata,
    request: RequestWithAuth,
    action: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    const target = resolveAuditTarget(request);
    if (!target) {
      throw new Error(
        `Unable to resolve a tenant schema for the audit entry (resourceType="${metadata.resourceType}"). ` +
          'This route must be protected by TenantGuard.',
      );
    }

    await this.auditLogsService.record(target.schemaName, {
      actorUserId: request.user?.userId ?? null,
      action,
      resourceType: metadata.resourceType,
      resourceId: extractResourceId(after, request),
      before: before ?? null,
      after,
    });
  }
}
