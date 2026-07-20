import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AccessTokenPayload } from '@hep/shared-types';
import {
  assertProviderScope,
  resolveScopedProviderId,
} from './provider-scope.util';

function user(
  role: AccessTokenPayload['role'],
  userId = 'user-1',
): AccessTokenPayload {
  return { userId, tenantId: 't1', role };
}

describe('assertProviderScope', () => {
  it.each(['clinic_admin', 'staff', 'super_admin'] as const)(
    'allows %s to act on ANY provider',
    (role) => {
      expect(() =>
        assertProviderScope(user(role), 'some-other-provider'),
      ).not.toThrow();
    },
  );

  it('allows a provider to act on their OWN calendar', () => {
    expect(() =>
      assertProviderScope(user('provider', 'provider-1'), 'provider-1'),
    ).not.toThrow();
  });

  it("forbids a provider from acting on a DIFFERENT provider's calendar", () => {
    expect(() =>
      assertProviderScope(user('provider', 'provider-1'), 'provider-2'),
    ).toThrow(ForbiddenException);
  });
});

describe('resolveScopedProviderId', () => {
  it.each(['clinic_admin', 'staff', 'super_admin'] as const)(
    '%s must supply providerId (400 if missing)',
    (role) => {
      expect(() => resolveScopedProviderId(user(role), undefined)).toThrow(
        BadRequestException,
      );
    },
  );

  it.each(['clinic_admin', 'staff', 'super_admin'] as const)(
    '%s can query any providerId they supply',
    (role) => {
      expect(resolveScopedProviderId(user(role), 'provider-9')).toBe(
        'provider-9',
      );
    },
  );

  it('defaults a provider to their own userId when providerId is omitted', () => {
    expect(
      resolveScopedProviderId(user('provider', 'provider-1'), undefined),
    ).toBe('provider-1');
  });

  it('allows a provider to explicitly pass their own providerId', () => {
    expect(
      resolveScopedProviderId(user('provider', 'provider-1'), 'provider-1'),
    ).toBe('provider-1');
  });

  it("forbids a provider from querying a DIFFERENT provider's calendar", () => {
    expect(() =>
      resolveScopedProviderId(user('provider', 'provider-1'), 'provider-2'),
    ).toThrow(ForbiddenException);
  });
});
