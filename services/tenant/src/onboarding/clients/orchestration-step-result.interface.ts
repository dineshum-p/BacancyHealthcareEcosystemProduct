/**
 * Outcome of a single outbound orchestration call (BAC-12). `error` is a
 * short, human-readable diagnostic (never a full stack trace/raw exception)
 * -- surfaced in `POST /tenants/onboard`'s response so the Super Admin
 * console can show *something* actionable, but deliberately not persisted
 * verbatim onto the tenant row (only the `'succeeded' | 'failed'` outcome
 * is -- see `TenantsRepository.updateProvisioningResult`).
 */
export interface OrchestrationStepResult {
  outcome: 'succeeded' | 'failed';
  error?: string;
}
