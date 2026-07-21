import { LandingHeader } from "./components/LandingHeader";
import { LandingHero } from "./components/LandingHero";
import { ModulesSection } from "./components/ModulesSection";
import { PlatformCoreSection } from "./components/PlatformCoreSection";
import { PricingSection } from "./components/PricingSection";
import { CtaSection } from "./components/CtaSection";
import { LandingFooter } from "./components/LandingFooter";

export function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingHeader />
      <main className="flex flex-1 flex-col">
        <LandingHero />
        <ModulesSection />
        <PlatformCoreSection />
        <PricingSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
