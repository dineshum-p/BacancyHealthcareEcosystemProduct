/**
 * BAC-38: resolves the tenant slug from a request's `Host` header against a
 * configured root domain, so a patient can reach their clinic's public
 * self-registration page (e.g. `acme-clinic.yourapp.com/register`) without
 * ever typing a workspace/tenant name -- mirrors `services/tenant`'s own
 * tenant-repository doc comment, which already treats "a subdomain slug" as
 * an accepted tenant identifier, just never implemented on the frontend
 * until now.
 *
 * Deliberately conservative: only a SINGLE label ahead of the root domain is
 * accepted as a tenant slug. The bare root domain and `www` are treated as
 * the apex (no tenant), a nested subdomain (`foo.acme-clinic.yourapp.com`)
 * returns `null` rather than guessing which label is the slug, and matching
 * is anchored on the exact remaining hostname suffix -- never a raw string
 * suffix check -- so `evil-yourapp.com` cannot be mistaken for a subdomain
 * of `yourapp.com`.
 */
export function resolveTenantSlugFromHost(
  host: string,
  rootDomain: string,
): string | null {
  const normalizedRoot = rootDomain.trim().toLowerCase();
  if (!normalizedRoot) {
    return null;
  }

  const hostname = host.split(":")[0].toLowerCase();

  if (hostname === normalizedRoot || hostname === `www.${normalizedRoot}`) {
    return null;
  }

  const suffix = `.${normalizedRoot}`;
  if (!hostname.endsWith(suffix)) {
    return null;
  }

  const slug = hostname.slice(0, -suffix.length);
  if (!slug || slug.includes(".")) {
    return null;
  }

  return slug;
}
