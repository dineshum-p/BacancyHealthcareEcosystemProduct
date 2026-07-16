import type { OnboardTenantResponse } from "@hep/shared-types";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card className="max-w-md border-border/70">
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="font-heading text-base font-semibold text-foreground">
            {tenant.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Tenant status:{" "}
            <span className="font-mono font-medium text-foreground">
              {tenant.status}
            </span>
          </p>
        </div>

        {hasPartialFailure && (
          <p className="rounded-md bg-pending/10 px-3 py-2 text-sm font-medium text-pending">
            Tenant provisioned, but onboarding completed with partial failures.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-start gap-1">
            <ProvisioningStatusBadge
              label="Admin seed"
              status={adminSeed.status}
            />
            {adminSeed.message && (
              <p className="text-xs text-muted-foreground">{adminSeed.message}</p>
            )}
          </div>
          <div className="flex flex-col items-start gap-1">
            <ProvisioningStatusBadge label="Invite" status={invite.status} />
            {invite.message && (
              <p className="text-xs text-muted-foreground">{invite.message}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
