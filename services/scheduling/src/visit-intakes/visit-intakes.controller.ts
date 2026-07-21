import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { VisitIntakeSummary } from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import type { RequestWithAuth } from '../auth/request-with-auth.interface';
import { Audited } from '../audit-logs/audited.decorator';
import { VisitIntakesService } from './visit-intakes.service';
import { CreateVisitIntakeDto } from './dto/create-visit-intake.dto';
import { VisitIntakeQueryDto } from './dto/visit-intake-query.dto';
import { LinkVisitIntakeDto } from './dto/link-visit-intake.dto';

/**
 * Thin controller: validation via `CreateVisitIntakeDto`/
 * `VisitIntakeQueryDto`/`LinkVisitIntakeDto` (class-validator) + delegation
 * to `VisitIntakesService`. Guarded by `TenantGuard` -> `AccessTokenGuard` ->
 * `PermissionsGuard` on every route (BAC-45), same composition every other
 * resource in this service already established. The finer, INSTANCE-level
 * "who may read THIS intake" RBAC rule is enforced one layer down, in
 * `VisitIntakesService` (see `visit-intake-scope.util.ts`), since only the
 * service layer has both the caller's identity and the specific intake being
 * read.
 */
@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)
@Controller('visit-intakes')
export class VisitIntakesController {
  constructor(private readonly visitIntakesService: VisitIntakesService) {}

  /**
   * AC1: a logged-in patient submits their own intake ahead of a visit --
   * `patientId` is always the caller's own `userId` (self-scoped), never
   * taken from the request body. Creates a brand-new, pending-review record,
   * not yet linked to any booked appointment slot. Audited (PHI-adjacent
   * mutation, same convention as every other PHI-writing route in this
   * repo).
   */
  @Audited('VisitIntake')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CREATE_VISIT_INTAKE)
  async create(
    @Req() request: RequestWithAuth,
    @Body() dto: CreateVisitIntakeDto,
  ): Promise<VisitIntakeSummary> {
    const tenant = requireTenant(request);
    const user = requireUser(request);
    return this.visitIntakesService.create(
      tenant.id,
      tenant.schemaName,
      user,
      dto,
    );
  }

  /** AC2: the staff-facing pending-review triage queue (`?status=pending`), tenant-wide across every patient. */
  @Get()
  @RequirePermissions(Permission.READ_VISIT_INTAKE_QUEUE)
  async list(
    @Req() request: RequestWithAuth,
    @Query() query: VisitIntakeQueryDto,
  ): Promise<VisitIntakeSummary[]> {
    const tenant = requireTenant(request);
    return this.visitIntakesService.list(tenant.id, tenant.schemaName, query);
  }

  /**
   * AC3: reads a single intake. The submitting patient and every staff-side
   * role may always read it; a `provider` may read it ONLY if they are the
   * specific provider assigned to it (403 otherwise) -- enforced in
   * `VisitIntakesService.findById`.
   */
  @Get(':id')
  @RequirePermissions(Permission.READ_VISIT_INTAKE)
  async findById(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
  ): Promise<VisitIntakeSummary> {
    const tenant = requireTenant(request);
    const user = requireUser(request);
    return this.visitIntakesService.findById(
      tenant.id,
      tenant.schemaName,
      user,
      id,
    );
  }

  /**
   * AC3: staff associate a specific provider + the BAC-16/21 appointment
   * they just booked with a pending intake -- from this point on, ONLY that
   * provider may read it as a `provider` caller. Audited (mutation).
   */
  @Audited('VisitIntake')
  @Patch(':id/link')
  @RequirePermissions(Permission.LINK_VISIT_INTAKE)
  async link(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: LinkVisitIntakeDto,
  ): Promise<VisitIntakeSummary> {
    const tenant = requireTenant(request);
    return this.visitIntakesService.link(tenant.id, tenant.schemaName, id, dto);
  }
}

/** `TenantGuard` always runs before the handler and always sets `request.tenant` on success (or throws). */
function requireTenant(
  request: RequestWithAuth,
): NonNullable<RequestWithAuth['tenant']> {
  if (!request.tenant) {
    throw new Error(
      'request.tenant was not set -- protect this route with TenantGuard.',
    );
  }
  return request.tenant;
}

/** `AccessTokenGuard` always runs before the handler and always sets `request.user` on success (or throws). */
function requireUser(
  request: RequestWithAuth,
): NonNullable<RequestWithAuth['user']> {
  if (!request.user) {
    throw new Error(
      'request.user was not set -- protect this route with AccessTokenGuard.',
    );
  }
  return request.user;
}
