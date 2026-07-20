import type {
  CreateEncounterRequest,
  EncounterSummary,
} from "@hep/shared-types";
import { decodeAccessToken, getStoredAccessToken } from "../auth/session";

/**
 * `services/emr`'s base URL (BAC-15/BAC-20). MUST be overridden outside local
 * dev via `NEXT_PUBLIC_EMR_SERVICE_URL` -- the fallback below matches that
 * service's assigned local port (`scripts/start-all-local.sh`), mirroring
 * `patientsApi.ts`'s "dev-only fallback baked in" convention.
 */
const EMR_SERVICE_URL =
  process.env.NEXT_PUBLIC_EMR_SERVICE_URL ?? "http://localhost:3003";

/**
 * Builds the headers `services/emr`'s guarded encounter routes require
 * (BAC-15): a bearer access token (`AccessTokenGuard`) and the calling user's
 * own `X-Tenant-Id` (`TenantGuard` -- resolved from the same token's
 * `tenantId` claim). Throws synchronously -- with no network call
 * attempted -- when there's no usable session, mirroring `patientsApi.ts`'s
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
 * Reads an error message off a Nest-shaped JSON error body. `message` is
 * either a single string (most guard/service errors) or an array of strings
 * (the default shape `ValidationPipe` produces for `class-validator`
 * failures, e.g. `POST /patients/:patientId/encounters`' `CreateEncounterDto`
 * -- AC3) -- an array is joined into one string so callers can surface it as
 * a single inline message without losing any individual validation
 * complaint. Mirrors `patientsApi.ts`'s `readErrorMessage`.
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
 * `POST /patients/:patientId/encounters` (BAC-15/BAC-20, AC1): saves a
 * structured SOAP note, optional vitals, and an optional allergy list
 * against `patientId`, returning the created encounter.
 */
export async function createEncounter(
  patientId: string,
  input: CreateEncounterRequest,
): Promise<EncounterSummary> {
  const headers = buildAuthHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(
    `${EMR_SERVICE_URL}/patients/${patientId}/encounters`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as EncounterSummary;
}

/**
 * `GET /patients/:patientId/encounters` (BAC-15/BAC-20, AC2): the patient's
 * encounter history, most recent first.
 */
export async function listEncounters(
  patientId: string,
): Promise<EncounterSummary[]> {
  const headers = buildAuthHeaders();
  const response = await fetch(
    `${EMR_SERVICE_URL}/patients/${patientId}/encounters`,
    { headers },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as EncounterSummary[];
}
