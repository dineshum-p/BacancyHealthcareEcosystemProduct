import type { ProvisioningStepStatus } from "@hep/shared-types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VARIANT: Record<ProvisioningStepStatus, "success" | "destructive" | "neutral"> = {
  succeeded: "success",
  failed: "destructive",
  skipped: "neutral",
};

const DOT_COLOR: Record<ProvisioningStepStatus, string> = {
  succeeded: "bg-success",
  failed: "bg-destructive",
  skipped: "bg-muted-foreground/50",
};

export interface ProvisioningStatusBadgeProps {
  /** The step's label, e.g. "Admin seed" or "Invite". */
  label: string;
  status: ProvisioningStepStatus | null;
}

/**
 * Renders one onboarding step's outcome (BAC-12, AC2/AC3): `null` means the
 * tenant was never onboarded via `POST /tenants/onboard` (see
 * `TenantSummary`'s doc comment), so there is no result to report.
 */
export function ProvisioningStatusBadge({
  label,
  status,
}: ProvisioningStatusBadgeProps) {
  if (!status) {
    return (
      <span className="text-xs text-muted-foreground">{label}: not applicable</span>
    );
  }

  return (
    <Badge variant={VARIANT[status]} className="font-mono font-normal">
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_COLOR[status])} aria-hidden />
      {label}: {status}
    </Badge>
  );
}
