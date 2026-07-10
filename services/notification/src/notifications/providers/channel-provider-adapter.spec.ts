import { ChannelProviderAdapter } from './channel-provider-adapter';
import type { NotificationProviderAdapter } from './notification-provider-adapter.interface';

describe('ChannelProviderAdapter', () => {
  it('routes sms to the sms adapter', async () => {
    const smsAdapter: jest.Mocked<NotificationProviderAdapter> = {
      send: jest
        .fn()
        .mockResolvedValue({ outcome: 'sent', providerMessageId: 'sms-1' }),
    };
    const emailAdapter: jest.Mocked<NotificationProviderAdapter> = {
      send: jest.fn(),
    };
    const adapter = new ChannelProviderAdapter(smsAdapter, emailAdapter);

    const outcome = await adapter.send('sms', '+15551234567', { body: 'hi' });

    expect(outcome).toEqual({ outcome: 'sent', providerMessageId: 'sms-1' });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(smsAdapter.send).toHaveBeenCalledWith('sms', '+15551234567', {
      body: 'hi',
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(emailAdapter.send).not.toHaveBeenCalled();
  });

  it('routes email to the email adapter', async () => {
    const smsAdapter: jest.Mocked<NotificationProviderAdapter> = {
      send: jest.fn(),
    };
    const emailAdapter: jest.Mocked<NotificationProviderAdapter> = {
      send: jest
        .fn()
        .mockResolvedValue({ outcome: 'sent', providerMessageId: 'email-1' }),
    };
    const adapter = new ChannelProviderAdapter(smsAdapter, emailAdapter);

    const outcome = await adapter.send('email', 'a@example.com', {
      subject: 's',
      body: 'hi',
    });

    expect(outcome).toEqual({ outcome: 'sent', providerMessageId: 'email-1' });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock
    expect(emailAdapter.send).toHaveBeenCalledWith('email', 'a@example.com', {
      subject: 's',
      body: 'hi',
    });
  });
});
