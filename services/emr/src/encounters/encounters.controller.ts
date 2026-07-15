import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { EncounterSummary } from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { Audited } from '../audit-logs/audited.decorator';
import { EncountersService } from './encounters.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';

/**
 * Thin controller: validation via `CreateEncounterDto` (class-validator,
 * AC1/AC3) + delegation to `EncountersService`. Guarded by `TenantGuard` ->
 * `AccessTokenGuard` -> `PermissionsGuard` on both routes (BAC-15): every
 * encounter access is tenant-scoped AND requires a valid JWT with the
 * appropriate RBAC permission -- the same guard composition
 * `services/patient`'s BAC-14 `PatientsController` and this service's own
 * BAC-10 `PatientsController` already established.
 *
 * `:patientId` is validated as a well-formed UUID (`ParseUUIDPipe`), and
 * `EncountersService.create` additionally looks it up in THIS SAME tenant
 * schema's `patients` table (`services/emr`'s own BAC-10 `PatientsRepository`,
 * already provisioned in the same schema as `encounters` -- no new module or
 * cross-service call needed) before persisting, 404ing if it doesn't
 * resolve there.
 *
 * IMPORTANT scope limit: this is a SAME-SERVICE check only. It does NOT
 * call out to `services/patient` (BAC-14's canonical patient-registration
 * service) and does NOT validate against that service's registry. A patient
 * registered via `services/patient` (BAC-14) is a logically separate record
 * from anything in `services/emr`'s own `patients` table (BAC-10's FHIR
 * gateway) -- the two are not reconciled, and a `patientId` that is valid in
 * one may not exist in the other. Closing that cross-service reconciliation
 * gap (e.g. via the `services/tenant`-style `HttpAuthServiceClient`/
 * `HttpNotificationServiceClient` internal-call pattern, which would require
 * a new lookup endpoint on `services/patient`) is explicitly out of scope
 * for this fix and left to a future ticket.
 */
@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)
@Controller('patients/:patientId/encounters')
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  /**
   * AC1: saves a structured SOAP note plus vitals and an allergy list for
   * the patient, and returns 201 with the created encounter. Audited
   * (BAC-8's mechanism, reused per this service's `PatientsController`
   * pattern) since this is a mutation. AC4:
   * `EncountersService.create` publishes `encounter.created` after
   * persisting.
   */
  @Audited('Encounter')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.WRITE_ENCOUNTER)
  async create(
    @Req() request: RequestWithTenant,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateEncounterDto,
  ): Promise<EncounterSummary> {
    const tenant = requireTenant(request);
    return this.encountersService.create(
      tenant.id,
      tenant.schemaName,
      patientId,
      dto,
    );
  }

  /** AC2: the patient's encounter history, most recent first. */
  @Get()
  @RequirePermissions(Permission.READ_ENCOUNTER)
  async findByPatient(
    @Req() request: RequestWithTenant,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ): Promise<EncounterSummary[]> {
    const tenant = requireTenant(request);
    return this.encountersService.findByPatient(
      tenant.id,
      tenant.schemaName,
      patientId,
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
