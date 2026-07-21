/**
 * Extracts a human-readable error message from a non-2xx
 * `services/notification` response, falling back to the raw status line if
 * the body isn't the expected `{ message: string }` shape (or isn't JSON at
 * all). Mirrors `services/tenant`'s BAC-12
 * `onboarding/clients/read-error-message.util.ts` exactly.
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
