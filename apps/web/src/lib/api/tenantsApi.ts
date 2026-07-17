import type {
  OnboardTenantRequest,
  OnboardTenantResponse,
  TenantSummary,
} from "@hep/shared-types";
import { decodeAccessToken, getStoredAccessToken } from "../auth/session";

/**
 * `services/tenant`'s base URL (BAC-12). MUST be overridden outside local
 * dev via `NEXT_PUBLIC_TENANT_SERVICE_URL` -- the fallback below matches
 * that service's assigned local port (`scripts/start-all-local.sh`; apps/web
 * itself owns port 3000), mirroring every backend service's `.env.example`
 * "dev-only fallback baked in" convention.
 */
const TENANT_SERVICE_URL =
  process.env.NEXT_PUBLIC_TENANT_SERVICE_URL ?? "http://localhost:3001";

/**
 * Builds the headers `services/tenant`'s Super Admin routes require
 * (BAC-12): a bearer access token (`AccessTokenGuard`) and the CALLING
 * Super Admin's own `X-Tenant-Id` (`TenantGuard` -- resolved from the same
 * token's `tenantId` claim, since the caller is always acting within their
 * own tenant when onboarding a new one). Throws synchronously -- with no
 * network call attempted -- when there's no usable session, since that can
 * never succeed against a guarded route anyway (AC4).
 */
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

/** Reads `message` off a Nest-shaped JSON error body, falling back to the HTTP status text. */
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

/** `GET /tenants` (BAC-12, AC3): every tenant, for the Super Admin console's tenant-list page. */
export async function listTenants(): Promise<TenantSummary[]> {
  const headers = buildAuthHeaders();
  const response = await fetch(`${TENANT_SERVICE_URL}/tenants`, { headers });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as TenantSummary[];
}

/** `POST /tenants/onboard` (BAC-12, AC1/AC2): provisions a tenant, seeds its admin, and queues an invite. */
export async function onboardTenant(
  input: OnboardTenantRequest,
): Promise<OnboardTenantResponse> {
  const headers = buildAuthHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${TENANT_SERVICE_URL}/tenants/onboard`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as OnboardTenantResponse;
}
