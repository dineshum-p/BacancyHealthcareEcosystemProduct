import { headers } from "next/headers";
import { LoginPage } from "@/src/features/login/LoginPage";
import { resolveTenantSlugFromHost } from "@/src/lib/tenant/resolveTenantSlugFromHost";

/**
 * BAC-38: resolves the tenant from this request's own `Host` header
 * (server-side, same mechanism as `middleware.ts`) and passes it to
 * `LoginPage` so a caller reaching `/login` via a tenant subdomain
 * (`<slug>.<APP_ROOT_DOMAIN>`) never has to type the workspace field.
 * Doesn't go through `middleware.ts` itself -- that only rewrites
 * `/register` into the `[tenantSlug]` route structure; `/login` is a single
 * shared route for every tenant, so it resolves independently here instead.
 */
export default async function Page() {
  const rootDomain = process.env.APP_ROOT_DOMAIN;
  const host = (await headers()).get("host");
  const initialTenantSlug =
    rootDomain && host
      ? resolveTenantSlugFromHost(host, rootDomain) ?? undefined
      : undefined;

  return <LoginPage initialTenantSlug={initialTenantSlug} />;
}
