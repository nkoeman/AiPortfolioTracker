-- Add daily listing price cache
CREATE TABLE "DailyListingPrice" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "adjustedClose" DECIMAL(20, 8) NOT NULL,
  "close" DECIMAL(20, 8),
  "currency" TEXT,
  "source" TEXT NOT NULL DEFAULT 'EODHD',
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyListingPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyListingPrice_listingId_date_key" ON "DailyListingPrice"("listingId", "date");
CREATE INDEX "DailyListingPrice_date_idx" ON "DailyListingPrice"("date");

ALTER TABLE "DailyListingPrice"
  ADD CONSTRAINT "DailyListingPrice_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "InstrumentListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update daily portfolio value storage shape
ALTER TABLE "DailyPortfolioValue" RENAME COLUMN "totalValueEur" TO "valueEur";
ALTER TABLE "DailyPortfolioValue" ALTER COLUMN "date" TYPE DATE;
ALTER TABLE "DailyPortfolioValue" ADD COLUMN "inputHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DailyPortfolioValue" ADD COLUMN "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DailyPortfolioValue" DROP COLUMN "createdAt";

CREATE INDEX "DailyPortfolioValue_date_idx" ON "DailyPortfolioValue"("date");
