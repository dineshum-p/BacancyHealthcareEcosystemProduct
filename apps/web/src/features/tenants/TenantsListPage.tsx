"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { RequireRole } from "@/src/components/auth/RequireRole";
import { ConsoleShell } from "@/src/components/layout/ConsoleShell";
import { useTenants } from "./hooks/useTenants";
import { TenantsTable } from "./components/TenantsTable";

/** BAC-12, AC3/AC4: Super Admin console's tenant-list page. */
export function TenantsListPage() {
  return (
    <RequireRole allow={["super_admin"]}>
      <ConsoleShell>
        <TenantsListContent />
      </ConsoleShell>
    </RequireRole>
  );
}

function TenantsListContent() {
  const { data: tenants, isLoading, isError } = useTenants();

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Tenants
        </h1>
        <Link
          href="/admin/tenants/onboard"
          className={buttonVariants({ variant: "default" })}
        >
          Onboard tenant
        </Link>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading tenants…</p>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load tenants. Please try again.
        </p>
      )}

      {!isLoading && !isError && tenants && tenants.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No tenants yet. Onboard your first tenant to get started.
        </p>
      )}

      {!isLoading && !isError && tenants && tenants.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/70">
          <TenantsTable tenants={tenants} />
        </div>
      )}
    </div>
  );
}
