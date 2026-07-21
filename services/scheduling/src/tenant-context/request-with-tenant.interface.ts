import { Request } from 'express';
import { Tenant } from '../tenants/tenant.entity';

/** Express request augmented by `TenantGuard` once a tenant is resolved. */
export interface RequestWithTenant extends Request {
  tenant?: Tenant;
}
