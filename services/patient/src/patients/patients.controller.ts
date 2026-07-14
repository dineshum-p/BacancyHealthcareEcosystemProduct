import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  PaginatedPatientsResponse,
  PatientSummary,
} from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { Audited } from '../audit-logs/audited.decorator';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientSearchQueryDto } from './dto/patient-search-query.dto';

/**
 * Thin controller: validation via `CreatePatientDto`/`PatientSearchQueryDto`
 * (class-validator) + delegation to `PatientsService`. Guarded by
 * `TenantGuard` -> `AccessTokenGuard` -> `PermissionsGuard` on both routes
 * (BAC-14, AC1/AC3): every patient access is tenant-scoped AND requires a
 * valid JWT with the appropriate RBAC permission, reusing BAC-4's
 * tenant-context mechanism and BAC-7's `PermissionsGuard`/
 * `@RequirePermissions` mechanism rather than reimplementing either -- the
 * same guard composition `services/emr`'s BAC-10 `PatientsController` and
 * `services/billing`'s BAC-11 `UsageController` already established.
 */
@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  /**
   * AC1: registers a patient, assigns a tenant-unique sequential MRN, and
   * returns 201 with the created patient. Audited (BAC-8's mechanism,
   * reused per CLAUDE.md's "write an audit log entry per BAC-8's existing
   * pattern") since this is a mutation. AC4: `PatientsService.create`
   * publishes `patient.created` after persisting.
   */
  @Audited('Patient')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.WRITE_PATIENT)
  async create(
    @Req() request: RequestWithTenant,
    @Body() dto: CreatePatientDto,
  ): Promise<PatientSummary> {
    const tenant = requireTenant(request);
    return this.patientsService.create(tenant.id, tenant.schemaName, dto);
  }

  /** AC3: tenant-scoped, paginated search by name/MRN/date of birth. */
  @Get()
  @RequirePermissions(Permission.READ_PATIENT)
  async search(
    @Req() request: RequestWithTenant,
    @Query() query: PatientSearchQueryDto,
  ): Promise<PaginatedPatientsResponse> {
    const tenant = requireTenant(request);
    return this.patientsService.search(tenant.id, tenant.schemaName, query);
  }
}

/** `TenantGuard` always runs before the handler and always sets `request.tenant` on success (or throws). */
function requireTenant(
  request: RequestWithTenant,
): NonNullable<RequestWithTenant['tenant']> {
  if (!request.tenant) {
    throw new Error(
      'request.tenant was not set -- protect this route with TenantGuard.',
    );
  }
  return request.tenant;
}
