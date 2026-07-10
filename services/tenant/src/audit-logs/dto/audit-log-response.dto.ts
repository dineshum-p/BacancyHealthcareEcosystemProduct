/** One entry in `GET /audit-logs`'s response body (BAC-8, AC7). */
export interface AuditLogResponseDto {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: unknown;
  after: unknown;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** `GET /audit-logs`'s full (paginated) response body. */
export interface PaginatedAuditLogsDto {
  items: AuditLogResponseDto[];
  page: number;
  limit: number;
  total: number;
}
