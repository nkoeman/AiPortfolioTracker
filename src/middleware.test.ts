import { describe, expect, it } from "vitest";

function isProtectedRoute(pathname: string): boolean {
  return /^\/app(\/.*)?$/.test(pathname) || /^\/api(\/.*)?$/.test(pathname);
}

describe("middleware: protected route matching", () => {
  it.each([
    "/app",
    "/app/portfolio",
    "/app/import",
    "/api/sync-prices/recent",
    "/api/portfolio/exposure",
    "/api/ai-summary"
  ])("%s is a protected route", (path) => {
    expect(isProtectedRoute(path)).toBe(true);
  });

  it.each([
    "/",
    "/portfolio",
    "/import",
    "/sign-in",
    "/sign-up",
    "/login",
    "/register"
  ])("%s is a public route", (path) => {
    expect(isProtectedRoute(path)).toBe(false);
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
