/**
 * BAC-46: a fetch-backed API client that needs callers (hooks/pages) to
 * branch on the HTTP status of a failed request -- not just its message --
 * throws this instead of a bare `Error`. `patientProfileApi.ts` is the first
 * caller: AC3 needs to tell "the server said 403 Forbidden" apart from any
 * other failure so `PatientProfilePage` can render `ForbiddenView` instead of
 * a generic error message. Every existing `*Api.ts` module in this codebase
 * (e.g. `encountersApi.ts`, `patientsApi.ts`) throws a plain `Error` with only
 * a human-readable message and no status code -- this is additive, not a
 * change to those.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** `true` for any error carrying an HTTP 403 (Forbidden) status. */
export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
