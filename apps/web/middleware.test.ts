import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

describe("middleware (BAC-38: subdomain tenant resolution)", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("rewrites /register on a tenant subdomain to /<slug>/register", async () => {
    process.env.APP_ROOT_DOMAIN = "yourapp.com";

    const request = new NextRequest("https://acme-clinic.yourapp.com/register", {
      headers: { host: "acme-clinic.yourapp.com" },
    });
    const response = middleware(request);

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://acme-clinic.yourapp.com/acme-clinic/register",
    );
  });

  it("passes through unchanged when APP_ROOT_DOMAIN is unset", async () => {
    delete process.env.APP_ROOT_DOMAIN;

    const request = new NextRequest("https://acme-clinic.yourapp.com/register", {
      headers: { host: "acme-clinic.yourapp.com" },
    });
    const response = middleware(request);

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("passes through unchanged on the apex domain (no tenant subdomain)", async () => {
    process.env.APP_ROOT_DOMAIN = "yourapp.com";

    const request = new NextRequest("https://yourapp.com/register", {
      headers: { host: "yourapp.com" },
    });
    const response = middleware(request);

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("passes through unchanged on a host unrelated to the root domain", async () => {
    process.env.APP_ROOT_DOMAIN = "yourapp.com";

    const request = new NextRequest("https://not-yourapp.com/register", {
      headers: { host: "not-yourapp.com" },
    });
    const response = middleware(request);

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("passes through unchanged for a path other than /register, even on a tenant subdomain", async () => {
    process.env.APP_ROOT_DOMAIN = "yourapp.com";

    const request = new NextRequest("https://acme-clinic.yourapp.com/login", {
      headers: { host: "acme-clinic.yourapp.com" },
    });
    const response = middleware(request);

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("works with a local *.localhost dev host", async () => {
    process.env.APP_ROOT_DOMAIN = "localhost";

    const request = new NextRequest("http://acme-clinic.localhost:3000/register", {
      headers: { host: "acme-clinic.localhost:3000" },
    });
    const response = middleware(request);

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://acme-clinic.localhost:3000/acme-clinic/register",
    );
  });
});
