import { decodeAccessToken, getStoredAccessToken } from "../auth/session";

/**
 * `services/tenant`'s base URL -- same convention as `tenantsApi.ts`
 * (BAC-12): dev-only fallback matches that service's assigned local port,
 * overridable via `NEXT_PUBLIC_TENANT_SERVICE_URL`.
 */
const TENANT_SERVICE_URL =
  process.env.NEXT_PUBLIC_TENANT_SERVICE_URL ?? "http://localhost:3001";

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
}

export interface PaginatedAuditLogs {
  items: AuditLogEntry[];
  page: number;
  limit: number;
  total: number;
}

export interface ListAuditLogsInput {
  page?: number;
  limit?: number;
}

/** Mirrors `tenantsApi.ts`'s `buildAuthHeaders` exactly -- same guard chain (TenantGuard, AccessTokenGuard). */
function buildAuthHeaders(): Headers {
  const token = getStoredAccessToken();
  const claims = token ? decodeAccessToken(token) : null;
  if (!token || !claims) {
    throw new Error("Not authenticated: no access token is stored.");
  }

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-Tenant-Id", claims.tenantId);
  return headers;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
    ) {
      return (body as { message: string }).message;
    }
  } catch {
    // fall through to the generic message below
  }
  return `Request failed with status ${response.status}`;
}

/** `GET /audit-logs` (BAC-8, AC7): every mutation recorded for the caller's own tenant, paginated. */
export async function listAuditLogs(
  input: ListAuditLogsInput = {},
): Promise<PaginatedAuditLogs> {
  const headers = buildAuthHeaders();
  const params = new URLSearchParams();
  if (input.page) params.set("page", String(input.page));
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(
    `${TENANT_SERVICE_URL}/audit-logs${params.size ? `?${params}` : ""}`,
    { headers },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PaginatedAuditLogs;
}
