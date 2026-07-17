"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequireRole } from "@/src/components/auth/RequireRole";
import { ConsoleShell } from "@/src/components/layout/ConsoleShell";
import { useAuditLogs } from "./hooks/useAuditLogs";

const PAGE_SIZE = 20;

/** Every recorded mutation for the caller's own tenant (GET /audit-logs), paginated. */
export function AuditLogsPage() {
  return (
    <RequireRole allow={["super_admin"]}>
      <ConsoleShell>
        <AuditLogsContent />
      </ConsoleShell>
    </RequireRole>
  );
}

function AuditLogsContent() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAuditLogs(page, PAGE_SIZE);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Audit log
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every recorded mutation for your tenant, most recent first.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading audit log…</p>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load the audit log. Please try again.
        </p>
      )}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No audited actions recorded yet.
        </p>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {entry.action}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {entry.resourceType}
                      {entry.resourceId ? `:${entry.resourceId}` : ""}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {entry.actorUserId ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {data.page} of {totalPages} · {data.total} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
