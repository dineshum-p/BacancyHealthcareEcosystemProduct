import type {
  PatientSelfRegistrationStatus,
  PatientSelfRegistrationSummary,
  SelfRegisterPatientRequest,
  SelfRegistrationReceipt,
} from "@hep/shared-types";
import { decodeAccessToken, getStoredAccessToken } from "../auth/session";

/**
 * `services/patient`'s base URL (BAC-14/BAC-17/BAC-36/BAC-37) -- same
 * service, same dev-only fallback convention as `patientsApi.ts`.
 */
const PATIENT_SERVICE_URL =
  process.env.NEXT_PUBLIC_PATIENT_SERVICE_URL ?? "http://localhost:3006";

/**
 * Builds the auth headers `services/patient`'s STAFF-facing self-registration
 * review routes require (BAC-37: `GET /patients/self-registrations` and the
 * approve/reject/merge actions) -- same convention as `patientsApi.ts`'s
 * `buildAuthHeaders`. Deliberately NOT used by {@link submitSelfRegistration}:
 * that call hits the PUBLIC, unauthenticated `POST
 * /public/tenants/:tenantSlug/patients` endpoint, which has no session to
 * build headers from at all.
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

/** Reads `message` off a Nest-shaped JSON error body (single string or an array of strings), falling back to the HTTP status. */
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
 * `POST /public/tenants/:tenantSlug/patients` (BAC-36/BAC-37): a patient
 * submitting their own registration, with NO session/auth headers at all --
 * the public route resolves its tenant purely from `tenantSlug` in the URL
 * (see `services/patient`'s `resolveTenantIdentifier`).
 */
export async function submitSelfRegistration(
  tenantSlug: string,
  input: SelfRegisterPatientRequest,
): Promise<SelfRegistrationReceipt> {
  const response = await fetch(
    `${PATIENT_SERVICE_URL}/public/tenants/${encodeURIComponent(tenantSlug)}/patients`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as SelfRegistrationReceipt;
}

/** `GET /patients/self-registrations` (BAC-37): the staff-facing review queue, optionally filtered by lifecycle status (`?status=pending` for the pending queue). */
export async function listSelfRegistrations(
  status?: PatientSelfRegistrationStatus,
): Promise<PatientSelfRegistrationSummary[]> {
  const headers = buildAuthHeaders();
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const queryString = params.toString();
  const url = `${PATIENT_SERVICE_URL}/patients/self-registrations${queryString ? `?${queryString}` : ""}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PatientSelfRegistrationSummary[];
}

/** `POST /patients/self-registrations/:id/approve` (BAC-37): confirms a genuinely new patient, assigning it a real MRN. */
export async function approveSelfRegistration(
  id: string,
): Promise<PatientSelfRegistrationSummary> {
  const headers = buildAuthHeaders();
  const response = await fetch(
    `${PATIENT_SERVICE_URL}/patients/self-registrations/${encodeURIComponent(id)}/approve`,
    { method: "POST", headers },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PatientSelfRegistrationSummary;
}

/** `POST /patients/self-registrations/:id/reject` (BAC-37): the submission is not legitimate; it never becomes a `patients` row. */
export async function rejectSelfRegistration(
  id: string,
  reason?: string,
): Promise<PatientSelfRegistrationSummary> {
  const headers = buildAuthHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(
    `${PATIENT_SERVICE_URL}/patients/self-registrations/${encodeURIComponent(id)}/reject`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PatientSelfRegistrationSummary;
}

/** `POST /patients/self-registrations/:id/merge` (BAC-37): links the submission to an existing patient instead of creating a new, disconnected record. */
export async function mergeSelfRegistration(
  id: string,
  targetPatientId: string,
): Promise<PatientSelfRegistrationSummary> {
  const headers = buildAuthHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(
    `${PATIENT_SERVICE_URL}/patients/self-registrations/${encodeURIComponent(id)}/merge`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ targetPatientId }),
    },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PatientSelfRegistrationSummary;
}
