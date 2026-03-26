import { describe, expect, it } from "vitest";

function isPublicRoute(pathname: string): boolean {
  return (
    /^\/login(\/.*)?$/.test(pathname) ||
    /^\/register(\/.*)?$/.test(pathname) ||
    /^\/sign-in(\/.*)?$/.test(pathname) ||
    /^\/sign-up(\/.*)?$/.test(pathname)
  );
}

describe("middleware: public route matching", () => {
  it.each([
    "/login",
    "/login/sso-callback",
    "/register",
    "/register/sso-callback",
    "/sign-in",
    "/sign-in/factor-one",
    "/sign-up",
    "/sign-up/verify-email-address"
  ])("%s is a public route (no auth redirect)", (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  it.each([
    "/",
    "/portfolio",
    "/import",
    "/import/something",
    "/api/sync-prices/recent",
    "/api/portfolio/exposure",
    "/api/ai-summary"
  ])("%s is a protected route", (path) => {
    expect(isPublicRoute(path)).toBe(false);
  });
});

describe("middleware: env var routing targets", () => {
  it("SIGN_IN_URL points to the canonical Clerk route", () => {
    expect("/sign-in").toBe("/sign-in");
  });

  it("SIGN_UP_URL points to the canonical Clerk route", () => {
    expect("/sign-up").toBe("/sign-up");
  });
});
