import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AccessTokenPayload } from '@hep/shared-types';
import {
  assertPatientScope,
  resolveScopedPatientId,
} from './patient-scope.util';

function user(
  role: AccessTokenPayload['role'],
  userId = 'user-1',
): AccessTokenPayload {
  return { userId, tenantId: 't1', role };
}

describe('assertPatientScope', () => {
  it.each(['super_admin', 'clinic_admin', 'provider', 'staff'] as const)(
    'allows %s (staff-side) to act on ANY patient-owned resource',
    (role) => {
      expect(() =>
        assertPatientScope(user(role), 'some-other-patient'),
      ).not.toThrow();
    },
  );

  it('allows a patient to act on their OWN resource', () => {
    expect(() =>
      assertPatientScope(user('patient', 'patient-1'), 'patient-1'),
    ).not.toThrow();
  });

  it("forbids a patient from acting on a DIFFERENT patient's resource", () => {
    expect(() =>
      assertPatientScope(user('patient', 'patient-1'), 'patient-2'),
    ).toThrow(ForbiddenException);
  });
});

describe('resolveScopedPatientId', () => {
  it.each(['super_admin', 'clinic_admin', 'provider', 'staff'] as const)(
    '%s must supply patientId (400 if missing)',
    (role) => {
      expect(() => resolveScopedPatientId(user(role), undefined)).toThrow(
        BadRequestException,
      );
    },
  );

  it.each(['super_admin', 'clinic_admin', 'provider', 'staff'] as const)(
    '%s can query any patientId they supply',
    (role) => {
      expect(resolveScopedPatientId(user(role), 'patient-9')).toBe('patient-9');
    },
  );

  it('defaults a patient to their own userId when patientId is omitted', () => {
    expect(
      resolveScopedPatientId(user('patient', 'patient-1'), undefined),
    ).toBe('patient-1');
  });

  it('allows a patient to explicitly pass their own patientId', () => {
    expect(
      resolveScopedPatientId(user('patient', 'patient-1'), 'patient-1'),
    ).toBe('patient-1');
  });

  it("forbids a patient from querying a DIFFERENT patient's resource", () => {
    expect(() =>
      resolveScopedPatientId(user('patient', 'patient-1'), 'patient-2'),
    ).toThrow(ForbiddenException);
  });
});
