ALTER TABLE "Transaction"
ADD COLUMN "exchange" TEXT NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE "Price"
ADD COLUMN "exchange" TEXT NOT NULL DEFAULT 'UNKNOWN';

DROP INDEX IF EXISTS "Price_instrumentId_date_key";

CREATE UNIQUE INDEX "Price_instrumentId_exchange_date_key"
ON "Price"("instrumentId", "exchange", "date");
