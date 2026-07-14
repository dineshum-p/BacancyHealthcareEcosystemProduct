/**
 * Best-effort extraction of a short, human-readable error message from a
 * non-2xx HTTP response returned by a sibling service (BAC-12). Every
 * service in this repo returns Nest's default exception-filter body
 * (`{ statusCode, message, error }`) for a thrown `HttpException`, so this
 * prefers `message`; falls back to the raw status text if the body isn't
 * JSON-shaped as expected, and never throws (a malformed error body must
 * never itself become an unhandled rejection during orchestration).
 */
export async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
    ) {
      return (body as { message: string }).message;
    }
  } catch {
    // Body wasn't JSON (or was empty) -- fall through to the status line.
  }
  return `HTTP ${response.status} ${response.statusText}`.trim();
}
