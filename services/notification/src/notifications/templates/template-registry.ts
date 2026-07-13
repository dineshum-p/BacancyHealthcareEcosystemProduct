import { UnknownTemplateError } from '../errors/unknown-template.error';

/** A single template's content. `subject` is only meaningful for `email`. */
export interface NotificationTemplate {
  subject?: string;
  body: string;
}

/**
 * A small, in-repo, hand-maintained registry mapping `templateId` ->
 * template content -- deliberately NOT a template-management CRUD API (out
 * of this ticket's scope per its instructions). Add a new entry here when a
 * new notification is needed; there is no dynamic/user-supplied template
 * source (that would reopen the "arbitrary content injected into an
 * outbound SMS/email" risk `renderTemplate`'s doc comment discusses).
 */
const TEMPLATE_REGISTRY: Readonly<Record<string, NotificationTemplate>> = {
  /** Sent by `UserRegisteredEventHandler` (AC4) when a `user.registered` domain event is consumed. */
  'user.registered.welcome': {
    subject: 'Welcome to {{tenantName}}!',
    body: 'Hi {{userName}}, thanks for registering with {{tenantName}}. Your account ({{email}}) is ready to use.',
  },
  /** A generic single-variable notice, usable by any caller of POST /notifications that just needs a plain message relayed. */
  'generic.notice': {
    body: '{{message}}',
  },
  /**
   * BAC-12: sent by `services/tenant`'s onboarding orchestration
   * (`OnboardingService`) via `POST /notifications/internal` once a brand
   * -new tenant's `clinic_admin` has been seeded. Distinct from
   * `user.registered.welcome`: that template is for a user who just
   * self-registered; this one is for an admin who was invited and has not
   * interacted with anything yet.
   */
  'tenant.onboarding.admin-invite': {
    subject: "You've been invited to administer {{tenantName}} on HEP",
    body: 'Hi, an administrator account has been created for you ({{email}}) for {{tenantName}}. Contact your Super Admin for next steps to access it.',
  },
};

/** Resolves a template by id, or throws `UnknownTemplateError`. */
export function getTemplate(templateId: string): NotificationTemplate {
  const template = TEMPLATE_REGISTRY[templateId];
  if (!template) {
    throw new UnknownTemplateError(templateId);
  }
  return template;
}
