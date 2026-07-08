/**
 * Domain-specific error raised by `TenantsRepository.create()` when the
 * requested slug is already taken. Kept Nest-exception-free so the
 * repository layer stays a pure data-access concern (per CLAUDE.md
 * layering rules) -- `TenantsService` is responsible for translating this
 * into a `ConflictException` (409).
 */
export class SlugAlreadyExistsError extends Error {
  constructor(public readonly slug: string) {
    super(`Tenant slug "${slug}" already exists.`);
    this.name = 'SlugAlreadyExistsError';
  }
}
