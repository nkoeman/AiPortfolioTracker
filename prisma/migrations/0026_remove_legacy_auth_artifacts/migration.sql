-- Remove legacy auth tables and user fields from pre-Clerk auth approaches.
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "VerificationToken" CASCADE;

ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordHash";
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerified";
ALTER TABLE "User" DROP COLUMN IF EXISTS "image";

-- Reconcile historical defaults that caused schema drift.
ALTER TABLE "DailyPortfolioValue" ALTER COLUMN "inputHash" DROP DEFAULT;
ALTER TABLE "DegiroVenueMap" ALTER COLUMN "updatedAt" DROP DEFAULT;
