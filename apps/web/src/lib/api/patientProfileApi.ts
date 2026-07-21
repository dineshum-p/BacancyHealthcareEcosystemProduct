import type {
  PatientProfileResponse,
  UpsertPatientProfileRequest,
} from "@hep/shared-types";
import { decodeAccessToken, getStoredAccessToken } from "../auth/session";
import { ApiError } from "./apiError";

/**
 * `services/emr`'s base URL (BAC-44/BAC-46). MUST be overridden outside local
 * dev via `NEXT_PUBLIC_EMR_SERVICE_URL` -- mirrors `encountersApi.ts`'s
 * "dev-only fallback baked in" convention (same backing service).
 */
const EMR_SERVICE_URL =
  process.env.NEXT_PUBLIC_EMR_SERVICE_URL ?? "http://localhost:3003";

/**
 * Builds the headers `services/emr`'s guarded profile routes require
 * (BAC-44): a bearer access token (`AccessTokenGuard`) and the calling user's
 * own `X-Tenant-Id` (`TenantGuard`). Throws synchronously -- with no network
 * call attempted -- when there's no usable session, mirroring
 * `encountersApi.ts`'s `buildAuthHeaders`.
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
 * Reads an error message off a Nest-shaped JSON error body, mirroring
 * `encountersApi.ts`'s `readErrorMessage` exactly (`message` is either a
 * single string or an array of `class-validator` strings).
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
 * Unlike every other `*Api.ts` module in this codebase, this one's callers
 * (`PatientProfilePage`, BAC-46 AC3) need to tell a 403 apart from any other
 * failure to render `ForbiddenView` instead of a generic error -- so a
 * non-ok response throws {@link ApiError} (status + message), not a bare
 * `Error`.
 */
async function throwApiError(response: Response): Promise<never> {
  throw new ApiError(response.status, await readErrorMessage(response));
}

/**
 * `GET /patients/:patientId/profile` (BAC-44/BAC-46, AC1): the patient's
 * baseline profile, or the well-formed `hasProfile: false` empty shape if
 * none has ever been saved. `patientId` must be the CALLER's own id for a
 * `patient`-role session (`PatientProfilePage` resolves it from
 * `useCurrentUser`, never from a URL param) -- the server independently
 * re-enforces this (`assertPatientScope`) and 403s any mismatch.
 */
export async function getMyPatientProfile(
  patientId: string,
): Promise<PatientProfileResponse> {
  const headers = buildAuthHeaders();
  const response = await fetch(
    `${EMR_SERVICE_URL}/patients/${patientId}/profile`,
    { headers },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as PatientProfileResponse;
}

/**
 * `PUT /patients/:patientId/profile` (BAC-44/BAC-46, AC2): full-replace
 * upsert of the patient's baseline profile (allergies/chronic conditions/
 * long-term medications). Returns the saved `PatientProfileResponse`
 * (`hasProfile: true`), which callers use directly as the new source of
 * truth rather than re-deriving it from the submitted form values.
 */
export async function upsertMyPatientProfile(
  patientId: string,
  input: UpsertPatientProfileRequest,
): Promise<PatientProfileResponse> {
  const headers = buildAuthHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(
    `${EMR_SERVICE_URL}/patients/${patientId}/profile`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as PatientProfileResponse;
}
