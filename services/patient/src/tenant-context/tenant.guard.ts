import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantsRepository } from '../tenants/tenants.repository';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { RequestWithTenant } from './request-with-tenant.interface';
import { resolveTenantIdentifier } from './tenant-identifier.resolver';

/**
 * Resolves tenant context for every guarded route and rejects
 * unknown/inactive tenants before any handler or repository ever touches a
 * database connection. Mirrors `services/tenant`'s `TenantGuard` (BAC-4)
 * exactly, including its 404 (unknown)/403 (inactive) split -- the same
 * convention `services/notification`/`services/emr`/`services/billing`
 * already reused for their own authenticated, internal-platform routes.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantsRepository: TenantsRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const identifier = resolveTenantIdentifier(request);

    if (!identifier) {
      throw new NotFoundException(
        'No tenant identifier supplied (X-Tenant-Id header or subdomain).',
      );
    }

    const tenant = await this.tenantsRepository.findByIdentifier(identifier);
    if (!tenant) {
      throw new NotFoundException(`Tenant "${identifier}" was not found.`);
    }

    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new ForbiddenException(`Tenant "${identifier}" is inactive.`);
    }

    request.tenant = tenant;
    return true;
  }
}
