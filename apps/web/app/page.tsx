import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { LandingPage } from "@/src/features/landing/LandingPage";
import { resolveTenantSlugFromHost } from "@/src/lib/tenant/resolveTenantSlugFromHost";

/**
 * BAC-38's tenant-subdomain resolution extended to `/`: a caller reaching the
 * app via `<slug>.<APP_ROOT_DOMAIN>` is there for their tenant's workspace,
 * not the marketing site, so this redirects to `/login` (which independently
 * resolves the same host header to pre-fill the workspace field) instead of
 * showing `LandingPage`. The apex/root domain (no resolvable slug) still
 * gets the landing page.
 */
export default async function Page() {
  const rootDomain = process.env.APP_ROOT_DOMAIN;
  const host = (await headers()).get("host");
  const tenantSlug =
    rootDomain && host ? resolveTenantSlugFromHost(host, rootDomain) : null;

  if (tenantSlug) {
    redirect("/login");
  }

  return <LandingPage />;
}
