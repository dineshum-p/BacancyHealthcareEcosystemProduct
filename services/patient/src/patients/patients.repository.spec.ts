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
});
