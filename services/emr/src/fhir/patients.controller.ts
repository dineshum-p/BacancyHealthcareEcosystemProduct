import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FhirPatientResource } from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { Audited } from '../audit-logs/audited.decorator';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';

/**
 * Thin controller: validation via `CreatePatientDto` (class-validator, AC2)
 * + delegation to `PatientsService`. Guarded by `TenantGuard` ->
 * `AccessTokenGuard` -> `PermissionsGuard` on both routes (BAC-10, AC4):
 * every FHIR access is tenant-scoped AND requires a valid JWT with the
 * appropriate RBAC permission, reusing BAC-4's tenant-context mechanism and
 * BAC-7's `PermissionsGuard`/`@RequirePermissions` mechanism rather than
 * reimplementing either.
 *
 * Malformed/non-R4-conformant payloads (AC3) never reach this controller as
 * a generic Nest error: `FhirExceptionFilter`, registered globally in
 * `main.ts`, translates the `BadRequestException` the global
 * `ValidationPipe` throws (and any other `HttpException`) into a FHIR
 * `OperationOutcome` response body.
 */
@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)
@Controller('fhir/Patient')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  /**
   * AC2: creates a FHIR R4 `Patient` resource and returns 201 with the
   * created resource (including its server-assigned `id`). Audited (BAC-8's
   * mechanism, reused -- see `audit-logs/` doc comments) since this is a
   * mutation.
   */
  @Audited('Patient')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.WRITE_PATIENT)
  async create(
    @Req() request: RequestWithTenant,
    @Body() dto: CreatePatientDto,
  ): Promise<FhirPatientResource> {
    return this.patientsService.createForSchema(getTenantSchema(request), dto);
  }

  /** AC1: returns the FHIR R4 Patient resource for `:id`, scoped to the resolved tenant. */
  @Get(':id')
  @RequirePermissions(Permission.READ_PATIENT)
  async findOne(
    @Req() request: RequestWithTenant,
    @Param('id') id: string,
  ): Promise<FhirPatientResource> {
    return this.patientsService.findByIdForSchema(getTenantSchema(request), id);
  }
}

/** `TenantGuard` always runs before the handler and always sets `request.tenant` on success (or throws). */
function getTenantSchema(request: RequestWithTenant): string {
  if (!request.tenant) {
    throw new Error(
      'request.tenant was not set -- protect this route with TenantGuard.',
    );
  }
  return request.tenant.schemaName;
}
