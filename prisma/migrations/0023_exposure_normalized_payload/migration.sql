ALTER TABLE "InstrumentExposureSnapshot"
ADD COLUMN "normalizedPayload" JSONB,
ADD COLUMN "normalizerVersion" TEXT,
ADD COLUMN "coverageMeta" JSONB;
