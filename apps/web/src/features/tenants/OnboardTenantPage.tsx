"use client";

import type { OnboardTenantRequest } from "@hep/shared-types";
import { RequireRole } from "@/src/components/auth/RequireRole";
import { useOnboardTenant } from "./hooks/useOnboardTenant";
import { OnboardTenantForm } from "./components/OnboardTenantForm";
import { ProvisioningResultCard } from "./components/ProvisioningResultCard";

/** BAC-12, AC1/AC2/AC4: Super Admin console's tenant onboarding form. */
export function OnboardTenantPage() {
  return (
    <RequireRole allow={["super_admin"]}>
      <OnboardTenantContent />
    </RequireRole>
  );
}

function OnboardTenantContent() {
  const mutation = useOnboardTenant();

  function handleSubmit(input: OnboardTenantRequest) {
    mutation.mutate(input);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <h1 className="text-xl font-semibold text-zinc-900">
        Onboard a tenant
      </h1>

      <OnboardTenantForm
        onSubmit={handleSubmit}
        isSubmitting={mutation.isPending}
      />

      {mutation.isError && (
        <p className="max-w-md text-sm text-red-700">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Could not onboard this tenant. Please try again."}
        </p>
      )}

      {mutation.isSuccess && (
        <ProvisioningResultCard result={mutation.data} />
      )}
    </div>
  );
}
