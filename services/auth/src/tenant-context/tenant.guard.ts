import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantsRepository } from '../tenants/tenants.repository';
import { TenantStatus } from '../tenants/tenant-status.enum';
import { RequestWithTenant } from './request-with-tenant.interface';
import { resolveTenantIdentifier } from './tenant-identifier.resolver';

/**
 * Resolves tenant context for every guarded auth route and rejects
 * unknown/inactive tenants before registration/login/refresh ever touches a
 * database connection.
 *
 * Decision (documented per BAC-5's instructions): unlike BAC-4's
 * tenants-service guard (404 unknown / 403 inactive), this guard returns a
 * uniform 401 for BOTH an unknown and an inactive tenant. Auth endpoints are
 * unauthenticated by definition, so leaking "this tenant doesn't exist" vs
 * "this tenant exists but is inactive" via the status code would let a
 * caller enumerate tenants; 401 is also consistent with AC3's requirement
 * that invalid credentials return a uniform error that reveals nothing about
 * *why* the request failed.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantsRepository: TenantsRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const identifier = resolveTenantIdentifier(request);

    if (!identifier) {
      throw new UnauthorizedException(
        'No tenant identifier supplied (X-Tenant-Id header).',
      );
    }

    const tenant = await this.tenantsRepository.findByIdentifier(identifier);
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      throw new UnauthorizedException('Unknown or inactive tenant.');
    }

    request.tenant = tenant;
    return true;
  }
}
