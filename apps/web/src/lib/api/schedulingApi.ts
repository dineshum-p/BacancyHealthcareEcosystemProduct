import type {
  AppointmentQuery,
  AppointmentSummary,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
} from "@hep/shared-types";
import { decodeAccessToken, getStoredAccessToken } from "../auth/session";

/**
 * `services/scheduling`'s base URL (BAC-16/BAC-21). MUST be overridden
 * outside local dev via `NEXT_PUBLIC_SCHEDULING_SERVICE_URL` -- the fallback
 * below is the next unused port after `services/patient`'s `3006`
 * (`scripts/start-all-local.sh`'s `name:port` list predates this service and
 * has not been updated for it), mirroring every other `*Api.ts`'s "dev-only
 * fallback baked in" convention.
 */
const SCHEDULING_SERVICE_URL =
  process.env.NEXT_PUBLIC_SCHEDULING_SERVICE_URL ?? "http://localhost:3007";

/**
 * Builds the headers `services/scheduling`'s guarded routes require
 * (BAC-16): a bearer access token (`AccessTokenGuard`) and the calling
 * user's own `X-Tenant-Id` (`TenantGuard` -- resolved from the same token's
 * `tenantId` claim). Throws synchronously -- with no network call attempted
 * -- when there's no usable session, mirroring `patientsApi.ts`'s
 * `buildAuthHeaders`.
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
 * Reads an error message off a Nest-shaped JSON error body -- a single
 * string (most guard/service errors, including the 409 conflict AC2 needs
 * surfaced inline) or an array of strings (`class-validator`'s default
 * `ValidationPipe` shape), mirroring `patientsApi.ts`'s `readErrorMessage`.
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
 * `POST /appointments` (BAC-16/BAC-21, AC1): books a slot for a patient with
 * a provider. Rejects with a 409 (surfaced via `readErrorMessage`) when the
 * slot is already booked (AC2) -- the caller is expected to catch this and
 * show it inline without discarding the form's entered values.
 */
export async function bookAppointment(
  input: CreateAppointmentRequest,
): Promise<AppointmentSummary> {
  const headers = buildAuthHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${SCHEDULING_SERVICE_URL}/appointments`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as AppointmentSummary;
}

/** Serializes only the query's defined fields -- `providerId` is omitted entirely for a `provider` caller (AC4/RBAC). */
function buildScheduleParams(query: AppointmentQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set("date", query.date);
  if (query.providerId) params.set("providerId", query.providerId);
  return params;
}

/** `GET /appointments` (BAC-16/BAC-21, AC4): a single calendar day's schedule, tenant- and RBAC-scoped server-side. */
export async function getDaySchedule(
  query: AppointmentQuery,
): Promise<AppointmentSummary[]> {
  const headers = buildAuthHeaders();
  const params = buildScheduleParams(query);
  const url = `${SCHEDULING_SERVICE_URL}/appointments?${params.toString()}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as AppointmentSummary[];
}

/** `PATCH /appointments/:id` (BAC-16/BAC-21, AC3): reschedules or cancels an existing appointment. */
export async function updateAppointment(
  id: string,
  input: UpdateAppointmentRequest,
): Promise<AppointmentSummary> {
  const headers = buildAuthHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(
    `${SCHEDULING_SERVICE_URL}/appointments/${id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as AppointmentSummary;
}
