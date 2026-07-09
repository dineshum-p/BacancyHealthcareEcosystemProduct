import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Slugs are used both as the public tenant identifier (BAC-4's `X-Tenant-Id`
 * / subdomain resolution) and to derive the tenant's Postgres schema name
 * (`tenant_<slug with "-" -> "_">`), so they are restricted to lowercase
 * kebab-case. The 56-char cap keeps the derived `tenant_<slug>` schema name
 * within Postgres's 63-byte identifier limit with room to spare.
 */
const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

export class CreateTenantDto {
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

  /**
   * BAC-7: the single email address permitted to bootstrap this tenant's
   * `super_admin` (`services/auth`'s `AuthService.register` promotes
   * whichever registrant's email exactly matches this value, case
   * -insensitively, instead of "whoever registers first" -- see that
   * service's doc comment for the full exploit this closes). Required at
   * creation time so every tenant onboarded from now on has a bootstrap
   * owner bound up front, before its slug is ever guessable/usable.
   */
  @IsEmail()
  @MaxLength(320)
  ownerEmail!: string;
}
