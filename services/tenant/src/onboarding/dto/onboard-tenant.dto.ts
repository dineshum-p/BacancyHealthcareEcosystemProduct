import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Same kebab-case constraint as `CreateTenantDto.slug` -- see that file's
 * doc comment for why (schema-name derivation, Postgres identifier limits).
 * Duplicated (not imported) since it's a tiny, self-contained regex and
 * `OnboardTenantDto` is a deliberately separate contract from
 * `CreateTenantDto` (see `OnboardingService`'s doc comment).
 */
const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * Request body for `POST /tenants/onboard` (BAC-12, AC1/AC2): what the
 * Super Admin console's onboarding form submits. Deliberately a SEPARATE
 * contract from `CreateTenantDto`, even though `name`/`slug`/`plan` are
 * identical -- `adminEmail` (not `ownerEmail`) is the more accurate name for
 * what this orchestration actually does with it (seeds a `clinic_admin` and
 * sends them an invite), even though `OnboardingService` does pass it
 * through to `TenantsService.create` as `ownerEmail` too (the bootstrap
 * -admin-email mechanism from BAC-7 still applies to the same address).
 */
export class OnboardTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(56)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be a lowercase, kebab-case identifier',
  })
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  plan!: string;

  @IsEmail()
  @MaxLength(320)
  adminEmail!: string;
}
