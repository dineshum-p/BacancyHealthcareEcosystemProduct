import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { HepModule, PlanTier } from '@hep/shared-types';
import { ALL_MODULES, ALL_PLAN_TIERS } from '../../pricing/module-catalog';

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

  /**
   * Subscription tier (PRD 6.2): now a closed set of the three platform
   * tiers, since the onboarding form drives the monthly platform base fee
   * off it -- unlike the plain `POST /tenants` bootstrap endpoint, whose
   * `plan` stays free-text for backward compatibility with pre-existing rows.
   */
  @IsIn(ALL_PLAN_TIERS, {
    message: `plan must be one of: ${ALL_PLAN_TIERS.join(', ')}`,
  })
  plan!: PlanTier;

  /**
   * The product modules this tenant is subscribing to (PRD Section 3/6). At
   * least one is required; each must be a known module. Drives both the
   * tenant's granted module access and its computed pricing.
   */
  @IsArray()
  @ArrayNotEmpty({ message: 'Select at least one module.' })
  @IsIn(ALL_MODULES, {
    each: true,
    message: `each module must be one of: ${ALL_MODULES.join(', ')}`,
  })
  modules!: HepModule[];

  @IsEmail()
  @MaxLength(320)
  adminEmail!: string;
}
