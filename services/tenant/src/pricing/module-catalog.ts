import type { HepModule, PlanTier } from '@hep/shared-types';

/**
 * The authoritative fee schedule for HEP's modular subscription pricing
 * (PRD Section 6). This is the single source of truth for module fees; the
 * frontend never carries fee data -- it fetches computed quotes from
 * `GET /pricing/quote` (see `PricingController`).
 *
 * `onboardingFee` is the one-time first-time fee (PRD 6.1). `usage.rateFrom`/
 * `rateTo` are the per-unit charge across volume tiers (PRD 6.2): the rate
 * decreases as volume grows, so `rateTo <= rateFrom`.
 */
export interface ModuleCatalogEntry {
  module: HepModule;
  label: string;
  onboardingFee: number;
  reactivationFee: number;
  usageUnit: string;
  usageRateFrom: number;
  usageRateTo: number;
}

export const MODULE_CATALOG: Readonly<Record<HepModule, ModuleCatalogEntry>> = {
  clinic: {
    module: 'clinic',
    label: 'Clinic',
    onboardingFee: 5000,
    reactivationFee: 2000,
    usageUnit: 'e-prescription',
    usageRateFrom: 2.5,
    usageRateTo: 1.0,
  },
  pharmacy: {
    module: 'pharmacy',
    label: 'Pharmacy',
    onboardingFee: 4000,
    reactivationFee: 1600,
    usageUnit: 'dispensing bill',
    usageRateFrom: 3.0,
    usageRateTo: 1.5,
  },
  doctor: {
    module: 'doctor',
    label: 'Doctor',
    onboardingFee: 3000,
    reactivationFee: 1200,
    usageUnit: 'consultation note',
    usageRateFrom: 4.0,
    usageRateTo: 2.0,
  },
  insurance: {
    module: 'insurance',
    label: 'Insurance',
    onboardingFee: 8000,
    reactivationFee: 3200,
    usageUnit: 'claim adjudicated',
    usageRateFrom: 5.0,
    usageRateTo: 2.0,
  },
  patient_portal: {
    module: 'patient_portal',
    label: 'Patient Portal',
    onboardingFee: 2000,
    reactivationFee: 800,
    usageUnit: 'active patient / month',
    usageRateFrom: 0.5,
    usageRateTo: 0.2,
  },
};

/** All modules in a stable display order (matches PRD Section 3's listing). */
export const ALL_MODULES: readonly HepModule[] = [
  'clinic',
  'pharmacy',
  'doctor',
  'insurance',
  'patient_portal',
];

/** Flat monthly platform base fee per tier (PRD Section 6.2, "Platform base"). */
export const PLATFORM_BASE_FEES: Readonly<Record<PlanTier, number>> = {
  starter: 500,
  growth: 800,
  enterprise: 1200,
};

export const ALL_PLAN_TIERS: readonly PlanTier[] = [
  'starter',
  'growth',
  'enterprise',
];

/**
 * Multi-module discount on the combined one-time onboarding fee (PRD 6.1):
 * 2 modules = 5%, 3 = 10%, 4 = 15%, all 5 = 25%. A single module (or none)
 * gets no discount.
 */
export function multiModuleDiscountRate(moduleCount: number): number {
  switch (moduleCount) {
    case 2:
      return 0.05;
    case 3:
      return 0.1;
    case 4:
      return 0.15;
    case 5:
      return 0.25;
    default:
      return 0;
  }
}

export function isHepModule(value: string): value is HepModule {
  return (ALL_MODULES as readonly string[]).includes(value);
}

export function isPlanTier(value: string): value is PlanTier {
  return (ALL_PLAN_TIERS as readonly string[]).includes(value);
}
