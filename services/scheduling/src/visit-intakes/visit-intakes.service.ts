import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload, VisitIntakeSummary } from '@hep/shared-types';
import { VisitIntakesRepository } from './visit-intakes.repository';
import { VisitIntakeSchemaProvisioner } from './visit-intake-schema.provisioner';
import { VisitIntakeRecord } from './visit-intake.entity';
import { VisitIntakeStatus } from './visit-intake-status.enum';
import { CreateVisitIntakeDto } from './dto/create-visit-intake.dto';
import { VisitIntakeQueryDto } from './dto/visit-intake-query.dto';
import { LinkVisitIntakeDto } from './dto/link-visit-intake.dto';
import { assertVisitIntakeReadScope } from './visit-intake-scope.util';
import { AppointmentsRepository } from '../appointments/appointments.repository';
import { AppointmentSchemaProvisioner } from '../appointments/appointment-schema.provisioner';
import { AppointmentStatus } from '../appointments/appointment-status.enum';

/**
 * Core visit-intake logic (BAC-45), deliberately schema-explicit (see
 * `VisitIntakesRepository`'s doc comment) rather than request-scoped, same
 * convention as `AppointmentsService`.
 *
 * Enforces BOTH RBAC layers this ticket requires: the coarse, role-level
 * check (`PermissionsGuard`, in the controller) has already run by the time
 * any method here executes; the finer, instance-level rule -- a `patient`
 * may only read/create their OWN intake, and a `provider` may only read the
 * ONE intake they are specifically assigned to (never a calendar-wide
 * grant) -- is enforced HERE via `visit-intake-scope.util.ts`, since only
 * the service layer has both the caller's identity and the specific intake
 * being read.
 */
@Injectable()
export class VisitIntakesService {
  constructor(
    private readonly visitIntakesRepository: VisitIntakesRepository,
    private readonly schemaProvisioner: VisitIntakeSchemaProvisioner,
    private readonly appointmentsRepository: AppointmentsRepository,
    private readonly appointmentSchemaProvisioner: AppointmentSchemaProvisioner,
  ) {}

  /**
   * AC1: creates a pending-review intake for the CALLING patient --
   * `patientId` is always the caller's own `userId` (self-scoped; the
   * request body carries no `patientId` field at all, see
   * `CreateVisitIntakeDto`), never yet linked to any booked appointment
   * slot. Every call inserts a brand-new row -- see
   * `VisitIntakesRepository`'s doc comment for why this is never an
   * upsert/merge into a prior intake, distinct from BAC-44's baseline
   * profile semantics.
   */
  async create(
    tenantId: string,
    schemaName: string,
    user: AccessTokenPayload,
    dto: CreateVisitIntakeDto,
  ): Promise<VisitIntakeSummary> {
    await this.schemaProvisioner.ensureVisitIntakesTable(schemaName);

    const record = await this.visitIntakesRepository.insert(schemaName, {
      patientId: user.userId,
      reasonForVisit: dto.reasonForVisit,
      symptoms: dto.symptoms,
      whatsNewSinceLastVisit: dto.whatsNewSinceLastVisit ?? '',
    });

    return this.toSummary(tenantId, record);
  }

  /**
   * AC2: the staff-facing triage queue (`?status=pending`), or any other
   * single lifecycle state -- tenant-wide, across every patient. Only ever
   * reachable by a staff-side role (`super_admin`/`clinic_admin`/`staff`);
   * `PermissionsGuard`'s `READ_VISIT_INTAKE_QUEUE` permission already
   * restricts this at the role level (see `role-permissions.map.ts`), so no
   * further instance-level check applies here -- unlike `findById`, there is
   * no single resource to scope against.
   */
  async list(
    tenantId: string,
    schemaName: string,
    query: VisitIntakeQueryDto,
  ): Promise<VisitIntakeSummary[]> {
    await this.schemaProvisioner.ensureVisitIntakesTable(schemaName);

    const records = await this.visitIntakesRepository.list(
      schemaName,
      query.status,
    );
    return records.map((record) => this.toSummary(tenantId, record));
  }

  /**
   * AC3: reads a single intake, RBAC-scoped via
   * `assertVisitIntakeReadScope` -- the submitting patient and staff-side
   * roles may always read it; a `provider` may read it ONLY if they are the
   * specific provider assigned to it (403 for any other provider,
   * including one assigned to a DIFFERENT intake).
   */
  async findById(
    tenantId: string,
    schemaName: string,
    user: AccessTokenPayload,
    id: string,
  ): Promise<VisitIntakeSummary> {
    await this.schemaProvisioner.ensureVisitIntakesTable(schemaName);

    const record = await this.visitIntakesRepository.findById(schemaName, id);
    if (!record) {
      throw new NotFoundException(`Visit intake "${id}" was not found.`);
    }

    assertVisitIntakeReadScope(user, record);

    return this.toSummary(tenantId, record);
  }

  /**
   * AC3: staff link a specific provider + the BAC-16/21 appointment they
   * just booked to a pending intake. Verifies `appointmentId` refers to a
   * real, existing appointment that is BOTH booked with `providerId` AND
   * still `AppointmentStatus.BOOKED` (not `CANCELLED`) -- a provider
   * mismatch, an unknown appointment, or a cancelled one is rejected rather
   * than silently trusting the caller-supplied pairing. Only ever reachable
   * by a staff-side role (`LINK_VISIT_INTAKE` permission); not itself
   * instance-scoped (staff may link any tenant-wide intake, same as the
   * triage queue).
   */
  async link(
    tenantId: string,
    schemaName: string,
    id: string,
    dto: LinkVisitIntakeDto,
  ): Promise<VisitIntakeSummary> {
    await this.schemaProvisioner.ensureVisitIntakesTable(schemaName);

    const intake = await this.visitIntakesRepository.findById(schemaName, id);
    if (!intake) {
      throw new NotFoundException(`Visit intake "${id}" was not found.`);
    }
    if (intake.status !== VisitIntakeStatus.PENDING) {
      throw new ConflictException(
        `Visit intake "${id}" has already been linked to a provider/appointment.`,
      );
    }

    await this.appointmentSchemaProvisioner.ensureAppointmentsTable(schemaName);
    const appointment = await this.appointmentsRepository.findById(
      schemaName,
      dto.appointmentId,
    );
    if (!appointment) {
      throw new BadRequestException(
        `Appointment "${dto.appointmentId}" was not found.`,
      );
    }
    if (appointment.providerId !== dto.providerId) {
      throw new BadRequestException(
        `Appointment "${dto.appointmentId}" is not booked with provider "${dto.providerId}".`,
      );
    }
    if (appointment.status !== AppointmentStatus.BOOKED) {
      throw new BadRequestException(
        `Appointment "${dto.appointmentId}" is not booked (status: "${appointment.status}").`,
      );
    }

    const updated = await this.visitIntakesRepository.link(schemaName, id, {
      assignedProviderId: dto.providerId,
      appointmentId: dto.appointmentId,
    });
    if (!updated) {
      // Lost a race with a concurrent link between the `findById` check
      // above and this update.
      throw new ConflictException(
        'This visit intake was modified concurrently; please retry.',
      );
    }

    return this.toSummary(tenantId, updated);
  }

  private toSummary(
    tenantId: string,
    record: VisitIntakeRecord,
  ): VisitIntakeSummary {
    return {
      id: record.id,
      tenantId,
      patientId: record.patientId,
      reasonForVisit: record.reasonForVisit,
      symptoms: record.symptoms,
      whatsNewSinceLastVisit: record.whatsNewSinceLastVisit,
      status: record.status,
      assignedProviderId: record.assignedProviderId,
      appointmentId: record.appointmentId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
