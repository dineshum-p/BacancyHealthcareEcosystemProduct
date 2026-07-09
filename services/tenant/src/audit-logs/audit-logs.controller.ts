import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { RequestWithAuth } from '../auth/request-with-auth.interface';
import { AuditLogsRoleGuard } from './audit-logs-role.guard';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { PaginatedAuditLogsDto } from './dto/audit-log-response.dto';

/**
 * `GET /audit-logs` (BAC-8, AC3/AC7): paginated, tenant-scoped, filterable by
 * `actor` (userId) and `resourceType`/`resourceId`.
 *
 * Guard order matters (mirrors BAC-7's `PermissionsGuard` discipline):
 *   1. `TenantGuard` resolves `request.tenant` from `X-Tenant-Id` (404/403
 *      for an unknown/inactive tenant).
 *   2. `AccessTokenGuard` verifies the Bearer token and cross-checks its
 *      `tenantId` claim against `request.tenant` (401 if missing/invalid/
 *      cross-tenant).
 *   3. `AuditLogsRoleGuard` requires `super_admin`/`clinic_admin` (403
 *      otherwise).
 *
 * Thin controller: reads the already-resolved tenant off the request and
 * delegates to `AuditLogsService`; all query-shape validation lives in
 * `AuditLogQueryDto`.
 */
@UseGuards(TenantGuard, AccessTokenGuard, AuditLogsRoleGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  async list(
    @Req() request: RequestWithAuth,
    @Query() query: AuditLogQueryDto,
  ): Promise<PaginatedAuditLogsDto> {
    if (!request.tenant) {
      throw new Error(
        'Tenant context was requested before TenantGuard resolved a tenant. Protect this route with TenantGuard.',
      );
    }
    return this.auditLogsService.list(request.tenant.schemaName, query);
  }
}
