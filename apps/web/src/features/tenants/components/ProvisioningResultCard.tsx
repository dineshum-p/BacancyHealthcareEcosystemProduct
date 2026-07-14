import type { OnboardTenantResponse } from "@hep/shared-types";
import { ProvisioningStatusBadge } from "./ProvisioningStatusBadge";

export interface ProvisioningResultCardProps {
  result: OnboardTenantResponse;
}

/**
 * Renders `POST /tenants/onboard`'s full result (BAC-12, AC1/AC2): the
 * tenant is always shown as onboarded/active even when `adminSeed`/`invite`
 * independently failed -- a 2xx response does NOT mean full success, so
 * this deliberately never collapses the result into a single generic
 * "success" toast; each step's real outcome (including its failure
 * message) is always visible.
 */
export function ProvisioningResultCard({
  result,
}: ProvisioningResultCardProps) {
  const { tenant, adminSeed, invite } = result;
  const hasPartialFailure =
    adminSeed.status !== "succeeded" || invite.status !== "succeeded";

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
      <div>
        <p className="text-sm font-semibold text-zinc-900">{tenant.name}</p>
        <p className="text-xs text-zinc-600">
          Tenant status: <span className="font-medium">{tenant.status}</span>
        </p>
      </div>

      {hasPartialFailure && (
        <p className="text-sm font-medium text-amber-700">
          Tenant provisioned, but onboarding completed with partial failures.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div>
          <ProvisioningStatusBadge
            label="Admin seed"
            status={adminSeed.status}
          />
          {adminSeed.message && (
            <p className="mt-1 text-xs text-zinc-600">{adminSeed.message}</p>
          )}
        </div>
        <div>
          <ProvisioningStatusBadge label="Invite" status={invite.status} />
          {invite.message && (
            <p className="mt-1 text-xs text-zinc-600">{invite.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
