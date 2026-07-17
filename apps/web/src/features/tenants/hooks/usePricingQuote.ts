"use client";

import { useQuery } from "@tanstack/react-query";
import type { HepModule, PlanTier } from "@hep/shared-types";
import { getPricingQuote } from "@/src/lib/api/pricingApi";

/**
 * Live subscription quote for the onboarding form's current module + tier
 * selection (PRD Section 6). Keyed by the selection so TanStack Query caches
 * each combination; disabled until at least one module is picked (the quote
 * endpoint requires a non-empty selection).
 */
export function usePricingQuote(modules: HepModule[], planTier: PlanTier) {
  // Sort so ['clinic','pharmacy'] and ['pharmacy','clinic'] share a cache key.
  const key = [...modules].sort().join(",");
  return useQuery({
    queryKey: ["pricing-quote", key, planTier] as const,
    queryFn: () => getPricingQuote(modules, planTier),
    enabled: modules.length > 0,
  });
}
