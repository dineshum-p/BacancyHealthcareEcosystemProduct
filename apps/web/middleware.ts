import { NextResponse, type NextRequest } from "next/server";
import { resolveTenantSlugFromHost } from "@/src/lib/tenant/resolveTenantSlugFromHost";

/**
 * BAC-38: lets a patient reach their clinic's public self-registration page
 * via a tenant subdomain (e.g. `acme-clinic.yourapp.com/register`) instead
 * of typing/knowing a workspace slug -- rewrites internally to the existing
 * `/[tenantSlug]/register` route (`PublicSelfRegisterPage` needs no changes
 * at all: it already reads `tenantSlug` from that dynamic segment).
 *
 * A no-op passthrough whenever `APP_ROOT_DOMAIN` is unset or the host has no
 * tenant subdomain (apex/www/an unrelated host) -- so path-based
 * `/<slug>/register` URLs keep working unchanged, and this is safe to
 * deploy without `APP_ROOT_DOMAIN` configured at all.
 */
const TENANT_SCOPED_PATHS = ["/register"];

export function middleware(request: NextRequest) {
  if (!TENANT_SCOPED_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const rootDomain = process.env.APP_ROOT_DOMAIN;
  if (!rootDomain) {
    return NextResponse.next();
  }

  const host = request.headers.get("host");
  const slug = host ? resolveTenantSlugFromHost(host, rootDomain) : null;
  if (!slug) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${slug}${request.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

/**
 * Belt-and-suspenders with the `TENANT_SCOPED_PATHS` check above: `matcher`
 * stops Next's router from invoking this middleware at all for any other
 * path (cheaper, runs first), while the in-function check keeps `middleware`
 * itself correct if ever called directly or the matcher config drifts.
 */
export const config = {
  matcher: TENANT_SCOPED_PATHS,
};
