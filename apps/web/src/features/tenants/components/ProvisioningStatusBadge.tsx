import type { ProvisioningStepStatus } from "@hep/shared-types";

const STYLES: Record<ProvisioningStepStatus, string> = {
  succeeded: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-zinc-100 text-zinc-600",
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
      <span className="text-xs text-zinc-400">{label}: not applicable</span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {label}: {status}
    </span>
  );
}
