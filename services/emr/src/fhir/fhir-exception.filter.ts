import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  buildOperationOutcome,
  issueCodeForStatus,
} from './fhir-operation-outcome.util';

/**
 * Translates EVERY `HttpException` raised anywhere in this service (thrown
 * by `ValidationPipe` on a malformed/non-R4-conformant payload, by
 * `TenantGuard`/`AccessTokenGuard`/`PermissionsGuard`, or by application
 * code) into a FHIR R4 `OperationOutcome` response body, instead of Nest's
 * generic `{ statusCode, message, error }` shape (BAC-10, AC3). Registered
 * globally in `main.ts` (`app.useGlobalFilters(...)`), so this ALSO applies
 * to BAC-15's plain-REST `/patients/:patientId/encounters` routes (added
 * after this filter's original "no non-FHIR routes" doc comment was
 * written): an error from those routes is still rendered as a FHIR
 * `OperationOutcome` body -- acceptable since no acceptance criterion in
 * either ticket depends on the error body's exact shape for those routes,
 * only on the HTTP status code.
 */
@Catch(HttpException)
export class FhirExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const outcome = buildOperationOutcome([
      {
        severity: status >= 500 ? 'fatal' : 'error',
        code: issueCodeForStatus(status),
        diagnostics: extractDiagnostics(exception),
      },
    ]);

    response.status(status).json(outcome);
  }
}

function extractDiagnostics(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return body;
  }
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = body.message;
    if (Array.isArray(message)) {
      return message.map(String).join('; ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return exception.message;
}
