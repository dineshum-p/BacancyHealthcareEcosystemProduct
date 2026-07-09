import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

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
}
