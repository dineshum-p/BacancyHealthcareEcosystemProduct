import { PatientsService } from './patients.service';
import { PatientsRepository } from './patients.repository';
import { PatientSchemaProvisioner } from './patient-schema.provisioner';
import { DomainEventPublisher } from '../events/domain-event-publisher.interface';

describe('PatientsService', () => {
  function makeService(overrides?: {
    insert?: jest.Mock;
    search?: jest.Mock;
    publishPatientCreated?: jest.Mock;
  }) {
    const insert =
      overrides?.insert ??
      jest.fn().mockResolvedValue({
        id: 'patient-1',
        mrn: 'MRN-000001',
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-05-12T00:00:00.000Z'),
        gender: null,
        phone: null,
        email: null,
        createdAt: new Date('2026-07-14T00:00:00.000Z'),
        updatedAt: new Date('2026-07-14T00:00:00.000Z'),
      });
    const search = overrides?.search ?? jest.fn();
    const ensurePatientsTable = jest.fn().mockResolvedValue(undefined);
    const publishPatientCreated =
      overrides?.publishPatientCreated ??
      jest.fn().mockResolvedValue(undefined);

    const repository = { insert, search } as unknown as PatientsRepository;
    const provisioner = {
      ensurePatientsTable,
    } as unknown as PatientSchemaProvisioner;
    const eventPublisher = {
      publishPatientCreated,
    } as unknown as DomainEventPublisher;

    const service = new PatientsService(
      repository,
      provisioner,
      eventPublisher,
    );
    return {
      service,
      insert,
      search,
      ensurePatientsTable,
      publishPatientCreated,
    };
  }

  describe('create', () => {
    it('provisions the schema, persists the patient, and maps it to a PatientSummary', async () => {
      const { service, insert, ensurePatientsTable } = makeService();

      const summary = await service.create('tenant-1', 'acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      expect(ensurePatientsTable).toHaveBeenCalledWith('acme');
      expect(insert).toHaveBeenCalledWith('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
        gender: undefined,
        phone: undefined,
        email: undefined,
      });
      expect(summary).toEqual({
        id: 'patient-1',
        tenantId: 'tenant-1',
        mrn: 'MRN-000001',
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
        gender: null,
        phone: null,
        email: null,
        createdAt: '2026-07-14T00:00:00.000Z',
        updatedAt: '2026-07-14T00:00:00.000Z',
      });
    });

    it('AC4: publishes a patient.created event with the correct shape after persisting', async () => {
      const { service, publishPatientCreated } = makeService();

      await service.create('tenant-1', 'acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      expect(publishPatientCreated).toHaveBeenCalledTimes(1);
      expect(publishPatientCreated).toHaveBeenCalledWith({
        eventId: 'patient-1',
        patientId: 'patient-1',
        tenantId: 'tenant-1',
        createdAt: '2026-07-14T00:00:00.000Z',
      });
    });

    it('reuses the patient id as the event idempotency key (eventId === patientId), not a freshly generated value', async () => {
      const { service, publishPatientCreated } = makeService();

      await service.create('tenant-1', 'acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      const calls = publishPatientCreated.mock.calls as unknown[][];
      const publishedEvent = calls[0][0] as {
        eventId: string;
        patientId: string;
      };
      expect(publishedEvent.eventId).toEqual(publishedEvent.patientId);
      expect(publishedEvent.eventId).toEqual('patient-1');
    });

    it('never publishes a patient.created event if persistence fails', async () => {
      const insert = jest.fn().mockRejectedValue(new Error('db error'));
      const { service, publishPatientCreated } = makeService({ insert });

      await expect(
        service.create('tenant-1', 'acme', {
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-05-12',
        }),
      ).rejects.toThrow('db error');
      expect(publishPatientCreated).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('provisions the schema, delegates to the repository, and maps results, defaulting pagination', async () => {
      const search = jest.fn().mockResolvedValue({
        items: [
          {
            id: 'patient-1',
            mrn: 'MRN-000001',
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: new Date('1990-05-12T00:00:00.000Z'),
            gender: 'female',
            phone: null,
            email: null,
            createdAt: new Date('2026-07-14T00:00:00.000Z'),
            updatedAt: new Date('2026-07-14T00:00:00.000Z'),
          },
        ],
        total: 1,
      });
      const { service, ensurePatientsTable } = makeService({ search });

      const result = await service.search('tenant-1', 'acme', {});

      expect(ensurePatientsTable).toHaveBeenCalledWith('acme');
      expect(search).toHaveBeenCalledWith(
        'acme',
        { name: undefined, mrn: undefined, dateOfBirth: undefined },
        { page: 1, limit: 20 },
      );
      expect(result).toEqual({
        items: [
          {
            id: 'patient-1',
            tenantId: 'tenant-1',
            mrn: 'MRN-000001',
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: '1990-05-12',
            gender: 'female',
            phone: null,
            email: null,
            createdAt: '2026-07-14T00:00:00.000Z',
            updatedAt: '2026-07-14T00:00:00.000Z',
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
      });
    });

    it('forwards explicit filters and pagination to the repository', async () => {
      const search = jest.fn().mockResolvedValue({ items: [], total: 0 });
      const { service } = makeService({ search });

      await service.search('tenant-1', 'acme', {
        name: 'Doe',
        mrn: 'MRN',
        dateOfBirth: '1990-05-12',
        page: 2,
        limit: 5,
      });

      expect(search).toHaveBeenCalledWith(
        'acme',
        { name: 'Doe', mrn: 'MRN', dateOfBirth: '1990-05-12' },
        { page: 2, limit: 5 },
      );
    });

    /**
     * BAC-17 (qa-tester off-by-one regression): `pg`'s runtime type parser
     * for a `date` column (`postgres-date`'s `getDate`, registered for OID
     * 1082) renders `YYYY-MM-DD` as a *local-midnight* `Date` -- i.e.
     * `new Date(year, month, day)`, NOT `new Date('...T00:00:00.000Z')` --
     * despite `PatientRecord.dateOfBirth`'s `string` type annotation lying
     * about the runtime shape. Every other test in this file mocks the
     * repository with a UTC-constructed `Date` (`new Date('...Z')`), which
     * masks that mismatch: `.toISOString()` on a UTC-midnight `Date` always
     * round-trips to the same calendar date regardless of the host's
     * timezone. This test instead mocks the record the way `pg` actually
     * returns it, reproducing the real bug: in any timezone ahead of UTC
     * (e.g. the CI/dev default, IST/UTC+5:30), local midnight shifts to the
     * *previous* UTC day, so `toSummary`'s old `value.toISOString().slice(0,
     * 10)` rendered `1990-05-11` for a patient actually born `1990-05-12`.
     */
    it('renders a local-midnight Date (as pg returns for a `date` column) as the same calendar date, not shifted by the host timezone', async () => {
      const search = jest.fn().mockResolvedValue({
        items: [
          {
            id: 'patient-1',
            mrn: 'MRN-000001',
            firstName: 'Jane',
            lastName: 'Doe',
            // Mirrors `postgres-date`'s `getDate`: `new Date(year, month, day)`.
            dateOfBirth: new Date(1990, 4, 12),
            gender: 'female',
            phone: null,
            email: null,
            createdAt: new Date('2026-07-14T00:00:00.000Z'),
            updatedAt: new Date('2026-07-14T00:00:00.000Z'),
          },
        ],
        total: 1,
      });
      const { service } = makeService({ search });

      const result = await service.search('tenant-1', 'acme', {});

      expect(result.items[0].dateOfBirth).toBe('1990-05-12');
    });
  });
});
