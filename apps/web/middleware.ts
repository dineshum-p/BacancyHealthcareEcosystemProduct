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
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/register") {
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
 * Belt-and-suspenders with the in-function pathname check above: `matcher`
 * stops Next's router from invoking this middleware at all for any other
 * path (cheaper, runs first), while the in-function check keeps `middleware`
 * itself correct if ever called directly or this config drifts. MUST stay a
 * literal array of static strings -- Next statically parses this at build
 * time and fails the entire build if it's a variable reference.
 */
export const config = {
  matcher: ["/register"],
};
