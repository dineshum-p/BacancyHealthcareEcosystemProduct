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
import type { AppointmentSummary } from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';
import type { RequestWithAuth } from '../auth/request-with-auth.interface';
import { Audited } from '../audit-logs/audited.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

/**
 * Thin controller: validation via `CreateAppointmentDto`/
 * `AppointmentQueryDto`/`UpdateAppointmentDto` (class-validator) +
 * delegation to `AppointmentsService`. Guarded by `TenantGuard` ->
 * `AccessTokenGuard` -> `PermissionsGuard` on every route (BAC-16): every
 * appointment access is tenant-scoped AND requires a valid JWT with the
 * appropriate ROLE-level RBAC permission -- the same guard composition
 * every other service in this repo already established. The finer,
 * INSTANCE-level "whose calendar" RBAC rule this ticket also requires is
 * enforced one layer down, in `AppointmentsService` (see
 * `provider-scope.util.ts`), since only the service layer has both the
 * caller's identity and the specific provider/appointment being acted on.
 */
@UseGuards(TenantGuard, AccessTokenGuard, PermissionsGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /**
   * AC1: books a slot for a patient with a single provider and returns 201;
   * 409 if the slot overlaps an existing booked appointment for that
   * provider. Audited (BAC-8's mechanism) since this is a mutation; also
   * triggers a confirmation notification (`AppointmentsService.create`).
   */
  @Audited('Appointment')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MANAGE_APPOINTMENTS)
  async create(
    @Req() request: RequestWithAuth,
    @Body() dto: CreateAppointmentDto,
  ): Promise<AppointmentSummary> {
    const tenant = requireTenant(request);
    const user = requireUser(request);
    return this.appointmentsService.create(
      tenant.id,
      tenant.schemaName,
      user,
      dto,
    );
  }

  /** AC2: tenant-scoped, RBAC-scoped day schedule for a single provider. */
  @Get()
  @RequirePermissions(Permission.READ_APPOINTMENTS)
  async findDaySchedule(
    @Req() request: RequestWithAuth,
    @Query() query: AppointmentQueryDto,
  ): Promise<AppointmentSummary[]> {
    const tenant = requireTenant(request);
    const user = requireUser(request);
    return this.appointmentsService.findDaySchedule(
      tenant.id,
      tenant.schemaName,
      user,
      query,
    );
  }

  /** AC3: reschedule or cancel, with status transitions recorded (audited). */
  @Audited('Appointment')
  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_APPOINTMENTS)
  async update(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ): Promise<AppointmentSummary> {
    const tenant = requireTenant(request);
    const user = requireUser(request);
    return this.appointmentsService.update(
      tenant.id,
      tenant.schemaName,
      user,
      id,
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
