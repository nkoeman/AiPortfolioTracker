-- Create listing table
CREATE TABLE "InstrumentListing" (
  "id" TEXT NOT NULL,
  "isin" TEXT NOT NULL,
  "exchangeName" TEXT NOT NULL,
  "exchangeCode" TEXT NOT NULL,
  "eodhdCode" TEXT,
  "currency" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "mappingStatus" "MappingStatus" NOT NULL DEFAULT 'UNMAPPED',
  "mappingError" TEXT,
  "lastMappedAt" TIMESTAMP(3),
  "lastPriceSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstrumentListing_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InstrumentListing"
ADD CONSTRAINT "InstrumentListing_isin_fkey"
FOREIGN KEY ("isin") REFERENCES "Instrument"("isin") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Transaction updates
ALTER TABLE "Transaction"
ADD COLUMN "listingId" TEXT,
ADD COLUMN "exchangeCode" TEXT NOT NULL DEFAULT 'UNKNOWN';

-- Seed listings from existing transactions
INSERT INTO "InstrumentListing" (
  "id", "isin", "exchangeName", "exchangeCode", "mappingStatus", "createdAt", "updatedAt"
)
SELECT
  CONCAT('lst_', md5(i."isin" || '|' || COALESCE(NULLIF(t."exchange", ''), 'UNKNOWN'))),
  i."isin",
  COALESCE(NULLIF(t."exchange", ''), 'UNKNOWN'),
  UPPER(COALESCE(NULLIF(t."exchange", ''), 'UNKNOWN')),
  'UNMAPPED'::"MappingStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Transaction" t
JOIN "Instrument" i ON i."id" = t."instrumentId"
GROUP BY i."isin", COALESCE(NULLIF(t."exchange", ''), 'UNKNOWN');

-- Mark one primary listing per ISIN
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "isin" ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM "InstrumentListing"
)
UPDATE "InstrumentListing" l
SET "isPrimary" = (r.rn = 1)
FROM ranked r
WHERE l."id" = r."id";

-- Move old instrument-level mapping data to primary listing where possible
UPDATE "InstrumentListing" l
SET
  "eodhdCode" = i."eodhdCode",
  "currency" = COALESCE(i."currency", l."currency"),
  "mappingStatus" = i."mappingStatus",
  "mappingError" = i."mappingError",
  "lastMappedAt" = i."lastMappedAt",
  "lastPriceSyncAt" = i."lastPriceSyncAt",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Instrument" i
WHERE l."isin" = i."isin"
  AND l."isPrimary" = true
  AND i."eodhdCode" IS NOT NULL;

-- Link transactions to listings
UPDATE "Transaction" t
SET "exchangeCode" = UPPER(COALESCE(NULLIF(t."exchange", ''), 'UNKNOWN'));

UPDATE "Transaction" t
SET "listingId" = l."id"
FROM "Instrument" i, "InstrumentListing" l
WHERE t."instrumentId" = i."id"
  AND l."isin" = i."isin"
  AND l."exchangeCode" = UPPER(COALESCE(NULLIF(t."exchange", ''), 'UNKNOWN'));

-- Fallback to primary listing for remaining transactions
UPDATE "Transaction" t
SET "listingId" = l."id"
FROM "Instrument" i
JOIN "InstrumentListing" l
  ON l."isin" = i."isin"
 AND l."isPrimary" = true
WHERE t."instrumentId" = i."id"
  AND t."listingId" IS NULL;

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "InstrumentListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Transaction_listingId_tradeAt_idx" ON "Transaction"("listingId", "tradeAt");

-- Price migration from isin/date to listing/date
ALTER TABLE "Price"
ADD COLUMN "listingId" TEXT;

UPDATE "Price" p
SET "listingId" = l."id",
    "currency" = COALESCE(l."currency", p."currency")
FROM "InstrumentListing" l
WHERE l."isin" = p."isin"
  AND l."isPrimary" = true;

DELETE FROM "Price" WHERE "listingId" IS NULL;

ALTER TABLE "Price"
ALTER COLUMN "listingId" SET NOT NULL;

ALTER TABLE "Price"
ADD CONSTRAINT "Price_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "InstrumentListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Price_isin_date_key";
DROP INDEX IF EXISTS "Price_date_idx";
ALTER TABLE "Price" DROP CONSTRAINT IF EXISTS "Price_isin_fkey";
ALTER TABLE "Price" DROP COLUMN "isin";

CREATE UNIQUE INDEX "Price_listingId_date_key" ON "Price"("listingId", "date");
CREATE INDEX "Price_date_idx" ON "Price"("date");

-- Drop old instrument-level mapping columns
DROP INDEX IF EXISTS "Instrument_eodhdCode_key";
ALTER TABLE "Instrument"
DROP COLUMN "eodhdCode",
DROP COLUMN "currency",
DROP COLUMN "mappingStatus",
DROP COLUMN "mappingError",
DROP COLUMN "lastMappedAt",
DROP COLUMN "lastPriceSyncAt";

-- Listing indexes
CREATE UNIQUE INDEX "InstrumentListing_eodhdCode_key" ON "InstrumentListing"("eodhdCode");
CREATE UNIQUE INDEX "InstrumentListing_isin_exchangeCode_key" ON "InstrumentListing"("isin", "exchangeCode");
CREATE INDEX "InstrumentListing_isin_isPrimary_idx" ON "InstrumentListing"("isin", "isPrimary");
