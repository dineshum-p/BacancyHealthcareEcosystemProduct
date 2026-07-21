import { HttpNotificationServiceClient } from './http-notification-service.client';

describe('HttpNotificationServiceClient', () => {
  const config = {
    notificationServiceUrl: 'http://notification.internal',
    internalServiceKey: 'test-internal-service-key',
    requestTimeoutMs: 1000,
  };

  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = fetchMock;
  });

  it('POSTs to /notifications/internal with the confirmation template and interpolation data', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 } as Response);
    const client = new HttpNotificationServiceClient(config);

    const result = await client.sendAppointmentConfirmation(
      'tenant-1',
      'email',
      'patient@example.com',
      {
        id: 'appt-1',
        startTime: '2026-07-20T09:00:00.000Z',
        endTime: '2026-07-20T09:30:00.000Z',
      },
    );

    expect(result).toEqual({ outcome: 'succeeded' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://notification.internal/notifications/internal',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': 'tenant-1',
          'X-Internal-Service-Key': 'test-internal-service-key',
        },
        body: JSON.stringify({
          channel: 'email',
          to: 'patient@example.com',
          templateId: 'scheduling.appointment.confirmation',
          data: {
            appointmentId: 'appt-1',
            startTime: '2026-07-20T09:00:00.000Z',
            endTime: '2026-07-20T09:30:00.000Z',
          },
        }),
      }),
    );
  });

  it('returns a failed outcome with the error message when the response is non-2xx', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ message: 'Unknown template.' }),
    } as Response);
    const client = new HttpNotificationServiceClient(config);

    const result = await client.sendAppointmentConfirmation(
      'tenant-1',
      'sms',
      '+15551234567',
      { id: 'appt-1', startTime: 'x', endTime: 'y' },
    );

    expect(result).toEqual({ outcome: 'failed', error: 'Unknown template.' });
  });

  it('returns a failed outcome when the network call itself throws (service down)', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const client = new HttpNotificationServiceClient(config);

    const result = await client.sendAppointmentConfirmation(
      'tenant-1',
      'email',
      'patient@example.com',
      { id: 'appt-1', startTime: 'x', endTime: 'y' },
    );

    expect(result).toEqual({
      outcome: 'failed',
      error: 'connect ECONNREFUSED',
    });
  });
});
