import { parseUserRegisteredEvent } from './parse-user-registered-event.util';

describe('parseUserRegisteredEvent', () => {
  it('parses a well-formed JSON payload', () => {
    const raw = JSON.stringify({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@example.com',
      name: 'Ada',
    });

    expect(parseUserRegisteredEvent(raw)).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@example.com',
      name: 'Ada',
    });
  });

  it('accepts a payload with no name (optional field)', () => {
    const raw = JSON.stringify({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@example.com',
    });

    expect(parseUserRegisteredEvent(raw)).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@example.com',
      name: undefined,
    });
  });

  it('accepts a Buffer (as kafkajs message.value is typed)', () => {
    const raw = Buffer.from(
      JSON.stringify({
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'a@example.com',
      }),
    );

    expect(parseUserRegisteredEvent(raw)).toMatchObject({ userId: 'user-1' });
  });

  it('throws on null (no message value)', () => {
    expect(() => parseUserRegisteredEvent(null)).toThrow(/empty/i);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseUserRegisteredEvent('not json')).toThrow();
  });

  it.each([
    ['missing userId', { tenantId: 't', email: 'a@example.com' }],
    ['missing tenantId', { userId: 'u', email: 'a@example.com' }],
    ['missing email', { userId: 'u', tenantId: 't' }],
    ['non-string userId', { userId: 1, tenantId: 't', email: 'a@example.com' }],
  ])(
    'throws when the payload is missing required fields: %s',
    (_desc, payload) => {
      expect(() => parseUserRegisteredEvent(JSON.stringify(payload))).toThrow();
    },
  );
});
