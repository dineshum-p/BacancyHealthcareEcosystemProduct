"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OnboardTenantRequest } from "@hep/shared-types";
import { onboardTenant } from "@/src/lib/api/tenantsApi";
import { tenantsQueryKey } from "./useTenants";

/**
 * BAC-12, AC1/AC2: submits the onboarding form. A 2xx response is invalidated
 * into the tenant list's cache immediately (rather than waiting on the
 * list page's own poll/refetch) so a Super Admin who navigates to the list
 * right after onboarding sees the new tenant without a stale read -- but the
 * response itself (including `adminSeed`/`invite`'s per-step statuses) is
 * returned to the caller so the onboarding page can render the full
 * partial-failure result inline, without a redirect.
 */
export function useOnboardTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: OnboardTenantRequest) => onboardTenant(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tenantsQueryKey });
    },
  });
}
