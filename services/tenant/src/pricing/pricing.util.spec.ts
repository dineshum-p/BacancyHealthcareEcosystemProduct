import { computePricingQuote } from './pricing.util';

describe('computePricingQuote', () => {
  it('quotes a single module with no discount and the tier base fee', () => {
    const quote = computePricingQuote(['clinic'], 'starter');

    expect(quote.onboardingSubtotal).toBe(5000);
    expect(quote.discountRate).toBe(0);
    expect(quote.discountAmount).toBe(0);
    expect(quote.onboardingTotal).toBe(5000);
    expect(quote.monthlyPlatformFee).toBe(500);
    expect(quote.lineItems).toHaveLength(1);
    expect(quote.lineItems[0]).toMatchObject({
      module: 'clinic',
      label: 'Clinic',
      onboardingFee: 5000,
      usageUnit: 'e-prescription',
    });
  });

  it('applies the 5% multi-module discount for two modules (PRD 6.1)', () => {
    const quote = computePricingQuote(['clinic', 'pharmacy'], 'growth');

    // 5000 + 4000 = 9000, 5% off = 450
    expect(quote.onboardingSubtotal).toBe(9000);
    expect(quote.discountRate).toBe(0.05);
    expect(quote.discountAmount).toBe(450);
    expect(quote.onboardingTotal).toBe(8550);
    expect(quote.monthlyPlatformFee).toBe(800);
  });

  it('applies the 25% discount when all five modules are selected', () => {
    const quote = computePricingQuote(
      ['clinic', 'pharmacy', 'doctor', 'insurance', 'patient_portal'],
      'enterprise',
    );

    // 5000+4000+3000+8000+2000 = 22000, 25% off = 5500
    expect(quote.onboardingSubtotal).toBe(22000);
    expect(quote.discountRate).toBe(0.25);
    expect(quote.discountAmount).toBe(5500);
    expect(quote.onboardingTotal).toBe(16500);
    expect(quote.monthlyPlatformFee).toBe(1200);
    expect(quote.lineItems).toHaveLength(5);
  });

  it('de-duplicates and canonically orders modules regardless of input order', () => {
    const quote = computePricingQuote(
      ['pharmacy', 'clinic', 'clinic'],
      'starter',
    );

    expect(quote.modules).toEqual(['clinic', 'pharmacy']);
    // De-duplicated: two distinct modules -> 5% discount, not counted as three.
    expect(quote.discountRate).toBe(0.05);
    expect(quote.onboardingSubtotal).toBe(9000);
  });

  it('handles an empty selection as a zero onboarding quote (tier fee still applies)', () => {
    const quote = computePricingQuote([], 'growth');

    expect(quote.onboardingSubtotal).toBe(0);
    expect(quote.onboardingTotal).toBe(0);
    expect(quote.discountRate).toBe(0);
    expect(quote.monthlyPlatformFee).toBe(800);
    expect(quote.lineItems).toEqual([]);
  });
});
