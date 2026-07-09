/**
 * Domain-specific error raised by `UsersRepository.create()` when the email
 * is already registered within the current tenant's schema. Kept
 * Nest-exception-free so the repository layer stays a pure data-access
 * concern (per CLAUDE.md layering rules) -- `AuthService` translates this
 * into a `ConflictException` (409).
 */
export class EmailAlreadyExistsError extends Error {
  constructor(public readonly email: string) {
    super(`Email "${email}" is already registered for this tenant.`);
    this.name = 'EmailAlreadyExistsError';
  }
}
