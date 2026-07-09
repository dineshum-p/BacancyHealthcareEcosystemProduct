import { TenantStatus } from './tenant-status.enum';

/**
 * A row in the shared/public `tenants` registry table.
 *
 * This is the minimum provisioning primitive BAC-4 needs to resolve tenant
 * context; the full onboarding flow (plans, billing, etc.) is BAC-3's scope.
 */
export interface Tenant {
  id: string;
  slug: string;
  /** Human-readable display name supplied at onboarding time (BAC-3). */
  name: string;
  /** Subscription/billing plan identifier supplied at onboarding (BAC-3). */
  plan: string;
  status: TenantStatus;
  schemaName: string;
  /**
   * BAC-7: the single email address permitted to bootstrap this tenant's
   * `super_admin` in `services/auth`. `null` only for tenants that predate
   * this column (see the `1752105600000_add-tenant-owner-email` migration);
   * every tenant created via `CreateTenantDto` from now on always has one.
   */
  ownerEmail: string | null;
}
