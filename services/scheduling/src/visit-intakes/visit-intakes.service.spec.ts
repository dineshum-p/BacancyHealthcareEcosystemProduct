import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '@hep/shared-types';
import { VisitIntakesService } from './visit-intakes.service';
import { VisitIntakesRepository } from './visit-intakes.repository';
import { VisitIntakeSchemaProvisioner } from './visit-intake-schema.provisioner';
import { VisitIntakeStatus } from './visit-intake-status.enum';
import { VisitIntakeRecord } from './visit-intake.entity';
import { AppointmentsRepository } from '../appointments/appointments.repository';
import { AppointmentSchemaProvisioner } from '../appointments/appointment-schema.provisioner';
import { AppointmentStatus } from '../appointments/appointment-status.enum';
import { AppointmentRecord } from '../appointments/appointment.entity';

const TENANT_ID = 'tenant-1';
const SCHEMA = 'acme';

function record(overrides: Partial<VisitIntakeRecord> = {}): VisitIntakeRecord {
  return {
    id: 'intake-1',
    patientId: 'patient-1',
    reasonForVisit: 'Annual checkup',
    symptoms: 'None',
    whatsNewSinceLastVisit: '',
    status: VisitIntakeStatus.PENDING,
    assignedProviderId: null,
    appointmentId: null,
    createdAt: new Date('2026-07-20T08:00:00.000Z'),
    updatedAt: new Date('2026-07-20T08:00:00.000Z'),
    ...overrides,
  };
}

function appointment(
  overrides: Partial<AppointmentRecord> = {},
): AppointmentRecord {
  return {
    id: 'appt-1',
    providerId: 'provider-1',
    patientId: 'patient-1',
    startTime: new Date('2026-07-20T09:00:00.000Z'),
    endTime: new Date('2026-07-20T09:30:00.000Z'),
    status: AppointmentStatus.BOOKED,
    createdAt: new Date('2026-07-20T08:00:00.000Z'),
    updatedAt: new Date('2026-07-20T08:00:00.000Z'),
    ...overrides,
  };
}

function user(
  role: AccessTokenPayload['role'],
  userId = 'user-1',
): AccessTokenPayload {
  return { userId, tenantId: TENANT_ID, role };
}

describe('VisitIntakesService', () => {
  let repository: jest.Mocked<VisitIntakesRepository>;
  let schemaProvisioner: jest.Mocked<VisitIntakeSchemaProvisioner>;
  let appointmentsRepository: jest.Mocked<AppointmentsRepository>;
  let appointmentSchemaProvisioner: jest.Mocked<AppointmentSchemaProvisioner>;
  let service: VisitIntakesService;

  beforeEach(() => {
    repository = {
      insert: jest.fn(),
      findById: jest.fn(),
      list: jest.fn(),
      link: jest.fn(),
    } as unknown as jest.Mocked<VisitIntakesRepository>;
    schemaProvisioner = {
      ensureVisitIntakesTable: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<VisitIntakeSchemaProvisioner>;
    appointmentsRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<AppointmentsRepository>;
    appointmentSchemaProvisioner = {
      ensureAppointmentsTable: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AppointmentSchemaProvisioner>;

    service = new VisitIntakesService(
      repository,
      schemaProvisioner,
      appointmentsRepository,
      appointmentSchemaProvisioner,
    );
  });

  describe('create (AC1)', () => {
    const dto = {
      reasonForVisit: 'Recurring headaches',
      symptoms: 'Throbbing pain',
      whatsNewSinceLastVisit: 'New job',
    };

    it("creates a pending intake with patientId taken from the CALLER's own userId (self-scoped, never the body)", async () => {
      repository.insert.mockResolvedValue(record({ patientId: 'patient-9' }));

      await service.create(
        TENANT_ID,
        SCHEMA,
        user('patient', 'patient-9'),
        dto,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.insert).toHaveBeenCalledWith(SCHEMA, {
        patientId: 'patient-9',
        reasonForVisit: 'Recurring headaches',
        symptoms: 'Throbbing pain',
        whatsNewSinceLastVisit: 'New job',
      });
    });

    it('defaults whatsNewSinceLastVisit to an empty string when omitted', async () => {
      repository.insert.mockResolvedValue(record());

      await service.create(TENANT_ID, SCHEMA, user('patient', 'patient-1'), {
        reasonForVisit: 'Reason',
        symptoms: 'Symptoms',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.insert).toHaveBeenCalledWith(
        SCHEMA,
        expect.objectContaining({ whatsNewSinceLastVisit: '' }),
      );
    });

    it('provisions the visit_intakes table before inserting', async () => {
      repository.insert.mockResolvedValue(record());

      await service.create(TENANT_ID, SCHEMA, user('patient'), dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensureVisitIntakesTable).toHaveBeenCalledWith(
        SCHEMA,
      );
    });

    it('returns a summary reflecting the created record, not yet linked to any appointment', async () => {
      repository.insert.mockResolvedValue(record());

      const result = await service.create(
        TENANT_ID,
        SCHEMA,
        user('patient'),
        dto,
      );

      expect(result).toMatchObject({
        id: 'intake-1',
        tenantId: TENANT_ID,
        status: 'pending',
        assignedProviderId: null,
        appointmentId: null,
      });
    });
  });

  describe('list (AC2: staff triage queue)', () => {
    it('returns every pending intake tenant-wide, mapped to summaries', async () => {
      repository.list.mockResolvedValue([record(), record({ id: 'intake-2' })]);

      const result = await service.list(TENANT_ID, SCHEMA, {
        status: 'pending',
      });

      expect(result).toHaveLength(2);
      expect(result[0].tenantId).toBe(TENANT_ID);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.list).toHaveBeenCalledWith(SCHEMA, 'pending');
    });

    it('lists every status when status is omitted', async () => {
      repository.list.mockResolvedValue([]);

      await service.list(TENANT_ID, SCHEMA, {});

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.list).toHaveBeenCalledWith(SCHEMA, undefined);
    });
  });

  describe('findById (AC3: instance-level RBAC)', () => {
    it('throws 404 for an unknown intake', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findById(TENANT_ID, SCHEMA, user('staff'), 'intake-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows the submitting patient to read their OWN intake', async () => {
      repository.findById.mockResolvedValue(record({ patientId: 'patient-1' }));

      await expect(
        service.findById(
          TENANT_ID,
          SCHEMA,
          user('patient', 'patient-1'),
          'intake-1',
        ),
      ).resolves.toMatchObject({ id: 'intake-1' });
    });

    it("forbids a DIFFERENT patient from reading someone else's intake", async () => {
      repository.findById.mockResolvedValue(record({ patientId: 'patient-1' }));

      await expect(
        service.findById(
          TENANT_ID,
          SCHEMA,
          user('patient', 'patient-2'),
          'intake-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows every staff-side role to read ANY intake', async () => {
      repository.findById.mockResolvedValue(record());

      for (const role of ['super_admin', 'clinic_admin', 'staff'] as const) {
        await expect(
          service.findById(
            TENANT_ID,
            SCHEMA,
            user(role, 'someone-else'),
            'intake-1',
          ),
        ).resolves.toMatchObject({ id: 'intake-1' });
      }
    });

    it('allows the SPECIFIC assigned provider to read the intake', async () => {
      repository.findById.mockResolvedValue(
        record({
          assignedProviderId: 'provider-1',
          status: VisitIntakeStatus.LINKED,
        }),
      );

      await expect(
        service.findById(
          TENANT_ID,
          SCHEMA,
          user('provider', 'provider-1'),
          'intake-1',
        ),
      ).resolves.toMatchObject({ assignedProviderId: 'provider-1' });
    });

    it('forbids any OTHER provider (not assigned to this intake) with 403', async () => {
      repository.findById.mockResolvedValue(
        record({
          assignedProviderId: 'provider-1',
          status: VisitIntakeStatus.LINKED,
        }),
      );

      await expect(
        service.findById(
          TENANT_ID,
          SCHEMA,
          user('provider', 'provider-2'),
          'intake-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('forbids EVERY provider from reading an intake that is not assigned to anyone yet', async () => {
      repository.findById.mockResolvedValue(
        record({ assignedProviderId: null }),
      );

      await expect(
        service.findById(
          TENANT_ID,
          SCHEMA,
          user('provider', 'provider-1'),
          'intake-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('link (AC3)', () => {
    it('throws 404 for an unknown intake', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.link(TENANT_ID, SCHEMA, 'intake-1', {
          providerId: 'provider-1',
          appointmentId: 'appt-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 409 when the intake has already been linked', async () => {
      repository.findById.mockResolvedValue(
        record({ status: VisitIntakeStatus.LINKED }),
      );

      await expect(
        service.link(TENANT_ID, SCHEMA, 'intake-1', {
          providerId: 'provider-1',
          appointmentId: 'appt-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 400 when the referenced appointment does not exist', async () => {
      repository.findById.mockResolvedValue(record());
      appointmentsRepository.findById.mockResolvedValue(null);

      await expect(
        service.link(TENANT_ID, SCHEMA, 'intake-1', {
          providerId: 'provider-1',
          appointmentId: 'unknown-appt',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when the appointment is not booked with the given providerId', async () => {
      repository.findById.mockResolvedValue(record());
      appointmentsRepository.findById.mockResolvedValue(
        appointment({ providerId: 'a-different-provider' }),
      );

      await expect(
        service.link(TENANT_ID, SCHEMA, 'intake-1', {
          providerId: 'provider-1',
          appointmentId: 'appt-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('links the intake to the provider/appointment, transitioning to linked', async () => {
      repository.findById.mockResolvedValue(record());
      appointmentsRepository.findById.mockResolvedValue(appointment());
      repository.link.mockResolvedValue(
        record({
          status: VisitIntakeStatus.LINKED,
          assignedProviderId: 'provider-1',
          appointmentId: 'appt-1',
        }),
      );

      const result = await service.link(TENANT_ID, SCHEMA, 'intake-1', {
        providerId: 'provider-1',
        appointmentId: 'appt-1',
      });

      expect(result).toMatchObject({
        status: 'linked',
        assignedProviderId: 'provider-1',
        appointmentId: 'appt-1',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.link).toHaveBeenCalledWith(SCHEMA, 'intake-1', {
        assignedProviderId: 'provider-1',
        appointmentId: 'appt-1',
      });
    });

    it('throws 409 on a concurrent-modification race (repository returns null)', async () => {
      repository.findById.mockResolvedValue(record());
      appointmentsRepository.findById.mockResolvedValue(appointment());
      repository.link.mockResolvedValue(null);

      await expect(
        service.link(TENANT_ID, SCHEMA, 'intake-1', {
          providerId: 'provider-1',
          appointmentId: 'appt-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
