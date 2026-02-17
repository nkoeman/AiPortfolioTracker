CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

ALTER TABLE "Instrument"
ADD COLUMN "displayName" TEXT,
ADD COLUMN "figi" TEXT,
ADD COLUMN "figiComposite" TEXT,
ADD COLUMN "securityType" TEXT,
ADD COLUMN "securityType2" TEXT,
ADD COLUMN "marketSector" TEXT,
ADD COLUMN "assetClass" TEXT,
ADD COLUMN "issuer" TEXT,
ADD COLUMN "countryOfRisk" TEXT,
ADD COLUMN "openFigiTicker" TEXT,
ADD COLUMN "openFigiExchCode" TEXT,
ADD COLUMN "openFigiMic" TEXT;

CREATE TABLE "InstrumentEnrichment" (
  "id" TEXT NOT NULL,
  "isin" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'OPENFIGI',
  "status" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstrumentEnrichment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstrumentEnrichment_isin_source_key" ON "InstrumentEnrichment"("isin", "source");
CREATE INDEX "InstrumentEnrichment_source_status_idx" ON "InstrumentEnrichment"("source", "status");

ALTER TABLE "InstrumentEnrichment"
ADD CONSTRAINT "InstrumentEnrichment_isin_fkey"
FOREIGN KEY ("isin") REFERENCES "Instrument"("isin") ON DELETE RESTRICT ON UPDATE CASCADE;
