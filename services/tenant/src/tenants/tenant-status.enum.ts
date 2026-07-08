export enum TenantStatus {
  /**
   * BAC-3: the tenant row has been created (unique id/slug reserved) but
   * schema provisioning has not yet completed successfully. `TenantGuard`
   * treats `PENDING` the same as `INACTIVE` (not usable yet) so BAC-4's
   * 404/403 contract for tenant-guarded routes is unchanged.
   */
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
