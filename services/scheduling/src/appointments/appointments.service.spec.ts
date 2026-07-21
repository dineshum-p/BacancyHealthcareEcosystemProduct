import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '@hep/shared-types';
import { AppointmentsService } from './appointments.service';
import { AppointmentsRepository } from './appointments.repository';
import { AppointmentSchemaProvisioner } from './appointment-schema.provisioner';
import { AppointmentStatus } from './appointment-status.enum';
import { AppointmentRecord } from './appointment.entity';
import type { NotificationServiceClient } from '../notifications/clients/notification-service.client';

const TENANT_ID = 'tenant-1';
const SCHEMA = 'acme';

function record(overrides: Partial<AppointmentRecord> = {}): AppointmentRecord {
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

describe('AppointmentsService', () => {
  let repository: jest.Mocked<AppointmentsRepository>;
  let schemaProvisioner: jest.Mocked<AppointmentSchemaProvisioner>;
  let notificationClient: jest.Mocked<NotificationServiceClient>;
  let service: AppointmentsService;

  beforeEach(() => {
    repository = {
      hasConflict: jest.fn(),
      insert: jest.fn(),
      findById: jest.fn(),
      findByProviderAndRange: jest.fn(),
      updateTimes: jest.fn(),
      cancel: jest.fn(),
    } as unknown as jest.Mocked<AppointmentsRepository>;
    schemaProvisioner = {
      ensureAppointmentsTable: jest.fn().mockResolvedValue(undefined),
      ensureAuditLogsTable: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AppointmentSchemaProvisioner>;
    notificationClient = {
      sendAppointmentConfirmation: jest
        .fn()
        .mockResolvedValue({ outcome: 'succeeded' }),
    };
    service = new AppointmentsService(
      repository,
      schemaProvisioner,
      notificationClient,
    );
  });

  describe('create (AC1)', () => {
    const dto = {
      providerId: 'provider-1',
      patientId: 'patient-1',
      startTime: '2026-07-20T09:00:00.000Z',
      endTime: '2026-07-20T09:30:00.000Z',
      notifyChannel: 'email' as const,
      notifyTo: 'patient@example.com',
    };

    it('books a slot and returns 201-worthy summary when no conflict exists', async () => {
      repository.hasConflict.mockResolvedValue(false);
      repository.insert.mockResolvedValue(record());

      const result = await service.create(
        TENANT_ID,
        SCHEMA,
        user('staff'),
        dto,
      );

      expect(result).toMatchObject({
        id: 'appt-1',
        tenantId: TENANT_ID,
        providerId: 'provider-1',
        patientId: 'patient-1',
        status: 'booked',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(schemaProvisioner.ensureAppointmentsTable).toHaveBeenCalledWith(
        SCHEMA,
      );
    });

    it('throws 409 when the slot overlaps an existing booked appointment', async () => {
      repository.hasConflict.mockResolvedValue(true);

      await expect(
        service.create(TENANT_ID, SCHEMA, user('staff'), dto),
      ).rejects.toThrow(ConflictException);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.insert).not.toHaveBeenCalled();
    });

    it('sends a confirmation notification after a successful booking', async () => {
      repository.hasConflict.mockResolvedValue(false);
      repository.insert.mockResolvedValue(record());

      await service.create(TENANT_ID, SCHEMA, user('staff'), dto);

      expect(
        // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
        notificationClient.sendAppointmentConfirmation,
      ).toHaveBeenCalledWith(
        TENANT_ID,
        'email',
        'patient@example.com',
        expect.objectContaining({ id: 'appt-1' }),
      );
    });

    it('does not fail the booking when the notification call throws', async () => {
      repository.hasConflict.mockResolvedValue(false);
      repository.insert.mockResolvedValue(record());
      notificationClient.sendAppointmentConfirmation.mockRejectedValue(
        new Error('services/notification is down'),
      );

      await expect(
        service.create(TENANT_ID, SCHEMA, user('staff'), dto),
      ).resolves.toMatchObject({ id: 'appt-1' });
    });

    it('throws 400 when endTime is not after startTime', async () => {
      await expect(
        service.create(TENANT_ID, SCHEMA, user('staff'), {
          ...dto,
          endTime: dto.startTime,
        }),
      ).rejects.toThrow(BadRequestException);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.hasConflict).not.toHaveBeenCalled();
    });

    describe('RBAC: provider scope', () => {
      it.each(['clinic_admin', 'staff', 'super_admin'] as const)(
        'allows %s to book for ANY provider',
        async (role) => {
          repository.hasConflict.mockResolvedValue(false);
          repository.insert.mockResolvedValue(record());

          await expect(
            service.create(TENANT_ID, SCHEMA, user(role, 'someone-else'), dto),
          ).resolves.toBeDefined();
        },
      );

      it('allows a provider to book on their OWN calendar', async () => {
        repository.hasConflict.mockResolvedValue(false);
        repository.insert.mockResolvedValue(record());

        await expect(
          service.create(
            TENANT_ID,
            SCHEMA,
            user('provider', 'provider-1'),
            dto,
          ),
        ).resolves.toBeDefined();
      });

      it("forbids a provider from booking on a DIFFERENT provider's calendar", async () => {
        await expect(
          service.create(
            TENANT_ID,
            SCHEMA,
            user('provider', 'someone-else'),
            dto,
          ),
        ).rejects.toThrow(ForbiddenException);
        // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
        expect(repository.hasConflict).not.toHaveBeenCalled();
      });
    });
  });

  describe('findDaySchedule (AC2)', () => {
    const query = { date: '2026-07-20' };

    it("returns the requested provider's day, tenant-scoped", async () => {
      repository.findByProviderAndRange.mockResolvedValue([record()]);

      const result = await service.findDaySchedule(
        TENANT_ID,
        SCHEMA,
        user('clinic_admin'),
        { ...query, providerId: 'provider-1' },
      );

      expect(result).toHaveLength(1);
      expect(result[0].tenantId).toBe(TENANT_ID);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.findByProviderAndRange).toHaveBeenCalledWith(
        SCHEMA,
        'provider-1',
        new Date('2026-07-20T00:00:00.000Z'),
        new Date('2026-07-21T00:00:00.000Z'),
      );
    });

    it('requires providerId for clinic_admin/staff (400 if missing)', async () => {
      await expect(
        service.findDaySchedule(TENANT_ID, SCHEMA, user('staff'), query),
      ).rejects.toThrow(BadRequestException);
    });

    it("defaults to the caller's own calendar for a provider", async () => {
      repository.findByProviderAndRange.mockResolvedValue([]);

      await service.findDaySchedule(
        TENANT_ID,
        SCHEMA,
        user('provider', 'provider-9'),
        query,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
      expect(repository.findByProviderAndRange).toHaveBeenCalledWith(
        SCHEMA,
        'provider-9',
        expect.any(Date),
        expect.any(Date),
      );
    });

    it("forbids a provider from querying a DIFFERENT provider's day", async () => {
      await expect(
        service.findDaySchedule(
          TENANT_ID,
          SCHEMA,
          user('provider', 'provider-9'),
          {
            ...query,
            providerId: 'provider-1',
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update (AC3)', () => {
    it('throws 404 for an unknown appointment', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, SCHEMA, user('staff'), 'appt-1', {
          action: 'cancel',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("forbids a provider from modifying a DIFFERENT provider's appointment", async () => {
      repository.findById.mockResolvedValue(
        record({ providerId: 'provider-2' }),
      );

      await expect(
        service.update(
          TENANT_ID,
          SCHEMA,
          user('provider', 'provider-1'),
          'appt-1',
          { action: 'cancel' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 409 when the appointment is already cancelled', async () => {
      repository.findById.mockResolvedValue(
        record({ status: AppointmentStatus.CANCELLED }),
      );

      await expect(
        service.update(TENANT_ID, SCHEMA, user('staff'), 'appt-1', {
          action: 'cancel',
        }),
      ).rejects.toThrow(ConflictException);
    });

    describe('cancel', () => {
      it('cancels a booked appointment, recording the status transition', async () => {
        repository.findById.mockResolvedValue(record());
        repository.cancel.mockResolvedValue(
          record({ status: AppointmentStatus.CANCELLED }),
        );

        const result = await service.update(
          TENANT_ID,
          SCHEMA,
          user('staff'),
          'appt-1',
          { action: 'cancel' },
        );

        expect(result.status).toBe('cancelled');
        // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
        expect(repository.cancel).toHaveBeenCalledWith(SCHEMA, 'appt-1');
      });

      it('throws 409 on a concurrent-modification race (repository returns null)', async () => {
        repository.findById.mockResolvedValue(record());
        repository.cancel.mockResolvedValue(null);

        await expect(
          service.update(TENANT_ID, SCHEMA, user('staff'), 'appt-1', {
            action: 'cancel',
          }),
        ).rejects.toThrow(ConflictException);
      });
    });

    describe('reschedule', () => {
      const rescheduleDto = {
        action: 'reschedule' as const,
        startTime: '2026-07-20T15:00:00.000Z',
        endTime: '2026-07-20T15:30:00.000Z',
      };

      it('reschedules a booked appointment to a new, non-conflicting time', async () => {
        repository.findById.mockResolvedValue(record());
        repository.hasConflict.mockResolvedValue(false);
        repository.updateTimes.mockResolvedValue(
          record({
            startTime: new Date(rescheduleDto.startTime),
            endTime: new Date(rescheduleDto.endTime),
          }),
        );

        const result = await service.update(
          TENANT_ID,
          SCHEMA,
          user('staff'),
          'appt-1',
          rescheduleDto,
        );

        expect(result.startTime).toBe(rescheduleDto.startTime);
        // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
        expect(repository.hasConflict).toHaveBeenCalledWith(
          SCHEMA,
          'provider-1',
          new Date(rescheduleDto.startTime),
          new Date(rescheduleDto.endTime),
          'appt-1',
        );
      });

      it('throws 409 when the new time overlaps another booked appointment', async () => {
        repository.findById.mockResolvedValue(record());
        repository.hasConflict.mockResolvedValue(true);

        await expect(
          service.update(
            TENANT_ID,
            SCHEMA,
            user('staff'),
            'appt-1',
            rescheduleDto,
          ),
        ).rejects.toThrow(ConflictException);
        // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
        expect(repository.updateTimes).not.toHaveBeenCalled();
      });

      it('throws 400 when the new endTime is not after the new startTime', async () => {
        repository.findById.mockResolvedValue(record());

        await expect(
          service.update(TENANT_ID, SCHEMA, user('staff'), 'appt-1', {
            ...rescheduleDto,
            endTime: rescheduleDto.startTime,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('throws 409 on a concurrent-modification race (repository returns null)', async () => {
        repository.findById.mockResolvedValue(record());
        repository.hasConflict.mockResolvedValue(false);
        repository.updateTimes.mockResolvedValue(null);

        await expect(
          service.update(
            TENANT_ID,
            SCHEMA,
            user('staff'),
            'appt-1',
            rescheduleDto,
          ),
        ).rejects.toThrow(ConflictException);
      });

      it('allows a provider to reschedule their OWN appointment', async () => {
        repository.findById.mockResolvedValue(
          record({ providerId: 'provider-1' }),
        );
        repository.hasConflict.mockResolvedValue(false);
        repository.updateTimes.mockResolvedValue(record());

        await expect(
          service.update(
            TENANT_ID,
            SCHEMA,
            user('provider', 'provider-1'),
            'appt-1',
            rescheduleDto,
          ),
        ).resolves.toBeDefined();
      });
    });
  });
});
