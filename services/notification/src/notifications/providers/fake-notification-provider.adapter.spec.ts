import { FakeNotificationProviderAdapter } from './fake-notification-provider.adapter';

describe('FakeNotificationProviderAdapter', () => {
  const content = { body: 'hello' };

  it('always succeeds by default', async () => {
    const adapter = new FakeNotificationProviderAdapter();

    const outcome = await adapter.send('email', 'a@example.com', content);

    expect(outcome.outcome).toBe('sent');
    if (outcome.outcome === 'sent') {
      expect(outcome.providerMessageId).toEqual(expect.any(String));
    }
  });

  it('returns a distinct providerMessageId per call', async () => {
    const adapter = new FakeNotificationProviderAdapter();

    const first = await adapter.send('email', 'a@example.com', content);
    const second = await adapter.send('email', 'a@example.com', content);

    expect(first).not.toEqual(second);
  });

  it('always fails when configured with mode "always-fail"', async () => {
    const adapter = new FakeNotificationProviderAdapter({
      mode: 'always-fail',
    });

    const outcome = await adapter.send('sms', '+15551234567', content);

    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome === 'failed') {
      expect(typeof outcome.error).toBe('string');
    }
  });

  it('fails the configured number of times then succeeds ("fail-then-succeed")', async () => {
    const adapter = new FakeNotificationProviderAdapter({
      mode: 'fail-then-succeed',
      failCount: 2,
    });

    const first = await adapter.send('sms', '+15551234567', content);
    const second = await adapter.send('sms', '+15551234567', content);
    const third = await adapter.send('sms', '+15551234567', content);

    expect(first.outcome).toBe('failed');
    expect(second.outcome).toBe('failed');
    expect(third.outcome).toBe('sent');
  });

  it('tracks the number of send() calls', async () => {
    const adapter = new FakeNotificationProviderAdapter();
    await adapter.send('email', 'a@example.com', content);
    await adapter.send('email', 'a@example.com', content);

    expect(adapter.getCallCount()).toBe(2);
  });
});
