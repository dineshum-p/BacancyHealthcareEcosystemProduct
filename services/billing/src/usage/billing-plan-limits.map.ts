import type { MeteredMetric } from '@hep/shared-types';

export type PlanLimits = Readonly<Record<MeteredMetric, number>>;

/**
 * BAC-11, AC4: the metered-usage limits each tenant `plan` (a free-text
 * value supplied at onboarding time -- see `services/tenant`'s
 * `CreateTenantDto.plan`; there is no fixed plan enum anywhere else in this
 * repo) grants for each metric this service tracks. Keyed by the plan
 * identifier, lower-cased, so lookups are resilient to how the value was
 * originally cased at onboarding.
 *
 * These specific limit values are a reasonable, documented starting point
 * for MVP/Phase-0 billing metering (see `docs/HEP_ARCHITECTURE.md`), not a
 * value handed down by product -- a future ticket standing up real plan
 * configuration (e.g. an admin-editable `public.billing_plans` table) can
 * supersede this static map without changing `UsageService`'s contract.
 */
const PLAN_LIMITS: Readonly<Record<string, PlanLimits>> = {
  starter: { 'patient.created': 100, 'encounter.created': 250 },
  growth: { 'patient.created': 1000, 'encounter.created': 2500 },
  enterprise: { 'patient.created': 100_000, 'encounter.created': 250_000 },
};

/**
 * Applied whenever a tenant's `plan` value doesn't match a known key above
 * (including the common case of a blank/never-set `plan`, per
 * `services/tenant`'s own migration default) -- the same fail-safe,
 * least-generous default `starter` grants, rather than either crashing or
 * silently granting an unlimited quota to an unrecognized plan string.
 */
const DEFAULT_PLAN_LIMITS: PlanLimits = PLAN_LIMITS.starter;

/** Resolves the full set of metric limits for a tenant's plan (BAC-11, AC4). */
export function getLimitsForPlan(plan: string): PlanLimits {
  return PLAN_LIMITS[plan.trim().toLowerCase()] ?? DEFAULT_PLAN_LIMITS;
}

/**
 * Resolves a single metric's limit for a tenant's plan. `PlanLimits`
 * (`Record<MeteredMetric, number>`) requires every plan entry above to
 * define every metric at compile time, so this never actually returns
 * `null` today -- the `?? null` fallback exists only so `UsageService`
 * doesn't need to special-case a future metric added to
 * `@hep/shared-types`' `MeteredMetric` union before `PLAN_LIMITS` is
 * updated to match.
 */
export function getLimitForMetric(
  plan: string,
  metric: MeteredMetric,
): number | null {
  const limits = getLimitsForPlan(plan);
  return limits[metric] ?? null;
}
