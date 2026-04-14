import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/app(.*)",
  "/api(.*)"
]);

export default clerkMiddleware((auth, request) => {
  if (!isProtectedRoute(request)) {
    return;
  }

  const { userId } = auth();
  if (!userId) {
    const signInUrl = new URL("/sign-in", request.url);
    const relativeRedirect =
      `${request.nextUrl.pathname}${request.nextUrl.search}` || "/";
    signInUrl.searchParams.set("redirect_url", relativeRedirect);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    "/app/:path*",
    "/api/:path*"
  ]
};
