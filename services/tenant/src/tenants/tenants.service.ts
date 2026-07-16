import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantsRepository } from './tenants.repository';
import { TenantSchemaProvisioner } from './provisioning/tenant-schema-provisioner';
import { TenantStatus } from './tenant-status.enum';
import { Tenant } from './tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { deriveSchemaName } from './derive-schema-name.util';
import { SlugAlreadyExistsError } from './errors/slug-already-exists.error';

/**
 * Orchestrates tenant onboarding (BAC-3, AC1/AC2/AC3):
 *
 *   1. Reserve the slug by inserting the tenant row as `PENDING`.
 *   2. Provision its dedicated schema + baseline migrations.
 *   3. Flip the tenant to `ACTIVE` once provisioning succeeds.
 *
 * If step 2 fails, the tenant row is deliberately left `PENDING` rather than
 * rolled back or force-activated: the slug/id are already reserved (so a
 * retry with the same slug correctly 409s instead of silently duplicating
 * state), the tenant is inspectable via `GET /tenants/:id`, and
 * `TenantGuard` already treats `PENDING` as not-yet-usable (403), so a
 * half-provisioned tenant can never be used as if it were active. Retrying
 * provisioning for a stuck `PENDING` tenant is out of scope for this ticket.
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantsRepository: TenantsRepository,
    private readonly schemaProvisioner: TenantSchemaProvisioner,
  ) {}

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const schemaName = deriveSchemaName(dto.slug);

    let tenant: Tenant;
    try {
      tenant = await this.tenantsRepository.create({
        id: randomUUID(),
        slug: dto.slug,
        name: dto.name,
        plan: dto.plan,
        modules: dto.modules ?? [],
        status: TenantStatus.PENDING,
        schemaName,
        ownerEmail: dto.ownerEmail,
        // BAC-12: `null` here means "not applicable" -- only
        // `OnboardingService` (the `POST /tenants/onboard` orchestration)
        // ever writes a real provisioning-step outcome, via
        // `updateProvisioningResult`; the plain `POST /tenants` bootstrap
        // endpoint (this method) never seeds an admin or sends an invite.
        adminSeedStatus: null,
        inviteStatus: null,
      });
    } catch (error) {
      if (error instanceof SlugAlreadyExistsError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    // Left PENDING if this throws -- see class-level doc comment.
    await this.schemaProvisioner.provision(tenant.schemaName);

    const activated = await this.tenantsRepository.updateStatus(
      tenant.id,
      TenantStatus.ACTIVE,
    );
    return activated ?? { ...tenant, status: TenantStatus.ACTIVE };
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant "${id}" was not found.`);
    }
    return tenant;
  }

  /** BAC-12, AC3: every tenant, for the Super Admin console's tenant-list page. */
  async findAll(): Promise<Tenant[]> {
    return this.tenantsRepository.findAll();
  }
}
