import { describe, expect, it } from "vitest";
import { resolveTenantSlugFromHost } from "./resolveTenantSlugFromHost";

describe("resolveTenantSlugFromHost (BAC-38)", () => {
  it("extracts the tenant slug from a subdomain of the root domain", () => {
    expect(resolveTenantSlugFromHost("acme-clinic.yourapp.com", "yourapp.com")).toBe(
      "acme-clinic",
    );
  });

  it("strips the port before matching (local dev)", () => {
    expect(resolveTenantSlugFromHost("acme-clinic.localhost:3000", "localhost")).toBe(
      "acme-clinic",
    );
  });

  it("is case-insensitive on both the host and the root domain", () => {
    expect(resolveTenantSlugFromHost("Acme-Clinic.YourApp.com", "yourapp.com")).toBe(
      "acme-clinic",
    );
  });

  it("returns null for the bare apex root domain (no tenant)", () => {
    expect(resolveTenantSlugFromHost("yourapp.com", "yourapp.com")).toBeNull();
  });

  it("returns null for www on the root domain (treated as apex, not a tenant)", () => {
    expect(resolveTenantSlugFromHost("www.yourapp.com", "yourapp.com")).toBeNull();
  });

  it("returns null for a host unrelated to the root domain", () => {
    expect(resolveTenantSlugFromHost("acme-clinic.other-app.com", "yourapp.com")).toBeNull();
  });

  it("returns null for a lookalike domain that merely contains the root domain as a substring", () => {
    expect(resolveTenantSlugFromHost("evil-yourapp.com", "yourapp.com")).toBeNull();
    expect(resolveTenantSlugFromHost("yourapp.com.evil.com", "yourapp.com")).toBeNull();
  });

  it("returns null for a nested subdomain (only a single tenant-slug label is supported)", () => {
    expect(resolveTenantSlugFromHost("foo.acme-clinic.yourapp.com", "yourapp.com")).toBeNull();
  });

  it("returns null when the root domain is empty", () => {
    expect(resolveTenantSlugFromHost("acme-clinic.yourapp.com", "")).toBeNull();
  });
});
