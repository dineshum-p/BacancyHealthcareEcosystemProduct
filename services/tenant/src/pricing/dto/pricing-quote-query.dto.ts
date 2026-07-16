import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn } from 'class-validator';
import type { HepModule, PlanTier } from '@hep/shared-types';
import { ALL_MODULES, ALL_PLAN_TIERS } from '../module-catalog';

/**
 * Validates the query of `GET /pricing/quote`:
 * `?modules=clinic,pharmacy&planTier=growth`.
 *
 * `modules` arrives as a comma-separated string and is split into an array
 * here; every entry must be a known `HepModule` and `planTier` a known
 * `PlanTier`, so a malformed request is rejected with 400 by the global
 * `ValidationPipe` before any quote is computed.
 */
export class PricingQuoteQueryDto {
  @Transform(({ value }): string[] =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
      : Array.isArray(value)
        ? (value as string[])
        : [],
  )
  @IsArray()
  @ArrayNotEmpty({ message: 'Select at least one module.' })
  @IsIn(ALL_MODULES, {
    each: true,
    message: `each module must be one of: ${ALL_MODULES.join(', ')}`,
  })
  modules!: HepModule[];

  @IsIn(ALL_PLAN_TIERS, {
    message: `planTier must be one of: ${ALL_PLAN_TIERS.join(', ')}`,
  })
  planTier!: PlanTier;
}
