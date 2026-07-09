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
 * Generic, resource-agnostic audit-logging mechanism (BAC-8, AC1/AC3):
 * registered ONCE as a global interceptor (`APP_INTERCEPTOR` in
 * `AuditLogsModule`) and activated per-route by `@Audited(resourceType)`.
 * Works uniformly for POST/PUT/PATCH/DELETE -- the semantic action is
 * derived from `request.method` (`resolveAuditAction`), never hardcoded to
 * "only POST" -- even though today only `TenantsController.create()` and
 * `ItemsController.create()` (both POST) carry the decorator.
 *
 * Fails the whole request if an audit entry cannot be persisted (AC1 is a
 * hard guarantee, not best-effort): a mutation whose audit trail failed to
 * write is treated the same as a mutation that failed outright. This is a
 * deliberate scope/safety trade-off, documented here rather than silently
 * swallowing audit-write errors.
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
    const target = resolveAuditTarget(request, after);
    if (!target) {
      throw new Error(
        `Unable to resolve a tenant schema for the audit entry (resourceType="${metadata.resourceType}"). ` +
          'Neither request.tenant nor the mutated resource carried a schemaName.',
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
