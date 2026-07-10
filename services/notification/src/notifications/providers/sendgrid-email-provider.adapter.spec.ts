import { SendGridEmailProviderAdapter } from './sendgrid-email-provider.adapter';

/**
 * NEVER calls the real SendGrid API -- `fetch` is always an injected jest
 * mock, same rationale as `twilio-sms-provider.adapter.spec.ts`.
 */
describe('SendGridEmailProviderAdapter', () => {
  const config = { apiKey: 'SG.test-key', fromEmail: 'noreply@example.com' };

  it('POSTs to the SendGrid mail/send endpoint with a Bearer token and JSON body', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      headers: { get: () => 'sg-message-id-123' },
      json: () => Promise.resolve({}),
    });
    const adapter = new SendGridEmailProviderAdapter(config, fetchMock);

    const outcome = await adapter.send('email', 'user@example.com', {
      subject: 'Hello',
      body: 'World',
    });

    expect(outcome).toEqual({
      outcome: 'sent',
      providerMessageId: 'sg-message-id-123',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(init.body as string) as {
      personalizations: { to: { email: string }[] }[];
      from: { email: string };
      subject: string;
      content: { type: string; value: string }[];
    };
    expect(body.personalizations[0].to[0].email).toBe('user@example.com');
    expect(body.from.email).toBe(config.fromEmail);
    expect(body.subject).toBe('Hello');
    expect(body.content[0]).toEqual({ type: 'text/plain', value: 'World' });
  });

  it('returns a failed outcome when SendGrid responds with a non-ok status', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
      json: () => Promise.resolve({ errors: [{ message: 'Unauthorized' }] }),
    });
    const adapter = new SendGridEmailProviderAdapter(config, fetchMock);

    const outcome = await adapter.send('email', 'user@example.com', {
      subject: 'Hello',
      body: 'World',
    });

    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome === 'failed') {
      expect(outcome.error).toContain('Unauthorized');
    }
  });

  it('returns a failed outcome (not a thrown error) when fetch itself rejects', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    const adapter = new SendGridEmailProviderAdapter(config, fetchMock);

    const outcome = await adapter.send('email', 'user@example.com', {
      subject: 'Hello',
      body: 'World',
    });

    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome === 'failed') {
      expect(outcome.error).toContain('ETIMEDOUT');
    }
  });
});
