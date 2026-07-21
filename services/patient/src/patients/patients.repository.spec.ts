import { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { PatientsRepository } from './patients.repository';
import { PatientSchemaProvisioner } from './patient-schema.provisioner';

function createInMemoryPool(): Pool {
  const db = newDb();
  const PgCompatiblePool = db.adapters.createPg().Pool as new () => Pool;
  return new PgCompatiblePool();
}

describe('PatientsRepository', () => {
  let pool: Pool;
  let repository: PatientsRepository;
  let provisioner: PatientSchemaProvisioner;

  beforeEach(async () => {
    pool = createInMemoryPool();
    provisioner = new PatientSchemaProvisioner(pool);
    repository = new PatientsRepository(pool);
    await pool.query('CREATE SCHEMA acme');
    await provisioner.ensurePatientsTable('acme');
  });

  describe('AC1: assigns a tenant-unique, sequential MRN', () => {
    it('assigns the first patient MRN-000001', async () => {
      const record = await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      expect(record.mrn).toBe('MRN-000001');
      expect(record.id).toEqual(expect.any(String));
      expect(record.firstName).toBe('Jane');
      expect(record.lastName).toBe('Doe');
    });

    it('assigns sequential MRNs to successive patients in the same tenant', async () => {
      const first = await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });
      const second = await repository.insert('acme', {
        firstName: 'John',
        lastName: 'Smith',
        dateOfBirth: '1985-01-01',
      });
      const third = await repository.insert('acme', {
        firstName: 'Alice',
        lastName: 'Jones',
        dateOfBirth: '2000-12-31',
      });

      expect([first.mrn, second.mrn, third.mrn]).toEqual([
        'MRN-000001',
        'MRN-000002',
        'MRN-000003',
      ]);
    });
  });

  describe('AC2: MRNs are never duplicated within a tenant, and are independent across tenants', () => {
    it('never assigns the same MRN twice within one tenant, even under concurrent inserts', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          repository.insert('acme', {
            firstName: `Patient${i}`,
            lastName: 'Test',
            dateOfBirth: '1990-01-01',
          }),
        ),
      );

      const mrns = results.map((r) => r.mrn);
      expect(new Set(mrns).size).toBe(10);
    });

    it("does not let one tenant's numbering affect another tenant's", async () => {
      await pool.query('CREATE SCHEMA globex');
      await provisioner.ensurePatientsTable('globex');

      const acmeFirst = await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });
      const globexFirst = await repository.insert('globex', {
        firstName: 'Bob',
        lastName: 'Builder',
        dateOfBirth: '1975-03-03',
      });
      const acmeSecond = await repository.insert('acme', {
        firstName: 'John',
        lastName: 'Smith',
        dateOfBirth: '1985-01-01',
      });

      expect(acmeFirst.mrn).toBe('MRN-000001');
      // globex's counter starts fresh at 1, unaffected by acme already having
      // issued one MRN.
      expect(globexFirst.mrn).toBe('MRN-000001');
      expect(acmeSecond.mrn).toBe('MRN-000002');
    });
  });

  describe('AC3: search by name/MRN/DOB, tenant-scoped and paginated', () => {
    beforeEach(async () => {
      await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });
      await repository.insert('acme', {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-01-01',
      });
      await repository.insert('acme', {
        firstName: 'Alice',
        lastName: 'Jones',
        dateOfBirth: '2000-12-31',
      });
    });

    it('searches by (partial, case-insensitive) name across first/last name', async () => {
      const { items, total } = await repository.search(
        'acme',
        { name: 'doe' },
        { page: 1, limit: 20 },
      );
      expect(total).toBe(2);
      expect(items.map((i) => i.lastName)).toEqual(['Doe', 'Doe']);
    });

    it('searches by exact date of birth', async () => {
      const { items, total } = await repository.search(
        'acme',
        { dateOfBirth: '1990-05-12' },
        { page: 1, limit: 20 },
      );
      expect(total).toBe(1);
      expect(items[0].firstName).toBe('Jane');
    });

    it('searches by (partial) MRN', async () => {
      const { items, total } = await repository.search(
        'acme',
        { mrn: '000002' },
        { page: 1, limit: 20 },
      );
      expect(total).toBe(1);
      expect(items[0].firstName).toBe('John');
    });

    it('returns all patients, paginated, when no filter is supplied', async () => {
      const page1 = await repository.search('acme', {}, { page: 1, limit: 2 });
      const page2 = await repository.search('acme', {}, { page: 2, limit: 2 });

      expect(page1.total).toBe(3);
      expect(page1.items).toHaveLength(2);
      expect(page2.items).toHaveLength(1);
    });

    it('never returns patients from a different tenant schema', async () => {
      await pool.query('CREATE SCHEMA globex');
      await provisioner.ensurePatientsTable('globex');
      await repository.insert('globex', {
        firstName: 'Other',
        lastName: 'Tenant',
        dateOfBirth: '1999-09-09',
      });

      const { items, total } = await repository.search(
        'acme',
        {},
        { page: 1, limit: 20 },
      );
      expect(total).toBe(3);
      expect(items.some((i) => i.firstName === 'Other')).toBe(false);
    });
  });

  describe('findById', () => {
    it('returns the patient matching the given id', async () => {
      const inserted = await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      const found = await repository.findById('acme', inserted.id);

      expect(found?.id).toBe(inserted.id);
      expect(found?.mrn).toBe(inserted.mrn);
    });

    it('returns null when no patient matches the given id', async () => {
      const found = await repository.findById(
        'acme',
        '00000000-0000-0000-0000-000000000000',
      );
      expect(found).toBeNull();
    });
  });

  describe('BAC-36: findPotentialDuplicate', () => {
    beforeEach(async () => {
      await repository.insert('acme', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
        phone: '555-0100',
        email: 'jane.doe@example.com',
      });
    });

    it('matches on case-insensitive exact name + exact date of birth ("name_dob")', async () => {
      const match = await repository.findPotentialDuplicate('acme', {
        firstName: 'JANE',
        lastName: 'doe',
        dateOfBirth: '1990-05-12',
      });

      expect(match?.matchReason).toBe('name_dob');
      expect(match?.patient.email).toBe('jane.doe@example.com');
    });

    it('matches on an exact phone number when the name/DOB do not match', async () => {
      const match = await repository.findPotentialDuplicate('acme', {
        firstName: 'Janet',
        lastName: 'Doerson',
        dateOfBirth: '1991-01-01',
        phone: '555-0100',
      });

      expect(match?.matchReason).toBe('phone');
    });

    it('matches on an exact (case-insensitive) email when name/DOB/phone do not match', async () => {
      const match = await repository.findPotentialDuplicate('acme', {
        firstName: 'Janet',
        lastName: 'Doerson',
        dateOfBirth: '1991-01-01',
        email: 'JANE.DOE@example.com',
      });

      expect(match?.matchReason).toBe('email');
    });

    it('returns null when nothing matches', async () => {
      const match = await repository.findPotentialDuplicate('acme', {
        firstName: 'Nobody',
        lastName: 'Here',
        dateOfBirth: '2000-01-01',
        phone: '555-9999',
        email: 'nobody@example.com',
      });

      expect(match).toBeNull();
    });

    it('never matches a patient registered under a different tenant schema', async () => {
      await pool.query('CREATE SCHEMA globex');
      await provisioner.ensurePatientsTable('globex');
      await repository.insert('globex', {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-05-12',
      });

      const match = await repository.findPotentialDuplicate('globex', {
        firstName: 'Someone',
        lastName: 'Else',
        dateOfBirth: '1970-01-01',
      });

      expect(match).toBeNull();
    });
  });
});
