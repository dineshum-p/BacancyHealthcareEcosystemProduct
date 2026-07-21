import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { complianceBadges } from "../data";

export function LandingHero() {
  return (
    <section className="border-b border-border bg-gradient-to-b from-accent/40 to-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-6 py-20 text-center sm:py-28">
        <Badge variant="secondary" className="h-6 px-3 text-xs">
          Multi-tenant healthcare SaaS
        </Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          One platform that unifies clinics, pharmacies, doctors, insurers,
          and patients
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          HEP replaces disconnected point solutions with a single
          interoperable ecosystem — every module deployable independently or
          together, governed by strict role-based access and complete tenant
          data isolation.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a href="#contact" className={buttonVariants({ size: "lg" })}>
            Request a demo
          </a>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Sign in
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
          {complianceBadges.map((badge) => (
            <Badge key={badge} variant="outline">
              {badge}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}
