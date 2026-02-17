-- Instrument mapping fields
CREATE TYPE "MappingStatus" AS ENUM ('UNMAPPED', 'MAPPED', 'FAILED');

ALTER TABLE "Instrument"
ADD COLUMN "eodhdCode" TEXT,
ADD COLUMN "currency" TEXT,
ADD COLUMN "mappingStatus" "MappingStatus" NOT NULL DEFAULT 'UNMAPPED',
ADD COLUMN "mappingError" TEXT,
ADD COLUMN "lastMappedAt" TIMESTAMP(3),
ADD COLUMN "lastPriceSyncAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Instrument_eodhdCode_key" ON "Instrument"("eodhdCode");

-- Price table migration to adjusted close keyed by ISIN/date
ALTER TABLE "Price"
ADD COLUMN "isin" TEXT,
ADD COLUMN "adjClose" NUMERIC(20,8),
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'EODHD';

UPDATE "Price" p
SET "isin" = i."isin",
    "adjClose" = p."close",
    "currency" = COALESCE(p."currency", i."currency", 'EUR')
FROM "Instrument" i
WHERE p."instrumentId" = i."id";

ALTER TABLE "Price"
ALTER COLUMN "isin" SET NOT NULL,
ALTER COLUMN "adjClose" SET NOT NULL,
ALTER COLUMN "date" TYPE DATE USING "date"::date;

DROP INDEX IF EXISTS "Price_instrumentId_date_key";
DROP INDEX IF EXISTS "Price_instrumentId_exchange_date_key";

ALTER TABLE "Price"
DROP COLUMN "instrumentId",
DROP COLUMN "exchange",
DROP COLUMN "close";

CREATE UNIQUE INDEX "Price_isin_date_key" ON "Price"("isin", "date");
CREATE INDEX "Price_date_idx" ON "Price"("date");

ALTER TABLE "Price"
ADD CONSTRAINT "Price_isin_fkey"
FOREIGN KEY ("isin") REFERENCES "Instrument"("isin") ON DELETE RESTRICT ON UPDATE CASCADE;
