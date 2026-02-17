-- Switch Price storage from daily dates to canonical EODHD weekly period-end dates.
-- We clear existing daily rows so the table is weekly-only moving forward.
DELETE FROM "Price";

DROP INDEX IF EXISTS "Price_listingId_date_key";
DROP INDEX IF EXISTS "Price_date_idx";

ALTER TABLE "Price" RENAME COLUMN "date" TO "weekEndDate";

CREATE UNIQUE INDEX "Price_listingId_weekEndDate_key" ON "Price"("listingId", "weekEndDate");
CREATE INDEX "Price_weekEndDate_idx" ON "Price"("weekEndDate");
