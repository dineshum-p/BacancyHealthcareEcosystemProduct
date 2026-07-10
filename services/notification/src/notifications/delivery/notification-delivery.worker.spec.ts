import { randomUUID } from 'node:crypto';
import { NotificationDeliveryWorker } from './notification-delivery.worker';
import { NotificationsRepository } from '../notifications.repository';
import { FakeNotificationProviderAdapter } from '../providers/fake-notification-provider.adapter';
import type { NotificationProviderAdapter } from '../providers/notification-provider-adapter.interface';
import type { NotificationTemplate } from '../templates/template-registry';

function makeRepository(): jest.Mocked<NotificationsRepository> {
  return {
    insertQueued: jest.fn(),
    findById: jest.fn(),
    markSent: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationsRepository>;
}

const SCHEMA = 'tenant_a';
const template: NotificationTemplate = {
  subject: 'Hi {{name}}',
  body: 'Hello {{name}}, welcome to {{tenant}}.',
};

function makeQueuedNotification(
  overrides: Partial<{ id: string; channel: 'sms' | 'email'; to: string }> = {},
) {
  return {
    id: overrides.id ?? randomUUID(),
    channel: overrides.channel ?? ('email' as const),
    to: overrides.to ?? 'a@example.com',
    templateId: 'user.registered.welcome',
    data: { name: 'Ada', tenant: 'Acme' },
  };
}

describe('NotificationDeliveryWorker', () => {
  it('AC1/AC3: renders the template and calls the provider adapter with the rendered content', async () => {
    const repository = makeRepository();
    const adapter = new FakeNotificationProviderAdapter();
    const sendSpy = jest.spyOn(adapter, 'send');
    const worker = new NotificationDeliveryWorker(repository, adapter, {
      maxAttempts: 3,
      backoffBaseMs: 0,
      attemptTimeoutMs: 5000,
    });
    const notification = makeQueuedNotification();

    await worker.deliver(SCHEMA, notification, template);

    expect(sendSpy).toHaveBeenCalledWith('email', 'a@example.com', {
      subject: 'Hi Ada',
      body: 'Hello Ada, welcome to Acme.',
    });
  });

  it('AC2/AC3: marks the notification sent (with providerMessageId + attempts) on the first successful attempt', async () => {
    const repository = makeRepository();
    const adapter = new FakeNotificationProviderAdapter();
    const worker = new NotificationDeliveryWorker(repository, adapter, {
      maxAttempts: 3,
      backoffBaseMs: 0,
      attemptTimeoutMs: 5000,
    });
    const notification = makeQueuedNotification();

    await worker.deliver(SCHEMA, notification, template);

    expect(adapter.getCallCount()).toBe(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(repository.markSent).toHaveBeenCalledWith(SCHEMA, notification.id, {
      providerMessageId: expect.any(String) as string,
      attempts: 1,
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('AC3: retries a transient failure with backoff and succeeds within maxAttempts', async () => {
    const repository = makeRepository();
    const adapter = new FakeNotificationProviderAdapter({
      mode: 'fail-then-succeed',
      failCount: 2,
    });
    const sleepFn = jest.fn().mockResolvedValue(undefined);
    const worker = new NotificationDeliveryWorker(
      repository,
      adapter,
      { maxAttempts: 3, backoffBaseMs: 100, attemptTimeoutMs: 5000 },
      sleepFn,
    );
    const notification = makeQueuedNotification();

    await worker.deliver(SCHEMA, notification, template);

    expect(adapter.getCallCount()).toBe(3);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(repository.markSent).toHaveBeenCalledWith(SCHEMA, notification.id, {
      providerMessageId: expect.any(String) as string,
      attempts: 3,
    });
    // Exponential backoff: attempt 1 waits 100ms, attempt 2 waits 200ms.
    expect(sleepFn).toHaveBeenNthCalledWith(1, 100);
    expect(sleepFn).toHaveBeenNthCalledWith(2, 200);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('AC3: marks failed only after exhausting maxAttempts, recording the last error', async () => {
    const repository = makeRepository();
    const adapter = new FakeNotificationProviderAdapter({
      mode: 'always-fail',
      error: 'Simulated permanent failure.',
    });
    const sleepFn = jest.fn().mockResolvedValue(undefined);
    const worker = new NotificationDeliveryWorker(
      repository,
      adapter,
      { maxAttempts: 3, backoffBaseMs: 10, attemptTimeoutMs: 5000 },
      sleepFn,
    );
    const notification = makeQueuedNotification();

    await worker.deliver(SCHEMA, notification, template);

    expect(adapter.getCallCount()).toBe(3);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(repository.markFailed).toHaveBeenCalledWith(
      SCHEMA,
      notification.id,
      {
        lastError: 'Simulated permanent failure.',
        attempts: 3,
      },
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(repository.markSent).not.toHaveBeenCalled();
    // Only sleeps BETWEEN attempts (2 sleeps for 3 attempts), never after the last.
    expect(sleepFn).toHaveBeenCalledTimes(2);
  });

  it('treats a thrown adapter error the same as a returned failed outcome', async () => {
    const repository = makeRepository();
    const adapter = new FakeNotificationProviderAdapter();
    jest.spyOn(adapter, 'send').mockRejectedValue(new Error('ECONNRESET'));
    const worker = new NotificationDeliveryWorker(repository, adapter, {
      maxAttempts: 1,
      backoffBaseMs: 0,
      attemptTimeoutMs: 5000,
    });
    const notification = makeQueuedNotification();

    await worker.deliver(SCHEMA, notification, template);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(repository.markFailed).toHaveBeenCalledWith(
      SCHEMA,
      notification.id,
      {
        lastError: 'ECONNRESET',
        attempts: 1,
      },
    );
  });

  it('routes sms notifications with no subject line to the adapter', async () => {
    const repository = makeRepository();
    const adapter = new FakeNotificationProviderAdapter();
    const sendSpy = jest.spyOn(adapter, 'send');
    const worker = new NotificationDeliveryWorker(repository, adapter, {
      maxAttempts: 1,
      backoffBaseMs: 0,
      attemptTimeoutMs: 5000,
    });
    const notification = makeQueuedNotification({
      channel: 'sms',
      to: '+15551234567',
    });
    const smsTemplate: NotificationTemplate = { body: 'Hi {{name}}' };

    await worker.deliver(SCHEMA, notification, smsTemplate);

    expect(sendSpy).toHaveBeenCalledWith('sms', '+15551234567', {
      subject: undefined,
      body: 'Hi Ada',
    });
  });

  it('MAJOR fix: a hung/never-resolving adapter.send() does not stall the retry loop forever -- it is treated as a normal transient failure, retried per backoff, and eventually reaches failed after maxAttempts', async () => {
    const repository = makeRepository();
    /** Simulates a real vendor outage/DNS black-hole: `send()` never settles. */
    const sendMock = jest
      .fn<
        ReturnType<NotificationProviderAdapter['send']>,
        Parameters<NotificationProviderAdapter['send']>
      >()
      .mockReturnValue(new Promise<never>(() => {}));
    const hangingAdapter: NotificationProviderAdapter = { send: sendMock };
    const sleepFn = jest.fn().mockResolvedValue(undefined);
    const worker = new NotificationDeliveryWorker(
      repository,
      hangingAdapter,
      { maxAttempts: 3, backoffBaseMs: 10, attemptTimeoutMs: 20 },
      sleepFn,
    );
    const notification = makeQueuedNotification();

    await worker.deliver(SCHEMA, notification, template);

    expect(sendMock).toHaveBeenCalledTimes(3);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(repository.markFailed).toHaveBeenCalledWith(
      SCHEMA,
      notification.id,
      {
        lastError: 'Provider adapter timed out after 20ms',
        attempts: 3,
      },
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(repository.markSent).not.toHaveBeenCalled();
  }, 5000);
});
