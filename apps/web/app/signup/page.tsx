import { headers } from "next/headers";
import { PatientSignUpPage } from "@/src/features/patient-signup/PatientSignUpPage";
import { resolveTenantSlugFromHost } from "@/src/lib/tenant/resolveTenantSlugFromHost";

/**
 * BAC-43: resolves the tenant from this request's own `Host` header, same
 * mechanism as `app/login/page.tsx` (BAC-38), so a caller reaching `/signup`
 * via a tenant subdomain (`<slug>.<APP_ROOT_DOMAIN>`) never has to type the
 * workspace field either.
 */
export default async function Page() {
  const rootDomain = process.env.APP_ROOT_DOMAIN;
  const host = (await headers()).get("host");
  const initialTenantSlug =
    rootDomain && host
      ? resolveTenantSlugFromHost(host, rootDomain) ?? undefined
      : undefined;

  return <PatientSignUpPage initialTenantSlug={initialTenantSlug} />;
}
