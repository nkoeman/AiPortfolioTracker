# Clerk Migration Notes

## Scope

Authentication is migrated from Auth0/NextAuth to Clerk (`@clerk/nextjs`) with app-level user linking in Prisma.

## Local user linking behavior

`src/lib/auth/appUser.ts` is the single source for server-side user resolution:

1. Read Clerk session (`auth()`).
2. Load Clerk profile (`currentUser()`), derive primary email.
3. Try local `User` by `clerkUserId`.
4. If not found, try local `User` by email and attach `clerkUserId`.
5. If still not found, create a new `User` row.

This preserves existing users while moving auth identity ownership to Clerk.

## Prisma changes

`User` model now contains:

- `clerkUserId String? @unique`

Migration file:

- `prisma/migrations/0024_add_clerk_user_id/migration.sql`

## Required environment variables

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_SIGN_IN_URL` (optional)
- `CLERK_SIGN_UP_URL` (optional)
- `CLERK_AFTER_SIGN_IN_URL` (optional)
- `CLERK_AFTER_SIGN_UP_URL` (optional)

## Manual verification checklist

- Anonymous user is redirected from protected routes.
- Sign up via `/sign-up` succeeds.
- Sign in via `/sign-in` succeeds.
- Sign out via Clerk `UserButton` works.
- Existing local user with matching email gets linked to `clerkUserId`.
- New user with unknown email gets a new `User` row.
- Protected API routes return `401` when unauthenticated.
