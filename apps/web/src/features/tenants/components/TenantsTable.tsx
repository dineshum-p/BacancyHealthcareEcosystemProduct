import type { HepModule, TenantSummary } from "@hep/shared-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MODULE_OPTIONS } from "../moduleOptions";
import { ProvisioningStatusBadge } from "./ProvisioningStatusBadge";

const MODULE_LABEL: Record<HepModule, string> = Object.fromEntries(
  MODULE_OPTIONS.map((option) => [option.module, option.label]),
) as Record<HepModule, string>;

export interface TenantsTableProps {
  tenants: TenantSummary[];
}

/** BAC-12, AC3: every tenant with its status and provisioning result. */
export function TenantsTable({ tenants }: TenantsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Modules</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Provisioning result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants.map((tenant) => (
          <TableRow key={tenant.id}>
            <TableCell className="font-medium text-foreground">
              {tenant.name}
            </TableCell>
            <TableCell className="font-mono text-muted-foreground">
              {tenant.slug}
            </TableCell>
            <TableCell className="text-muted-foreground">{tenant.plan}</TableCell>
            <TableCell>
              {tenant.modules.length === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {tenant.modules.map((module) => (
                    <Badge key={module} variant="secondary" className="font-normal">
                      {MODULE_LABEL[module] ?? module}
                    </Badge>
                  ))}
                </div>
              )}
            </TableCell>
            <TableCell>
              <span
                className="inline-flex items-center gap-1.5 text-foreground"
              >
                <span
                  className={
                    "size-1.5 shrink-0 rounded-full " +
                    (tenant.status === "active"
                      ? "bg-success"
                      : tenant.status === "pending"
                        ? "bg-pending"
                        : "bg-muted-foreground/50")
                  }
                  aria-hidden
                />
                {tenant.status}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex flex-col items-start gap-1.5">
                <ProvisioningStatusBadge
                  label="Admin seed"
                  status={tenant.adminSeedStatus}
                />
                <ProvisioningStatusBadge
                  label="Invite"
                  status={tenant.inviteStatus}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
