import { getTemplate } from './template-registry';
import { UnknownTemplateError } from '../errors/unknown-template.error';

describe('template-registry', () => {
  it('resolves the seeded "user.registered.welcome" template', () => {
    const template = getTemplate('user.registered.welcome');
    expect(template.body).toEqual(expect.stringContaining('{{'));
  });

  it('resolves the seeded "generic.notice" template', () => {
    const template = getTemplate('generic.notice');
    expect(template.body).toEqual(expect.stringContaining('{{message}}'));
  });

  it('resolves the seeded "tenant.onboarding.admin-invite" template (BAC-12)', () => {
    const template = getTemplate('tenant.onboarding.admin-invite');
    expect(template.subject).toEqual(expect.stringContaining('{{tenantName}}'));
    expect(template.body).toEqual(expect.stringContaining('{{email}}'));
  });

  it('throws UnknownTemplateError for an unregistered templateId', () => {
    expect(() => getTemplate('does.not.exist')).toThrow(UnknownTemplateError);
  });
});
