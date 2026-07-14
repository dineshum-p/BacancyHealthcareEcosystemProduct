import type { TenantSummary } from "@hep/shared-types";
import { ProvisioningStatusBadge } from "./ProvisioningStatusBadge";

export interface TenantsTableProps {
  tenants: TenantSummary[];
}

/** BAC-12, AC3: every tenant with its status and provisioning result. */
export function TenantsTable({ tenants }: TenantsTableProps) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
          <th className="py-2 pr-4 font-medium">Name</th>
          <th className="py-2 pr-4 font-medium">Slug</th>
          <th className="py-2 pr-4 font-medium">Plan</th>
          <th className="py-2 pr-4 font-medium">Status</th>
          <th className="py-2 pr-4 font-medium">Provisioning result</th>
        </tr>
      </thead>
      <tbody>
        {tenants.map((tenant) => (
          <tr key={tenant.id} className="border-b border-zinc-100">
            <td className="py-2 pr-4 font-medium text-zinc-900">
              {tenant.name}
            </td>
            <td className="py-2 pr-4 text-zinc-600">{tenant.slug}</td>
            <td className="py-2 pr-4 text-zinc-600">{tenant.plan}</td>
            <td className="py-2 pr-4 text-zinc-600">{tenant.status}</td>
            <td className="py-2 pr-4">
              <div className="flex flex-col gap-1">
                <ProvisioningStatusBadge
                  label="Admin seed"
                  status={tenant.adminSeedStatus}
                />
                <ProvisioningStatusBadge
                  label="Invite"
                  status={tenant.inviteStatus}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
