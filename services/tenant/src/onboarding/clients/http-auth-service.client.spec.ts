import { HttpAuthServiceClient } from './http-auth-service.client';

describe('HttpAuthServiceClient', () => {
  const config = {
    authServiceUrl: 'http://auth.internal',
    notificationServiceUrl: 'http://notification.internal',
    internalServiceKey: 'test-internal-service-key',
    requestTimeoutMs: 1000,
  };

  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = fetchMock;
  });

  it('POSTs to /auth/admin-seed with the tenant id, internal key, and email', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 } as Response);
    const client = new HttpAuthServiceClient(config);

    const result = await client.seedClinicAdmin(
      'tenant-1',
      'admin@example.com',
    );

    expect(result).toEqual({ outcome: 'succeeded' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://auth.internal/auth/admin-seed',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': 'tenant-1',
          'X-Internal-Service-Key': 'test-internal-service-key',
        },
        body: JSON.stringify({ email: 'admin@example.com' }),
      }),
    );
  });

  it('returns a failed outcome with the error message when the response is non-2xx', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: () => Promise.resolve({ message: 'Email already registered.' }),
    } as Response);
    const client = new HttpAuthServiceClient(config);

    const result = await client.seedClinicAdmin(
      'tenant-1',
      'admin@example.com',
    );

    expect(result).toEqual({
      outcome: 'failed',
      error: 'Email already registered.',
    });
  });

  it('returns a failed outcome when the network call itself throws (service down)', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const client = new HttpAuthServiceClient(config);

    const result = await client.seedClinicAdmin(
      'tenant-1',
      'admin@example.com',
    );

    expect(result).toEqual({
      outcome: 'failed',
      error: 'connect ECONNREFUSED',
    });
  });

  it('returns a failed outcome when the call times out (a thrown non-Error)', async () => {
    fetchMock.mockRejectedValue('timed out');
    const client = new HttpAuthServiceClient(config);

    const result = await client.seedClinicAdmin(
      'tenant-1',
      'admin@example.com',
    );

    expect(result).toEqual({ outcome: 'failed', error: 'timed out' });
  });
});
