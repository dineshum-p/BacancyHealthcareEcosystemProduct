import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { PatientSelfRegistrationSummary } from '@hep/shared-types';
import { TenantGuard } from '../../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../../auth/access-token.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permission.enum';
import type { RequestWithAuth } from '../../auth/request-with-auth.interface';
import { Audited } from '../../audit-logs/audited.decorator';
import { PatientSelfRegistrationsService } from './patient-self-registrations.service';
import { ListSelfRegistrationsQueryDto } from './dto/list-self-registrations-query.dto';
import { RejectSelfRegistrationDto } from './dto/reject-self-registration.dto';
import { MergeSelfRegistrationDto } from './dto/merge-self-registration.dto';

/**
 * Staff-facing review queue for BAC-36's patient self-registrations:
 * `GET /patients/self-registrations` (the pending queue, filterable by
 * `?status=`) and the approve/reject/merge review actions. Every route here
 * requires the SAME `TenantGuard` -> `AccessTokenGuard` -> `PermissionsGuard`
 * composition BAC-14's `PatientsController` uses, gated by the narrow
 * `REVIEW_SELF_REGISTRATION` permission (BAC-36) rather than `WRITE_PATIENT`
 * -- see `role-permissions.map.ts`'s doc comment for why `staff` is granted
 * this permission specifically, not general `WRITE_PATIENT`.
 */
@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)
@Controller('patients/self-registrations')
export class PatientSelfRegistrationsController {
  constructor(
    private readonly selfRegistrationsService: PatientSelfRegistrationsService,
  ) {}

  /** The pending-review queue (or any other single lifecycle state via `?status=`). */
  @Get()
  @RequirePermissions(Permission.REVIEW_SELF_REGISTRATION)
  async list(
    @Req() request: RequestWithAuth,
    @Query() query: ListSelfRegistrationsQueryDto,
  ): Promise<PatientSelfRegistrationSummary[]> {
    const tenant = requireTenant(request);
    return this.selfRegistrationsService.list(
      tenant.id,
      tenant.schemaName,
      query.status,
    );
  }

  /** Confirms a self-registration as a genuinely new patient (creates a real, searchable `patients` row with an MRN). */
  @Audited('PatientSelfRegistration')
  @Post(':id/approve')
  @RequirePermissions(Permission.REVIEW_SELF_REGISTRATION)
  async approve(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
  ): Promise<PatientSelfRegistrationSummary> {
    const tenant = requireTenant(request);
    return this.selfRegistrationsService.approve(
      tenant.id,
      tenant.schemaName,
      id,
      request.user?.userId ?? null,
    );
  }

  /** Determines the submission is not legitimate; it never becomes a `patients` row. */
  @Audited('PatientSelfRegistration')
  @Post(':id/reject')
  @RequirePermissions(Permission.REVIEW_SELF_REGISTRATION)
  async reject(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: RejectSelfRegistrationDto,
  ): Promise<PatientSelfRegistrationSummary> {
    const tenant = requireTenant(request);
    return this.selfRegistrationsService.reject(
      tenant.id,
      tenant.schemaName,
      id,
      dto.reason,
      request.user?.userId ?? null,
    );
  }

  /** Links the submission to an existing patient instead of creating a new, disconnected record. */
  @Audited('PatientSelfRegistration')
  @Post(':id/merge')
  @RequirePermissions(Permission.REVIEW_SELF_REGISTRATION)
  async merge(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: MergeSelfRegistrationDto,
  ): Promise<PatientSelfRegistrationSummary> {
    const tenant = requireTenant(request);
    return this.selfRegistrationsService.merge(
      tenant.id,
      tenant.schemaName,
      id,
      dto.targetPatientId,
      request.user?.userId ?? null,
    );
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
