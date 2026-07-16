import type { PricingQuote } from "@hep/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const usd = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const rate = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export interface PricingSummaryProps {
  quote?: PricingQuote;
  isLoading: boolean;
  isError: boolean;
  /** True when no module is selected yet (the quote endpoint isn't called). */
  isEmpty: boolean;
}

/** The onboarding form's live pricing panel (PRD Section 6): onboarding total + monthly platform fee + per-module usage rates. */
export function PricingSummary({ quote, isLoading, isError, isEmpty }: PricingSummaryProps) {
  return (
    <Card className="border-border/70 bg-muted/30">
      <CardContent className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Subscription summary</h2>

        {isEmpty && (
          <p className="text-sm text-muted-foreground">
            Select at least one module to see pricing.
          </p>
        )}

        {!isEmpty && isLoading && (
          <p className="text-sm text-muted-foreground">Calculating…</p>
        )}

        {!isEmpty && isError && (
          <p className="text-sm text-destructive">Couldn&apos;t calculate pricing. Please try again.</p>
        )}

        {!isEmpty && !isLoading && !isError && quote && (
          <>
            <ul className="flex flex-col gap-2">
              {quote.lineItems.map((item) => (
                <li key={item.module} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-foreground">{item.label}</span>
                  <span className="font-mono text-muted-foreground">{usd(item.onboardingFee)}</span>
                </li>
              ))}
            </ul>

            <Separator />

            <dl className="flex flex-col gap-1.5 text-sm">
              <Row label="Onboarding subtotal" value={usd(quote.onboardingSubtotal)} muted />
              {quote.discountRate > 0 && (
                <Row
                  label={`Multi-module discount (${Math.round(quote.discountRate * 100)}%)`}
                  value={`−${usd(quote.discountAmount)}`}
                  accent="success"
                />
              )}
              <Row label="One-time onboarding total" value={usd(quote.onboardingTotal)} strong />
              <Row label="Monthly platform fee" value={`${usd(quote.monthlyPlatformFee)}/mo`} strong />
            </dl>

            <div className="rounded-md bg-background/60 p-3">
              <p className="text-xs font-medium text-foreground">Usage-based charges</p>
              <ul className="mt-1 flex flex-col gap-1">
                {quote.lineItems.map((item) => (
                  <li key={item.module} className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                    <span>{item.label} · per {item.usageUnit}</span>
                    <span className="font-mono">
                      {rate(item.usageRateTo)}–{rate(item.usageRateFrom)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Billed per transaction; rate decreases with volume.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  accent?: "success";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-muted-foreground" : "text-foreground"}>{label}</dt>
      <dd
        className={
          "font-mono " +
          (accent === "success"
            ? "text-success"
            : strong
              ? "font-semibold text-foreground"
              : "text-muted-foreground")
        }
      >
        {value}
      </dd>
    </div>
  );
}
