import { Wordmark } from "@/src/components/brand/Wordmark";
import { modules, complianceBadges } from "../data";

export function LandingFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="grid gap-10 sm:grid-cols-3">
        <div>
          <Wordmark size="sm" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            A unified digital healthcare ecosystem for clinics, pharmacies,
            doctors, insurers, and patients.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Modules</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
            {modules.map((mod) => (
              <li key={mod.name}>{mod.name}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Compliance</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
            {complianceBadges.map((badge) => (
              <li key={badge}>{badge}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Healthcare Ecosystem Platform (HEP).
        Confidential — internal use only.
      </p>
    </footer>
  );
}
