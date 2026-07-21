import { buttonVariants } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section id="contact" className="border-y border-border bg-primary text-primary-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          Ready to unify your healthcare operations?
        </h2>
        <p className="max-w-xl text-primary-foreground/80">
          Talk to our team about onboarding your clinic, pharmacy, practice,
          or health plan onto HEP.
        </p>
        <a
          href="mailto:hello@hep.health"
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          Contact sales
        </a>
      </div>
    </section>
  );
}
