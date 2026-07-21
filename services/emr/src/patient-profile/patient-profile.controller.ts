import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  AccessTokenPayload,
  PatientProfileResponse,
} from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import type { RequestWithAuth } from '../auth/request-with-auth.interface';
import { Audited } from '../audit-logs/audited.decorator';
import { PatientProfileService } from './patient-profile.service';
import { UpsertPatientProfileDto } from './dto/upsert-patient-profile.dto';

/**
 * Thin controller: validation via `UpsertPatientProfileDto` (class-validator)
 * + delegation to `PatientProfileService`. Guarded by `TenantGuard` ->
 * `AccessTokenGuard` -> `PermissionsGuard` on both routes, same composition
 * every other EMR resource in this service already uses. Row-level
 * ownership scoping (a `patient` caller may only ever reach their OWN
 * `:patientId`) is enforced inside `PatientProfileService`
 * (`assertPatientScope`), NOT here -- see that service's doc comment.
 */
@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)
@Controller('patients/:patientId/profile')
export class PatientProfileController {
  constructor(private readonly patientProfileService: PatientProfileService) {}

  /**
   * BAC-44: returns the patient's baseline profile (allergies/chronic
   * conditions/long-term medications, plus read-only demographics), or the
   * well-formed `hasProfile: false` empty shape if none has ever been saved
   * -- never a 404.
   */
  @Get()
  @RequirePermissions(Permission.READ_PATIENT_PROFILE)
  async get(
    @Req() request: RequestWithAuth,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ): Promise<PatientProfileResponse> {
    const tenant = requireTenant(request);
    const user = requireUser(request);
    return this.patientProfileService.getProfile(
      tenant.id,
      tenant.schemaName,
      patientId,
      user,
    );
  }

  /**
   * BAC-44: upsert semantics -- creates the baseline profile if none exists
   * for this patient yet, or edits the existing one in place otherwise
   * (never versioned/append-only).
   */
  @Audited('PatientProfile')
  @Put()
  @RequirePermissions(Permission.WRITE_PATIENT_PROFILE)
  async upsert(
    @Req() request: RequestWithAuth,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: UpsertPatientProfileDto,
  ): Promise<PatientProfileResponse> {
    const tenant = requireTenant(request);
    const user = requireUser(request);
    return this.patientProfileService.upsertProfile(
      tenant.id,
      tenant.schemaName,
      patientId,
      user,
      dto,
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

/** `AccessTokenGuard` always runs before the handler and always sets `request.user` on success (or throws). */
function requireUser(request: RequestWithAuth): AccessTokenPayload {
  if (!request.user) {
    throw new Error(
      'request.user was not set -- protect this route with AccessTokenGuard.',
    );
  }
  return request.user;
}
