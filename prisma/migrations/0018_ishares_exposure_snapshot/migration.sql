-- CreateEnum
CREATE TYPE "ExposureSource" AS ENUM ('ISHARES');

-- CreateEnum
CREATE TYPE "ExposureStatus" AS ENUM ('READY', 'FAILED');

-- CreateTable
CREATE TABLE "InstrumentExposureSnapshot" (
  "id" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "source" "ExposureSource" NOT NULL,
  "status" "ExposureStatus" NOT NULL,
  "asOfDate" DATE,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB,
  "sourceMeta" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstrumentExposureSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstrumentExposureSnapshot_source_status_idx" ON "InstrumentExposureSnapshot"("source", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentExposureSnapshot_instrumentId_source_key" ON "InstrumentExposureSnapshot"("instrumentId", "source");

-- AddForeignKey
ALTER TABLE "InstrumentExposureSnapshot"
ADD CONSTRAINT "InstrumentExposureSnapshot_instrumentId_fkey"
FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
