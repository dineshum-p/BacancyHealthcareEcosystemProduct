"use client";

import { useQuery } from "@tanstack/react-query";
import { listAuditLogs } from "@/src/lib/api/auditLogsApi";

/** Fetches one page of the caller's tenant's audit log (GET /audit-logs). */
export function useAuditLogs(page: number, limit: number) {
  return useQuery({
    queryKey: ["audit-logs", page, limit] as const,
    queryFn: () => listAuditLogs({ page, limit }),
  });
}
