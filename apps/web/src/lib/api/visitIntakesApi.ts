import type {
  CreateVisitIntakeRequest,
  LinkVisitIntakeRequest,
  VisitIntakeStatus,
  VisitIntakeSummary,
} from "@hep/shared-types";
import { decodeAccessToken, getStoredAccessToken } from "../auth/session";
import { ApiError } from "./apiError";

/**
 * `services/scheduling`'s base URL (BAC-16/BAC-21/BAC-45), same service and
 * same dev-only fallback convention as `schedulingApi.ts`.
 */
const SCHEDULING_SERVICE_URL =
  process.env.NEXT_PUBLIC_SCHEDULING_SERVICE_URL ?? "http://localhost:3007";

/**
 * Builds the headers `services/scheduling`'s guarded visit-intake routes
 * require (BAC-45): a bearer access token (`AccessTokenGuard`) and the
 * calling user's own `X-Tenant-Id` (`TenantGuard`). Mirrors
 * `schedulingApi.ts`'s `buildAuthHeaders` exactly.
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

/**
 * Reads an error message off a Nest-shaped JSON error body, mirroring every
 * other `*Api.ts` module's `readErrorMessage` in this codebase.
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "message" in body) {
      const { message } = body as { message: unknown };
      if (typeof message === "string") {
        return message;
      }
      if (
        Array.isArray(message) &&
        message.every((entry) => typeof entry === "string")
      ) {
        return (message as string[]).join("; ");
      }
    }
  } catch {
    // fall through to the generic message below
  }
  return `Request failed with status ${response.status}`;
}

/**
 * Unlike `schedulingApi.ts`, this module's callers (`VisitIntakeDetailPage`,
 * BAC-47 AC3) need to tell a 403 apart from any other failure to render
 * `ForbiddenView` instead of a generic error -- so a non-ok response throws
 * {@link ApiError} (status + message), mirroring `patientProfileApi.ts`'s
 * exact convention.
 */
async function throwApiError(response: Response): Promise<never> {
  throw new ApiError(response.status, await readErrorMessage(response));
}

/**
 * `POST /visit-intakes` (BAC-45, AC1): a logged-in patient submits their own
 * intake ahead of a visit -- self-scoped server-side, `patientId` is never
 * sent from the client.
 */
export async function createVisitIntake(
  input: CreateVisitIntakeRequest,
): Promise<VisitIntakeSummary> {
  const headers = buildAuthHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${SCHEDULING_SERVICE_URL}/visit-intakes`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as VisitIntakeSummary;
}

/** `GET /visit-intakes` (BAC-45, AC2): the staff-facing, tenant-wide triage queue, optionally filtered by lifecycle status. */
export async function listVisitIntakes(
  status?: VisitIntakeStatus,
): Promise<VisitIntakeSummary[]> {
  const headers = buildAuthHeaders();
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const queryString = params.toString();
  const url = `${SCHEDULING_SERVICE_URL}/visit-intakes${queryString ? `?${queryString}` : ""}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as VisitIntakeSummary[];
}

/**
 * `GET /visit-intakes/:id` (BAC-45, AC3): a single intake. The submitting
 * patient and every staff-side role may always read it; a `provider` may
 * read it ONLY if they are the specific provider assigned to it -- a
 * mismatch 403s, surfaced here as {@link ApiError}.
 */
export async function getVisitIntake(id: string): Promise<VisitIntakeSummary> {
  const headers = buildAuthHeaders();
  const response = await fetch(
    `${SCHEDULING_SERVICE_URL}/visit-intakes/${encodeURIComponent(id)}`,
    { headers },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as VisitIntakeSummary;
}

/**
 * `PATCH /visit-intakes/:id/link` (BAC-45, AC3): staff associate a specific
 * provider + the BAC-16/21 appointment they just booked with a pending
 * intake. 400 if the appointment isn't `BOOKED` or the provider mismatches,
 * 409 if already linked -- both surfaced via `readErrorMessage`/`ApiError`.
 */
export async function linkVisitIntake(
  id: string,
  input: LinkVisitIntakeRequest,
): Promise<VisitIntakeSummary> {
  const headers = buildAuthHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(
    `${SCHEDULING_SERVICE_URL}/visit-intakes/${encodeURIComponent(id)}/link`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as VisitIntakeSummary;
}
