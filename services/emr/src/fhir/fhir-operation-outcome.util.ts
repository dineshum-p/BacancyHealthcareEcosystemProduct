import type {
  FhirOperationOutcome,
  FhirOperationOutcomeIssue,
} from '@hep/shared-types';

/**
 * Builds a FHIR R4 `OperationOutcome` resource (BAC-10, AC3): the shape
 * every `/fhir/*` error response uses instead of a generic Nest/HTTP error
 * body, so FHIR clients can parse an error the same way they parse any
 * other resource this gateway returns.
 */
export function buildOperationOutcome(
  issues: FhirOperationOutcomeIssue[],
): FhirOperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue:
      issues.length > 0 ? issues : [{ severity: 'error', code: 'unknown' }],
  };
}

/**
 * Maps an HTTP status code to a FHIR `IssueType` code (a small, well-known
 * vocabulary -- see https://hl7.org/fhir/R4/valueset-issue-type.html --
 * deliberately only the subset this gateway's own error paths can produce).
 */
export function issueCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'invalid';
    case 401:
      return 'login';
    case 403:
      return 'forbidden';
    case 404:
      return 'not-found';
    default:
      return status >= 500 ? 'exception' : 'processing';
  }
}
