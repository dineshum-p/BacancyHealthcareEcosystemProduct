"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OnboardTenantRequest } from "@hep/shared-types";
import { onboardTenant } from "@/src/lib/api/tenantsApi";
import { tenantsQueryKey } from "./useTenants";

/**
 * BAC-12, AC1/AC2: submits the onboarding form. A 2xx response is invalidated
 * into the tenant list's cache immediately (rather than waiting on the
 * list page's own poll/refetch) so the Super Admin -- who is redirected to
 * the list on success -- sees the new tenant (and its per-step provisioning
 * badges) without a stale read. The response, including `adminSeed`/`invite`
 * statuses, is still returned to the caller for any inline handling.
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
