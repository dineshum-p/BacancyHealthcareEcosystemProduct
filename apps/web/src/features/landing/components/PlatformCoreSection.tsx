import { platformCore } from "../data";

export function PlatformCoreSection() {
  return (
    <section id="platform" className="border-t border-border bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Built into every tenant, from day one
          </h2>
          <p className="mt-3 text-muted-foreground">
            These platform-core services are provisioned automatically —
            regardless of which modules a tenant activates.
          </p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {platformCore.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.name} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-heading font-semibold">{item.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
