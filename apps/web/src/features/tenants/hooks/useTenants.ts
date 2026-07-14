"use client";

import { useQuery } from "@tanstack/react-query";
import { listTenants } from "@/src/lib/api/tenantsApi";

export const tenantsQueryKey = ["tenants"] as const;

/** BAC-12, AC3: fetches every tenant for the Super Admin console's tenant-list page. */
export function useTenants() {
  return useQuery({
    queryKey: tenantsQueryKey,
    queryFn: listTenants,
  });
}
