import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { modules } from "../data";

export function ModulesSection() {
  return (
    <section id="modules" className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          Five modules. One connected ecosystem.
        </h2>
        <p className="mt-3 text-muted-foreground">
          Activate the modules a tenant needs — the platform auto-wires the
          data flows between them, no extra configuration required.
        </p>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Card key={mod.name} className="p-2">
              <CardHeader>
                <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <CardTitle className="text-lg">{mod.name}</CardTitle>
                <CardDescription>{mod.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Ideal for: {mod.idealFor}
                </p>
                <ul className="flex flex-col gap-1.5 text-sm text-foreground">
                  {mod.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
