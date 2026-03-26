# Authentication Architecture (Clerk)

## Runtime flow
- `src/middleware.ts` enforces authentication for app and API routes, while keeping auth pages public.
- Unauthenticated requests are redirected to `/sign-in` with `redirect_url`.
- `src/app/sign-in/[[...sign-in]]/page.tsx` and `src/app/sign-up/[[...sign-up]]/page.tsx` render embedded Clerk components directly in-app.
- `/login` and `/register` are compatibility routes that permanently redirect to canonical Clerk routes.

## App user linking
- `src/lib/auth/appUser.ts` links Clerk users to local `User` rows.
- Link priority:
  1. existing `clerkUserId`
  2. existing email (first Clerk sign-in migration path)
  3. create new user

## Sign-out
- `UserButton` plus explicit `Sign out` button are available in the shell.
- Sign-out redirect target is `/sign-in`.

## Clerk Dashboard requirements
- Enable authentication methods:
  - Email + password
  - Google
  - Apple
  - LinkedIn OIDC
- Ensure social providers are enabled in both sign-in and sign-up experiences (Clerk controls this centrally).
- Set allowed redirect URLs for local and production environments.
