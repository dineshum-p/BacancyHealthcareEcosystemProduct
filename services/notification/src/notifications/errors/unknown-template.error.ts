/**
 * Domain-specific error raised by `getTemplate()` when `templateId` is not
 * in the registry. Kept Nest-exception-free so the templates layer stays a
 * pure concern (per CLAUDE.md's layering rules, same pattern as
 * `SlugAlreadyExistsError`/`EmailAlreadyExistsError` elsewhere in this
 * codebase) -- `NotificationsService` translates this into a
 * `BadRequestException` (400).
 */
export class UnknownTemplateError extends Error {
  constructor(public readonly templateId: string) {
    super(`Unknown notification templateId "${templateId}".`);
    this.name = 'UnknownTemplateError';
  }
}
