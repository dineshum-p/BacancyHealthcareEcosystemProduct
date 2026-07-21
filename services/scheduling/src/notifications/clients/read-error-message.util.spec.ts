import { readErrorMessage } from './read-error-message.util';

function makeResponse(options: {
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
}): Response {
  return {
    status: options.status ?? 500,
    statusText: options.statusText ?? 'Internal Server Error',
    json: options.json ?? (() => Promise.reject(new Error('not json'))),
  } as unknown as Response;
}

describe('readErrorMessage', () => {
  it('extracts the "message" field from a Nest-style error body', async () => {
    const response = makeResponse({
      json: () => Promise.resolve({ statusCode: 409, message: 'Conflict!' }),
    });

    await expect(readErrorMessage(response)).resolves.toBe('Conflict!');
  });

  it('falls back to the status line when the body has no "message" field', async () => {
    const response = makeResponse({
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ foo: 'bar' }),
    });

    await expect(readErrorMessage(response)).resolves.toBe(
      'HTTP 500 Internal Server Error',
    );
  });

  it('falls back to the status line when the body is not JSON', async () => {
    const response = makeResponse({
      status: 502,
      statusText: 'Bad Gateway',
      json: () => Promise.reject(new Error('Unexpected token')),
    });

    await expect(readErrorMessage(response)).resolves.toBe(
      'HTTP 502 Bad Gateway',
    );
  });

  it('falls back to the status line when message is not a string', async () => {
    const response = makeResponse({
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ message: 12345 }),
    });

    await expect(readErrorMessage(response)).resolves.toBe(
      'HTTP 400 Bad Request',
    );
  });
});
