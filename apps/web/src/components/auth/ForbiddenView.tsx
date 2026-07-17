/** BAC-12, AC4: rendered by `RequireRole` for a denied caller (403). */
export function ForbiddenView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-background px-6 py-24 text-center">
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-destructive">
        403
      </p>
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        You are not authorized to view this page
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This console is restricted to Super Admins. If you believe this is a
        mistake, contact your system administrator.
      </p>
    </div>
  );
}
