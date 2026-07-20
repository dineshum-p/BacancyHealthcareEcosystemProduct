import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { AccessTokenPayload, AppointmentSummary } from '@hep/shared-types';
import { AppointmentsRepository } from './appointments.repository';
import { AppointmentSchemaProvisioner } from './appointment-schema.provisioner';
import { AppointmentRecord } from './appointment.entity';
import { AppointmentStatus } from './appointment-status.enum';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import {
  assertProviderScope,
  resolveScopedProviderId,
} from './provider-scope.util';
import { NOTIFICATION_SERVICE_CLIENT } from '../notifications/clients/notification-service.client';
import type { NotificationServiceClient } from '../notifications/clients/notification-service.client';

/**
 * Core single-provider appointment-booking logic (BAC-16), deliberately
 * schema-explicit (see `AppointmentsRepository`'s doc comment) rather than
 * request-scoped, so it is testable independently of any HTTP request --
 * same convention `services/patient`'s `PatientsService` established.
 *
 * Enforces BOTH of this ticket's RBAC layers: the coarse, role-level check
 * (`PermissionsGuard`, in the controller) has already run by the time any
 * method here executes; the finer, instance-level "whose calendar" check
 * (`assertProviderScope`/`resolveScopedProviderId`) is enforced HERE, since
 * only the service layer has both the caller's identity (`AccessTokenPayload`)
 * and the specific appointment/provider being acted on.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly appointmentsRepository: AppointmentsRepository,
    private readonly schemaProvisioner: AppointmentSchemaProvisioner,
    @Inject(NOTIFICATION_SERVICE_CLIENT)
    private readonly notificationServiceClient: NotificationServiceClient,
  ) {}

  /**
   * AC1: books a slot for a patient with a single provider. Rejects a
   * double-booked slot with 409 (`ConflictException`) BEFORE insert.
   * Triggers a best-effort confirmation notification after a successful
   * booking (a `services/notification` outage never fails the booking
   * itself -- see `sendConfirmation`'s doc comment) and is `@Audited`
   * (BAC-8's mechanism) at the controller layer.
   */
  async create(
    tenantId: string,
    schemaName: string,
    user: AccessTokenPayload,
    dto: CreateAppointmentDto,
  ): Promise<AppointmentSummary> {
    assertProviderScope(user, dto.providerId);

    const startTime = parseIsoDateTime(dto.startTime, 'startTime');
    const endTime = parseIsoDateTime(dto.endTime, 'endTime');
    assertChronologicalOrder(startTime, endTime);

    await this.schemaProvisioner.ensureAppointmentsTable(schemaName);

    const conflict = await this.appointmentsRepository.hasConflict(
      schemaName,
      dto.providerId,
      startTime,
      endTime,
    );
    if (conflict) {
      throw new ConflictException(
        'This provider already has a booked appointment overlapping the requested slot.',
      );
    }

    const record = await this.appointmentsRepository.insert(schemaName, {
      providerId: dto.providerId,
      patientId: dto.patientId,
      startTime,
      endTime,
    });
    const summary = this.toSummary(tenantId, record);

    await this.sendConfirmation(
      tenantId,
      dto.notifyChannel,
      dto.notifyTo,
      summary,
    );

    return summary;
  }

  /**
   * AC2: tenant-scoped, RBAC-scoped day schedule for a single provider.
   * `resolveScopedProviderId` both enforces the RBAC rule and resolves
   * WHICH provider's calendar to query.
   */
  async findDaySchedule(
    tenantId: string,
    schemaName: string,
    user: AccessTokenPayload,
    query: AppointmentQueryDto,
  ): Promise<AppointmentSummary[]> {
    const providerId = resolveScopedProviderId(user, query.providerId);
    const { dayStart, dayEnd } = parseCalendarDayRange(query.date);

    await this.schemaProvisioner.ensureAppointmentsTable(schemaName);

    const records = await this.appointmentsRepository.findByProviderAndRange(
      schemaName,
      providerId,
      dayStart,
      dayEnd,
    );
    return records.map((record) => this.toSummary(tenantId, record));
  }

  /**
   * AC3: reschedules (new time range, still `booked`) or cancels
   * (`status: 'cancelled'`) an existing appointment, recording the status
   * transition via the returned summary (and, at the controller layer,
   * `@Audited`'s before/after audit entry).
   */
  async update(
    tenantId: string,
    schemaName: string,
    user: AccessTokenPayload,
    id: string,
    dto: UpdateAppointmentDto,
  ): Promise<AppointmentSummary> {
    await this.schemaProvisioner.ensureAppointmentsTable(schemaName);

    const existing = await this.appointmentsRepository.findById(schemaName, id);
    if (!existing) {
      throw new NotFoundException(`Appointment "${id}" was not found.`);
    }

    assertProviderScope(user, existing.providerId);

    if (existing.status === AppointmentStatus.CANCELLED) {
      throw new ConflictException(
        'This appointment has already been cancelled.',
      );
    }

    if (dto.action === 'cancel') {
      return this.cancel(tenantId, schemaName, id);
    }
    return this.reschedule(tenantId, schemaName, existing, id, dto);
  }

  private async cancel(
    tenantId: string,
    schemaName: string,
    id: string,
  ): Promise<AppointmentSummary> {
    const updated = await this.appointmentsRepository.cancel(schemaName, id);
    if (!updated) {
      // Lost a race with a concurrent cancel/reschedule between the
      // `findById` check above and this update.
      throw new ConflictException(
        'This appointment was modified concurrently; please retry.',
      );
    }
    return this.toSummary(tenantId, updated);
  }

  private async reschedule(
    tenantId: string,
    schemaName: string,
    existing: AppointmentRecord,
    id: string,
    dto: UpdateAppointmentDto,
  ): Promise<AppointmentSummary> {
    const startTime = parseIsoDateTime(dto.startTime, 'startTime');
    const endTime = parseIsoDateTime(dto.endTime, 'endTime');
    assertChronologicalOrder(startTime, endTime);

    const conflict = await this.appointmentsRepository.hasConflict(
      schemaName,
      existing.providerId,
      startTime,
      endTime,
      id,
    );
    if (conflict) {
      throw new ConflictException(
        'This provider already has a booked appointment overlapping the requested slot.',
      );
    }

    const updated = await this.appointmentsRepository.updateTimes(
      schemaName,
      id,
      startTime,
      endTime,
    );
    if (!updated) {
      throw new ConflictException(
        'This appointment was modified concurrently; please retry.',
      );
    }
    return this.toSummary(tenantId, updated);
  }

  /**
   * Best-effort: a `services/notification` outage/error must never fail an
   * otherwise-successful booking (the slot is already durably persisted) --
   * mirrors the resiliency principle `services/tenant`'s BAC-12
   * `OnboardingService` documents for its own downstream calls, simplified
   * here since there is no separate provisioning-result row to persist the
   * outcome onto.
   */
  private async sendConfirmation(
    tenantId: string,
    channel: CreateAppointmentDto['notifyChannel'],
    to: string,
    appointment: AppointmentSummary,
  ): Promise<void> {
    try {
      await this.notificationServiceClient.sendAppointmentConfirmation(
        tenantId,
        channel,
        to,
        appointment,
      );
    } catch {
      // Swallowed deliberately -- see this method's doc comment.
    }
  }

  private toSummary(
    tenantId: string,
    record: AppointmentRecord,
  ): AppointmentSummary {
    return {
      id: record.id,
      tenantId,
      providerId: record.providerId,
      patientId: record.patientId,
      startTime: record.startTime.toISOString(),
      endTime: record.endTime.toISOString(),
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

function parseIsoDateTime(value: string | undefined, fieldName: string): Date {
  if (!value) {
    throw new BadRequestException(`${fieldName} is required.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${fieldName} is not a valid date-time.`);
  }
  return parsed;
}

function assertChronologicalOrder(startTime: Date, endTime: Date): void {
  if (endTime.getTime() <= startTime.getTime()) {
    throw new BadRequestException('endTime must be after startTime.');
  }
}

/** Resolves `[dayStart, dayEnd)` (UTC) for a bare `YYYY-MM-DD` calendar date. */
function parseCalendarDayRange(date: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) {
    throw new BadRequestException(
      `date "${date}" is not a valid calendar date.`,
    );
  }
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { dayStart, dayEnd };
}
