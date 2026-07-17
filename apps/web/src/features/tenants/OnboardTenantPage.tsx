"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { OnboardTenantRequest } from "@hep/shared-types";
import { RequireRole } from "@/src/components/auth/RequireRole";
import { ConsoleShell } from "@/src/components/layout/ConsoleShell";
import { useOnboardTenant } from "./hooks/useOnboardTenant";
import { OnboardTenantForm } from "./components/OnboardTenantForm";

/** BAC-12, AC1/AC2/AC4: Super Admin console's tenant onboarding form. */
export function OnboardTenantPage() {
  return (
    <RequireRole allow={["super_admin"]}>
      <ConsoleShell>
        <OnboardTenantContent />
      </ConsoleShell>
    </RequireRole>
  );
}

function OnboardTenantContent() {
  const router = useRouter();
  const mutation = useOnboardTenant();

  // Once the tenant is created, send the Super Admin to the list -- the new
  // tenant (and its per-step provisioning badges) is already in the list's
  // cache, since useOnboardTenant invalidates it on success.
  useEffect(() => {
    if (mutation.isSuccess) {
      router.push("/admin/tenants");
    }
  }, [mutation.isSuccess, router]);

  function handleSubmit(input: OnboardTenantRequest) {
    mutation.mutate(input);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Onboard a tenant
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates the clinic, seeds its first admin, and sends them an invite.
        </p>
      </div>

      <OnboardTenantForm
        onSubmit={handleSubmit}
        isSubmitting={mutation.isPending || mutation.isSuccess}
      />

      {mutation.isError && (
        <p className="max-w-md text-sm text-destructive">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Could not onboard this tenant. Please try again."}
        </p>
      )}
    </div>
  );
}
