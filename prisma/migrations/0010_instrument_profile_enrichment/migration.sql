CREATE TYPE "AssetType" AS ENUM ('STOCK', 'ETF', 'BOND', 'FUND', 'OTHER');
CREATE TYPE "AssetClass" AS ENUM ('EQUITY', 'BOND', 'COMMODITY', 'MIXED', 'OTHER');
CREATE TYPE "Region" AS ENUM ('US', 'EU', 'UK', 'GLOBAL', 'EM', 'APAC', 'COUNTRY_SPECIFIC', 'UNKNOWN');
CREATE TYPE "ProfileSource" AS ENUM ('RULE', 'WIKIDATA', 'MIXED');
CREATE TYPE "EnrichmentAttemptSource" AS ENUM ('RULE', 'WIKIDATA');
CREATE TYPE "EnrichmentAttemptStatus" AS ENUM ('SUCCESS', 'FAILED');

CREATE TABLE "InstrumentProfile" (
  "isin" TEXT NOT NULL,
  "assetType" "AssetType" NOT NULL,
  "assetClass" "AssetClass" NOT NULL,
  "region" "Region" NOT NULL,
  "trackedIndexName" TEXT,
  "fxHedged" BOOLEAN,
  "sector" TEXT,
  "industry" TEXT,
  "issuer" TEXT,
  "countryOfRisk" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "source" "ProfileSource" NOT NULL DEFAULT 'RULE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstrumentProfile_pkey" PRIMARY KEY ("isin")
);

CREATE INDEX "InstrumentProfile_assetType_assetClass_idx" ON "InstrumentProfile"("assetType", "assetClass");
CREATE INDEX "InstrumentProfile_region_idx" ON "InstrumentProfile"("region");

ALTER TABLE "InstrumentProfile"
ADD CONSTRAINT "InstrumentProfile_isin_fkey"
FOREIGN KEY ("isin") REFERENCES "Instrument"("isin") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InstrumentEnrichmentAttempt" (
  "id" TEXT NOT NULL,
  "isin" TEXT NOT NULL,
  "source" "EnrichmentAttemptSource" NOT NULL,
  "status" "EnrichmentAttemptStatus" NOT NULL,
  "errorMessage" TEXT,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstrumentEnrichmentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstrumentEnrichmentAttempt_isin_source_key" ON "InstrumentEnrichmentAttempt"("isin", "source");
CREATE INDEX "InstrumentEnrichmentAttempt_source_status_idx" ON "InstrumentEnrichmentAttempt"("source", "status");

ALTER TABLE "InstrumentEnrichmentAttempt"
ADD CONSTRAINT "InstrumentEnrichmentAttempt_isin_fkey"
FOREIGN KEY ("isin") REFERENCES "Instrument"("isin") ON DELETE RESTRICT ON UPDATE CASCADE;
