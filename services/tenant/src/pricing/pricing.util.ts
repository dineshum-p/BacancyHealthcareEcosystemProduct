import type {
  HepModule,
  PlanTier,
  PricingLineItem,
  PricingQuote,
} from '@hep/shared-types';
import {
  ALL_MODULES,
  MODULE_CATALOG,
  PLATFORM_BASE_FEES,
  multiModuleDiscountRate,
} from './module-catalog';

/**
 * Computes a subscription quote for a module selection + tier (PRD Section 6).
 * Pure and deterministic -- the same inputs always produce the same quote, so
 * a persisted `(modules, plan)` pair is always re-quotable.
 *
 * Rules (PRD 6.1/6.2):
 *  - One-time onboarding total = sum of each selected module's onboarding fee,
 *    minus the multi-module discount (which applies to the onboarding subtotal
 *    ONLY -- never the monthly fee or usage rates).
 *  - Monthly platform fee is a flat per-tier charge, independent of modules.
 *  - Usage rates are reported per module for transparency but cannot be
 *    totalled here (they depend on actual usage volume, unknown at quote time).
 *
 * Modules are de-duplicated and returned in the canonical `ALL_MODULES` order
 * so the quote is stable regardless of the caller's input ordering.
 */
export function computePricingQuote(
  modules: HepModule[],
  planTier: PlanTier,
): PricingQuote {
  const selected = ALL_MODULES.filter((module) => modules.includes(module));

  const lineItems: PricingLineItem[] = selected.map((module) => {
    const entry = MODULE_CATALOG[module];
    return {
      module: entry.module,
      label: entry.label,
      onboardingFee: entry.onboardingFee,
      usageUnit: entry.usageUnit,
      usageRateFrom: entry.usageRateFrom,
      usageRateTo: entry.usageRateTo,
    };
  });

  const onboardingSubtotal = lineItems.reduce(
    (sum, item) => sum + item.onboardingFee,
    0,
  );
  const discountRate = multiModuleDiscountRate(selected.length);
  const discountAmount = Math.round(onboardingSubtotal * discountRate);
  const onboardingTotal = onboardingSubtotal - discountAmount;

  return {
    modules: selected,
    planTier,
    lineItems,
    onboardingSubtotal,
    discountRate,
    discountAmount,
    onboardingTotal,
    monthlyPlatformFee: PLATFORM_BASE_FEES[planTier],
  };
}
