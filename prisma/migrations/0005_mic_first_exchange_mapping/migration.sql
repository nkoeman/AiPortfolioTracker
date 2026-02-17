-- Add MIC and broker-venue traceability fields on listings.
ALTER TABLE "InstrumentListing"
ADD COLUMN "exchangeMic" TEXT,
ADD COLUMN "degiroBeursCode" TEXT;

CREATE INDEX "InstrumentListing_isin_exchangeMic_idx" ON "InstrumentListing"("isin", "exchangeMic");
CREATE INDEX "InstrumentListing_isin_degiroBeursCode_idx" ON "InstrumentListing"("isin", "degiroBeursCode");

-- Curated broker venue map: DeGiro beurs code -> MIC.
CREATE TABLE "DegiroVenueMap" (
  "id" TEXT NOT NULL,
  "brokerVenueCode" TEXT NOT NULL,
  "mic" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DegiroVenueMap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DegiroVenueMap_brokerVenueCode_key" ON "DegiroVenueMap"("brokerVenueCode");

-- EODHD exchange directory: maps operating MICs to EODHD exchange codes.
CREATE TABLE "EodhdExchange" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "operatingMICs" TEXT NOT NULL,
  "country" TEXT,
  "currency" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EodhdExchange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EodhdExchange_code_key" ON "EodhdExchange"("code");
CREATE INDEX "EodhdExchange_code_idx" ON "EodhdExchange"("code");

-- Initial curated DeGiro venue -> MIC mappings.
INSERT INTO "DegiroVenueMap" ("id", "brokerVenueCode", "mic", "description", "createdAt", "updatedAt") VALUES
  ('c_degiro_eam', 'EAM', 'XAMS', 'Euronext Amsterdam', NOW(), NOW()),
  ('c_degiro_xet', 'XET', 'XETR', 'Xetra', NOW(), NOW()),
  ('c_degiro_lse', 'LSE', 'XLON', 'London Stock Exchange', NOW(), NOW()),
  ('c_degiro_nas', 'NAS', 'XNAS', 'Nasdaq', NOW(), NOW()),
  ('c_degiro_nys', 'NYS', 'XNYS', 'New York Stock Exchange', NOW(), NOW()),
  ('c_degiro_par', 'PAR', 'XPAR', 'Euronext Paris', NOW(), NOW()),
  ('c_degiro_mil', 'MIL', 'XMIL', 'Borsa Italiana', NOW(), NOW())
ON CONFLICT ("brokerVenueCode") DO NOTHING;