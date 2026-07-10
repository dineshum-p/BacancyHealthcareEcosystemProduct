import {
  buildOperationOutcome,
  issueCodeForStatus,
} from './fhir-operation-outcome.util';

describe('buildOperationOutcome', () => {
  it('wraps the given issues in a FHIR OperationOutcome resource', () => {
    expect(
      buildOperationOutcome([
        { severity: 'error', code: 'invalid', diagnostics: 'bad payload' },
      ]),
    ).toEqual({
      resourceType: 'OperationOutcome',
      issue: [
        { severity: 'error', code: 'invalid', diagnostics: 'bad payload' },
      ],
    });
  });

  it('falls back to a generic unknown issue when given an empty list', () => {
    expect(buildOperationOutcome([])).toEqual({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'unknown' }],
    });
  });
});

describe('issueCodeForStatus', () => {
  it.each([
    [400, 'invalid'],
    [401, 'login'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [500, 'exception'],
    [422, 'processing'],
  ])('maps HTTP status %i to FHIR issue code %s', (status, expected) => {
    expect(issueCodeForStatus(status)).toBe(expected);
  });
});
