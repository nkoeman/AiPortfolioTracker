-- Backfill weekly prices into canonical daily price table before removing legacy weekly table.
INSERT INTO "DailyListingPrice" (
  "id",
  "listingId",
  "date",
  "adjustedClose",
  "close",
  "currency",
  "source",
  "fetchedAt"
)
SELECT
  CONCAT('bf_', md5(random()::text || clock_timestamp()::text || p."listingId" || p."weekEndDate"::text)),
  p."listingId",
  p."weekEndDate",
  p."adjClose",
  NULL,
  p."currency",
  p."source",
  p."createdAt"
FROM "Price" p
ON CONFLICT ("listingId", "date") DO UPDATE
SET
  "adjustedClose" = EXCLUDED."adjustedClose",
  "currency" = COALESCE(EXCLUDED."currency", "DailyListingPrice"."currency"),
  "source" = EXCLUDED."source",
  "fetchedAt" = EXCLUDED."fetchedAt";

-- Weekly rows keep a logical Friday key and store the concrete valuation date used.
ALTER TABLE "WeeklyPortfolioValue"
ADD COLUMN "valuationDateUsed" DATE,
ADD COLUMN "inputHash" TEXT,
ADD COLUMN "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "WeeklyPortfolioValue"
SET
  "valuationDateUsed" = "weekEndDate",
  "inputHash" = CONCAT('legacy_', "id")
WHERE "valuationDateUsed" IS NULL OR "inputHash" IS NULL;

ALTER TABLE "WeeklyPortfolioValue"
ALTER COLUMN "valuationDateUsed" SET NOT NULL,
ALTER COLUMN "inputHash" SET NOT NULL;

-- Remove legacy weekly price cache table; canonical pricing is DailyListingPrice only.
DROP TABLE "Price";
