import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FhirExceptionFilter } from './fhir-exception.filter';

function makeHost(): {
  host: ArgumentsHost;
  json: jest.Mock;
  status: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

describe('FhirExceptionFilter', () => {
  it('translates a BadRequestException (validation failure) into a 400 OperationOutcome (AC3)', () => {
    const filter = new FhirExceptionFilter();
    const { host, json, status } = makeHost();
    const exception = new BadRequestException([
      'name should not be empty',
      'resourceType must be one of the following values: Patient',
    ]);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'invalid',
          diagnostics:
            'name should not be empty; resourceType must be one of the following values: Patient',
        },
      ],
    });
  });

  it('translates a NotFoundException into a 404 OperationOutcome', () => {
    const filter = new FhirExceptionFilter();
    const { host, json, status } = makeHost();
    const exception = new NotFoundException('Patient "x" was not found.');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'not-found',
          diagnostics: 'Patient "x" was not found.',
        },
      ],
    });
  });

  it('translates a ForbiddenException into a 403 OperationOutcome', () => {
    const filter = new FhirExceptionFilter();
    const { host, json, status } = makeHost();
    const exception = new ForbiddenException('nope');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'OperationOutcome',
        issue: [
          expect.objectContaining({ severity: 'error', code: 'forbidden' }),
        ],
      }),
    );
  });

  it('reads a plain string response body as the diagnostics text', () => {
    const filter = new FhirExceptionFilter();
    const { host, json, status } = makeHost();
    const exception = new BadRequestException('plain string body');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        issue: [expect.objectContaining({ diagnostics: 'plain string body' })],
      }),
    );
  });

  it('falls back to exception.message when the response body has no message field', () => {
    const filter = new FhirExceptionFilter();
    const { host, json, status } = makeHost();
    const exception = new BadRequestException({
      custom: 'no message key here',
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        issue: [expect.objectContaining({ diagnostics: exception.message })],
      }),
    );
  });
});
