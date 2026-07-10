import { TwilioSmsProviderAdapter } from './twilio-sms-provider.adapter';

/**
 * NEVER calls the real Twilio API: `fetch` is always an injected jest mock
 * here (per this ticket's instructions -- no automated test may hit a real
 * network endpoint for this adapter). These tests prove the REQUEST SHAPE
 * (endpoint, auth, body) and response-mapping logic are correct; the actual
 * HTTP call is out of scope for anything this repo's CI ever exercises.
 */
describe('TwilioSmsProviderAdapter', () => {
  const config = {
    accountSid: 'AC_test_sid',
    authToken: 'test_token',
    fromNumber: '+15550000000',
  };

  it('POSTs to the Twilio Messages endpoint with Basic auth and a form-encoded body', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM123' }),
    });
    const adapter = new TwilioSmsProviderAdapter(config, fetchMock);

    const outcome = await adapter.send('sms', '+15551234567', {
      body: 'hello there',
    });

    expect(outcome).toEqual({ outcome: 'sent', providerMessageId: 'SM123' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
    );
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toContain('Basic ');
    expect(init.headers['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    const body = new URLSearchParams(init.body);
    expect(body.get('To')).toBe('+15551234567');
    expect(body.get('From')).toBe(config.fromNumber);
    expect(body.get('Body')).toBe('hello there');
  });

  it('returns a failed outcome when Twilio responds with a non-ok status', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Invalid number' }),
    });
    const adapter = new TwilioSmsProviderAdapter(config, fetchMock);

    const outcome = await adapter.send('sms', 'not-a-number', {
      body: 'hi',
    });

    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome === 'failed') {
      expect(outcome.error).toContain('Invalid number');
    }
  });

  it('returns a failed outcome (not a thrown error) when fetch itself rejects', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const adapter = new TwilioSmsProviderAdapter(config, fetchMock);

    const outcome = await adapter.send('sms', '+15551234567', { body: 'hi' });

    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome === 'failed') {
      expect(outcome.error).toContain('ECONNRESET');
    }
  });
});
