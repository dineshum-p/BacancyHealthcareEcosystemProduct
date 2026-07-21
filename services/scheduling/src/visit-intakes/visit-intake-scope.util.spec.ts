import { ForbiddenException } from '@nestjs/common';
import type { AccessTokenPayload } from '@hep/shared-types';
import { assertVisitIntakeReadScope } from './visit-intake-scope.util';
import { VisitIntakeRecord } from './visit-intake.entity';
import { VisitIntakeStatus } from './visit-intake-status.enum';

function user(
  role: AccessTokenPayload['role'],
  userId = 'user-1',
): AccessTokenPayload {
  return { userId, tenantId: 't1', role };
}

function intake(overrides: Partial<VisitIntakeRecord> = {}): VisitIntakeRecord {
  return {
    id: 'intake-1',
    patientId: 'patient-1',
    reasonForVisit: 'Annual checkup',
    symptoms: 'None',
    whatsNewSinceLastVisit: '',
    status: VisitIntakeStatus.PENDING,
    assignedProviderId: null,
    appointmentId: null,
    createdAt: new Date('2026-07-20T09:00:00.000Z'),
    updatedAt: new Date('2026-07-20T09:00:00.000Z'),
    ...overrides,
  };
}

describe('assertVisitIntakeReadScope', () => {
  it.each(['super_admin', 'clinic_admin', 'staff'] as const)(
    'allows %s to read ANY intake, assigned or not',
    (role) => {
      expect(() =>
        assertVisitIntakeReadScope(user(role, 'someone-else'), intake()),
      ).not.toThrow();
    },
  );

  it('allows the submitting patient to read their OWN intake', () => {
    expect(() =>
      assertVisitIntakeReadScope(
        user('patient', 'patient-1'),
        intake({ patientId: 'patient-1' }),
      ),
    ).not.toThrow();
  });

  it("forbids a DIFFERENT patient from reading someone else's intake", () => {
    expect(() =>
      assertVisitIntakeReadScope(
        user('patient', 'patient-2'),
        intake({ patientId: 'patient-1' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows the SPECIFIC assigned provider to read the intake', () => {
    expect(() =>
      assertVisitIntakeReadScope(
        user('provider', 'provider-1'),
        intake({ assignedProviderId: 'provider-1' }),
      ),
    ).not.toThrow();
  });

  it('forbids any OTHER provider (not assigned to this intake) from reading it (AC3)', () => {
    expect(() =>
      assertVisitIntakeReadScope(
        user('provider', 'provider-2'),
        intake({ assignedProviderId: 'provider-1' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('forbids EVERY provider from reading an intake that has not been assigned yet', () => {
    expect(() =>
      assertVisitIntakeReadScope(
        user('provider', 'provider-1'),
        intake({ assignedProviderId: null }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('forbids an unrecognized role by default', () => {
    expect(() =>
      assertVisitIntakeReadScope(
        { userId: 'x', tenantId: 't1', role: 'unknown' as never },
        intake(),
      ),
    ).toThrow(ForbiddenException);
  });
});
