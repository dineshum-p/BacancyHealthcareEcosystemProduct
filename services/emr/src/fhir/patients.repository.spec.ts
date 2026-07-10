import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PatientsRepository } from './patients.repository';
import { EmrSchemaProvisioner } from './emr-schema.provisioner';
import { createInMemoryPool } from '../../test/support/create-in-memory-pool';

describe('PatientsRepository', () => {
  const SCHEMA = 'tenant_a';
  let pool: Pool;
  let repository: PatientsRepository;

  beforeEach(async () => {
    pool = createInMemoryPool();
    await pool.query(`CREATE SCHEMA ${SCHEMA}`);
    await new EmrSchemaProvisioner(pool).ensurePatientsTable(SCHEMA);
    repository = new PatientsRepository(pool);
  });

  describe('insert', () => {
    it('persists a FHIR Patient resource as JSONB and returns it back', async () => {
      const id = randomUUID();
      const resource = {
        resourceType: 'Patient' as const,
        id,
        name: [{ family: 'Shepard', given: ['Jane'] }],
      };

      const created = await repository.insert(SCHEMA, id, resource);

      expect(created.id).toBe(id);
      expect(created.resource).toEqual(resource);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('findById', () => {
    it('returns null when no patient matches the id', async () => {
      await expect(
        repository.findById(SCHEMA, randomUUID()),
      ).resolves.toBeNull();
    });

    it('finds a patient previously inserted in the same schema', async () => {
      const id = randomUUID();
      const resource = {
        resourceType: 'Patient' as const,
        id,
        name: [{ family: 'Doe' }],
      };
      const created = await repository.insert(SCHEMA, id, resource);

      await expect(repository.findById(SCHEMA, id)).resolves.toEqual(created);
    });

    it('does not find a patient that only exists in a different schema (tenant isolation)', async () => {
      await pool.query('CREATE SCHEMA tenant_b');
      await new EmrSchemaProvisioner(pool).ensurePatientsTable('tenant_b');
      const id = randomUUID();
      await repository.insert('tenant_b', id, {
        resourceType: 'Patient',
        id,
        name: [{ family: 'Other' }],
      });

      await expect(repository.findById(SCHEMA, id)).resolves.toBeNull();
    });
  });
});
