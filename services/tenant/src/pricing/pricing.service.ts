import { Injectable } from '@nestjs/common';
import type { HepModule, PlanTier, PricingQuote } from '@hep/shared-types';
import { computePricingQuote } from './pricing.util';

/**
 * Thin domain service over the pure `computePricingQuote` calculation (PRD
 * Section 6). Exists so the controller stays a thin validation+delegation
 * layer and so the (server-authoritative) fee schedule has a single injectable
 * entry point that other services could reuse later.
 */
@Injectable()
export class PricingService {
  quote(modules: HepModule[], planTier: PlanTier): PricingQuote {
    return computePricingQuote(modules, planTier);
  }
}
