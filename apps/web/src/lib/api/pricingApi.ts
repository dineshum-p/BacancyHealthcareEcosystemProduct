import type { HepModule, PlanTier, PricingQuote } from "@hep/shared-types";
import { decodeAccessToken, getStoredAccessToken } from "../auth/session";

/**
 * `services/tenant`'s base URL -- same convention as `tenantsApi.ts` (BAC-12):
 * dev-only fallback matches that service's assigned local port, overridable
 * via `NEXT_PUBLIC_TENANT_SERVICE_URL`.
 */
const TENANT_SERVICE_URL =
  process.env.NEXT_PUBLIC_TENANT_SERVICE_URL ?? "http://localhost:3001";

/** Mirrors `tenantsApi.ts`'s `buildAuthHeaders` -- the pricing route sits behind the same super_admin guard chain. */
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
    // fall through
  }
  return `Request failed with status ${response.status}`;
}

/**
 * `GET /tenants/pricing/quote` (PRD Section 6): the server-authoritative
 * subscription quote for a module selection + tier. The frontend never
 * computes fees itself -- it always asks the server, so the pricing shown is
 * always the same logic the tenant is actually billed against.
 */
export async function getPricingQuote(
  modules: HepModule[],
  planTier: PlanTier,
): Promise<PricingQuote> {
  const headers = buildAuthHeaders();
  const params = new URLSearchParams();
  params.set("modules", modules.join(","));
  params.set("planTier", planTier);

  const response = await fetch(
    `${TENANT_SERVICE_URL}/tenants/pricing/quote?${params}`,
    { headers },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PricingQuote;
}
