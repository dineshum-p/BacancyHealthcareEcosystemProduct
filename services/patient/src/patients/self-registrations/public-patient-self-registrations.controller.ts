import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { SelfRegistrationReceipt } from '@hep/shared-types';
import { TenantGuard } from '../../tenant-context/tenant.guard';
import type { RequestWithTenant } from '../../tenant-context/request-with-tenant.interface';
import { Audited } from '../../audit-logs/audited.decorator';
import { PatientSelfRegistrationsService } from './patient-self-registrations.service';
import { SelfRegisterPatientDto } from './dto/self-register-patient.dto';

/**
 * The PUBLIC, unauthenticated entry point for BAC-36's patient
 * self-registration: `POST /public/tenants/:tenantSlug/patients`.
 * Deliberately guarded ONLY by `TenantGuard` (tenant scoping, resolved from
 * the `:tenantSlug` route param -- see `resolveTenantIdentifier`'s doc
 * comment) and `ThrottlerGuard` (BAC-36's rate-limiting AC) -- NOT
 * `AccessTokenGuard`/`PermissionsGuard`: a patient submitting their own
 * registration online has no session/JWT at all, by design. Still audited
 * (`@Audited`, same global mechanism BAC-14's `POST /patients` uses) --
 * `AuditLogInterceptor` records `actorUserId: null` for this route (no
 * `request.user` was ever set), which is the correct representation of an
 * anonymous, self-submitted action.
 */
@UseGuards(TenantGuard, ThrottlerGuard)
@Controller('public/tenants/:tenantSlug/patients')
export class PublicPatientSelfRegistrationsController {
  constructor(
    private readonly selfRegistrationsService: PatientSelfRegistrationsService,
  ) {}

  @Audited('PatientSelfRegistration')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Req() request: RequestWithTenant,
    @Body() dto: SelfRegisterPatientDto,
  ): Promise<SelfRegistrationReceipt> {
    const tenant = requireTenant(request);
    return this.selfRegistrationsService.register(
      tenant.id,
      tenant.schemaName,
      dto,
    );
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
