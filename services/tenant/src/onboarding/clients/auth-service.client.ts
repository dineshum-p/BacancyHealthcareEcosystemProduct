import type { OrchestrationStepResult } from './orchestration-step-result.interface';

/**
 * Port over which `OnboardingService` seeds a brand-new tenant's first
 * `clinic_admin` (BAC-12, step b). A real, synchronous HTTP call to
 * `services/auth`'s `POST /auth/admin-seed` -- NOT a domain event -- per
 * this ticket's explicit architectural decision (see `OnboardingService`'s
 * doc comment): onboarding is a user-facing, synchronous console action,
 * and no real event-bus publisher exists anywhere in this repo (see
 * `services/notification`'s `events/README.md`).
 *
 * An interface (not a class) so unit tests can inject a fake implementation
 * instead of making a real network call -- mirrors `services/notification`'s
 * `NotificationProviderAdapter` port.
 */
export interface AuthServiceClient {
  seedClinicAdmin(
    tenantId: string,
    email: string,
  ): Promise<OrchestrationStepResult>;
}

export const AUTH_SERVICE_CLIENT = Symbol('AUTH_SERVICE_CLIENT');
