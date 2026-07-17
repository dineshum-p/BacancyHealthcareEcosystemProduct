import type {
  PaginatedPatientsResponse,
  PatientSearchQuery,
  PatientSummary,
  RegisterPatientRequest,
} from "@hep/shared-types";
import { decodeAccessToken, getStoredAccessToken } from "../auth/session";

/**
 * `services/patient`'s base URL (BAC-14/BAC-17). MUST be overridden outside
 * local dev via `NEXT_PUBLIC_PATIENT_SERVICE_URL` -- the fallback below
 * matches that service's assigned local port (`scripts/start-all-local.sh`),
 * mirroring `tenantsApi.ts`'s "dev-only fallback baked in" convention.
 */
const PATIENT_SERVICE_URL =
  process.env.NEXT_PUBLIC_PATIENT_SERVICE_URL ?? "http://localhost:3006";

/**
 * Builds the headers `services/patient`'s guarded routes require (BAC-14):
 * a bearer access token (`AccessTokenGuard`) and the calling user's own
 * `X-Tenant-Id` (`TenantGuard` -- resolved from the same token's `tenantId`
 * claim). Throws synchronously -- with no network call attempted -- when
 * there's no usable session, mirroring `tenantsApi.ts`'s `buildAuthHeaders`.
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
 * failures, e.g. `POST /patients`' `CreatePatientDto` -- AC3) -- an array is
 * joined into one string so callers can surface it as a single inline
 * message without losing any individual validation complaint.
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

/** `POST /patients` (BAC-14/BAC-17, AC1): registers a patient and returns the assigned MRN. */
export async function registerPatient(
  input: RegisterPatientRequest,
): Promise<PatientSummary> {
  const headers = buildAuthHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${PATIENT_SERVICE_URL}/patients`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PatientSummary;
}

/** Serializes only the query's defined fields -- every field is optional/combinable (BAC-14, AC3). */
function buildSearchParams(query: PatientSearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.name) params.set("name", query.name);
  if (query.mrn) params.set("mrn", query.mrn);
  if (query.dateOfBirth) params.set("dateOfBirth", query.dateOfBirth);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  return params;
}

/** `GET /patients` (BAC-14/BAC-17, AC2): tenant-scoped, paginated search by name/MRN/date of birth. */
export async function searchPatients(
  query: PatientSearchQuery,
): Promise<PaginatedPatientsResponse> {
  const headers = buildAuthHeaders();
  const params = buildSearchParams(query);
  const queryString = params.toString();
  const url = `${PATIENT_SERVICE_URL}/patients${queryString ? `?${queryString}` : ""}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PaginatedPatientsResponse;
}
