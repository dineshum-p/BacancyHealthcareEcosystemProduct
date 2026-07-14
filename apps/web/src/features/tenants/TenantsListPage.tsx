"use client";

import Link from "next/link";
import { RequireRole } from "@/src/components/auth/RequireRole";
import { useTenants } from "./hooks/useTenants";
import { TenantsTable } from "./components/TenantsTable";

/** BAC-12, AC3/AC4: Super Admin console's tenant-list page. */
export function TenantsListPage() {
  return (
    <RequireRole allow={["super_admin"]}>
      <TenantsListContent />
    </RequireRole>
  );
}

function TenantsListContent() {
  const { data: tenants, isLoading, isError } = useTenants();

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Tenants</h1>
        <Link
          href="/admin/tenants/onboard"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Onboard tenant
        </Link>
      </div>

      {isLoading && <p className="text-sm text-zinc-600">Loading tenants…</p>}

      {isError && (
        <p className="text-sm text-red-700">
          Couldn&apos;t load tenants. Please try again.
        </p>
      )}

      {!isLoading && !isError && tenants && tenants.length === 0 && (
        <p className="text-sm text-zinc-600">
          No tenants yet. Onboard your first tenant to get started.
        </p>
      )}

      {!isLoading && !isError && tenants && tenants.length > 0 && (
        <TenantsTable tenants={tenants} />
      )}
    </div>
  );
}
