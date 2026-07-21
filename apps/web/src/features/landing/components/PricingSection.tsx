import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { onboardingFees, pricingTiers } from "../data";

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          Simple, usage-based pricing
        </h2>
        <p className="mt-3 text-muted-foreground">
          A monthly platform fee plus metered usage per module — activate two
          or more modules and the combined onboarding fee drops by 5–25%.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {pricingTiers.map((tier) => (
          <Card
            key={tier.name}
            className={cn(
              "p-2",
              tier.highlighted && "ring-2 ring-primary",
            )}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{tier.name}</CardTitle>
                {tier.highlighted && <Badge>Most popular</Badge>}
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {tier.monthly}
              </p>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-border bg-card p-6">
        <h3 className="font-heading font-semibold">
          One-time module onboarding fee
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Covers setup, data migration, integrations, training, and a
          14-day hypercare period.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {onboardingFees.map((item) => (
            <div key={item.module}>
              <dt className="text-sm text-muted-foreground">{item.module}</dt>
              <dd className="text-lg font-semibold text-foreground">
                {item.fee}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
