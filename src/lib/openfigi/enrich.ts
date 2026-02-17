import { EnrichmentStatus, Instrument, Prisma } from "@prisma/client";
import { mapIsins, OpenFigiCandidate, selectOpenFigiCandidate } from "@/lib/openfigi/client";
import { normalizeInstrumentEnrichment } from "@/lib/openfigi/normalizeInstrumentEnrichment";
import { prisma } from "@/lib/prisma";

const DEFAULT_TTL_DAYS = 30;
const DEFAULT_BATCH_SIZE = 25;

type EnrichOptions = {
  userId: string;
  importBatchId: string;
  batchSize?: number;
};

type EnrichSummary = {
  attempted: number;
  enriched: number;
  skipped: number;
  failed: number;
};

type InstrumentWithListingMic = Instrument & {
  listings: Array<{
    exchangeMic: string | null;
    isPrimary: boolean;
  }>;
};

function normalizeValue(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function shouldEnrich(instrument: Instrument, lastFetchedAt: Date | null, ttlDays: number) {
  if (!instrument.displayName || !instrument.securityType2 || !instrument.countryOfRisk) {
    return true;
  }

  if (!lastFetchedAt) return true;
  const ageMs = Date.now() - lastFetchedAt.getTime();
  return ageMs > ttlDays * 24 * 60 * 60 * 1000;
}

function pickPreferredMic(listings: InstrumentWithListingMic["listings"]) {
  const primary = listings.find((listing) => listing.isPrimary && listing.exchangeMic);
  if (primary?.exchangeMic) return normalizeValue(primary.exchangeMic);
  const anyMapped = listings.find((listing) => listing.exchangeMic);
  return anyMapped?.exchangeMic ? normalizeValue(anyMapped.exchangeMic) : null;
}

function candidateToInstrumentUpdate(candidate: OpenFigiCandidate, current: Instrument) {
  return normalizeInstrumentEnrichment(candidate, current);
}

export async function enrichInstrumentsFromOpenFigi(isins: string[], options: EnrichOptions): Promise<EnrichSummary> {
  if (!isins.length) {
    return { attempted: 0, enriched: 0, skipped: 0, failed: 0 };
  }

  const apiKey = process.env.OPENFIGI_API_KEY;
  if (!apiKey) {
    console.warn("[ENRICH][OPENFIGI] OPENFIGI_API_KEY missing; skipping enrichment.", {
      userId: options.userId,
      importBatchId: options.importBatchId
    });
    return { attempted: 0, enriched: 0, skipped: isins.length, failed: 0 };
  }

  const ttlDays = Number(process.env.OPENFIGI_ENRICH_TTL_DAYS || DEFAULT_TTL_DAYS);
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  const instruments = await prisma.instrument.findMany({
    where: { isin: { in: isins } },
    include: {
      listings: {
        where: {
          mappingStatus: "MAPPED",
          eodhdCode: { not: null }
        },
        select: {
          exchangeMic: true,
          isPrimary: true
        }
      }
    }
  });

  const enrichmentRows = await prisma.instrumentEnrichment.findMany({
    where: { isin: { in: isins }, source: "OPENFIGI" },
    select: { isin: true, fetchedAt: true, status: true }
  });

  const lastFetchedByIsin = new Map(
    enrichmentRows.map((row) => [row.isin, row.fetchedAt])
  );

  const instrumentByIsin = new Map(instruments.map((instrument) => [instrument.isin, instrument as InstrumentWithListingMic]));
  const isinsToEnrich = isins.filter((isin) => {
    const instrument = instrumentByIsin.get(isin);
    if (!instrument) return false;
    return shouldEnrich(instrument, lastFetchedByIsin.get(isin) || null, ttlDays);
  });

  if (!isinsToEnrich.length) {
    console.info("[ENRICH][OPENFIGI] no instruments require enrichment", {
      userId: options.userId,
      importBatchId: options.importBatchId,
      count: isins.length
    });
    return { attempted: 0, enriched: 0, skipped: isins.length, failed: 0 };
  }

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < isinsToEnrich.length; i += batchSize) {
    const batch = isinsToEnrich.slice(i, i + batchSize);
    console.info("[ENRICH][OPENFIGI] start batch", {
      userId: options.userId,
      importBatchId: options.importBatchId,
      batchSize: batch.length
    });

    try {
      const results = await mapIsins(batch);
      console.info("[ENRICH][OPENFIGI] ignoring listing identifiers (ticker/exchange/MIC) for Instrument", {
        userId: options.userId,
        importBatchId: options.importBatchId
      });
      for (const result of results) {
        const instrument = instrumentByIsin.get(result.isin);
        if (!instrument) continue;

        const preferredMic = pickPreferredMic(instrument.listings);
        if (result.error) {
          console.warn("[ENRICH][OPENFIGI] failed", {
            userId: options.userId,
            importBatchId: options.importBatchId,
            isin: result.isin,
            error: result.error
          });
          failed += 1;
          await prisma.instrumentEnrichment.upsert({
            where: { isin_source: { isin: result.isin, source: "OPENFIGI" } },
            update: {
              status: EnrichmentStatus.FAILED,
              errorMessage: result.error,
              fetchedAt: new Date(),
              payloadJson: toJsonValue(result)
            },
            create: {
              isin: result.isin,
              status: EnrichmentStatus.FAILED,
              errorMessage: result.error,
              fetchedAt: new Date(),
              payloadJson: toJsonValue(result)
            }
          });
          continue;
        }

        const { candidate, warning } = selectOpenFigiCandidate(result.candidates, preferredMic);
        if (warning) {
          console.warn("[ENRICH][OPENFIGI] candidate warning", {
            userId: options.userId,
            importBatchId: options.importBatchId,
            isin: result.isin,
            warning
          });
        }

        if (!candidate) {
          console.info("[ENRICH][OPENFIGI] missing", {
            userId: options.userId,
            importBatchId: options.importBatchId,
            isin: result.isin
          });
          await prisma.instrumentEnrichment.upsert({
            where: { isin_source: { isin: result.isin, source: "OPENFIGI" } },
            update: {
              status: EnrichmentStatus.FAILED,
              errorMessage: "No OpenFIGI data returned",
              fetchedAt: new Date(),
              payloadJson: toJsonValue(result)
            },
            create: {
              isin: result.isin,
              status: EnrichmentStatus.FAILED,
              errorMessage: "No OpenFIGI data returned",
              fetchedAt: new Date(),
              payloadJson: toJsonValue(result)
            }
          });
          failed += 1;
          continue;
        }

        const update = candidateToInstrumentUpdate(candidate, instrument);
        await prisma.instrument.update({
          where: { isin: instrument.isin },
          data: update
        });

        await prisma.instrumentEnrichment.upsert({
          where: { isin_source: { isin: instrument.isin, source: "OPENFIGI" } },
          update: {
            status: EnrichmentStatus.SUCCESS,
            errorMessage: null,
            fetchedAt: new Date(),
            payloadJson: toJsonValue(result)
          },
          create: {
            isin: instrument.isin,
            status: EnrichmentStatus.SUCCESS,
            errorMessage: null,
            fetchedAt: new Date(),
            payloadJson: toJsonValue(result)
          }
        });

        console.info("[ENRICH][OPENFIGI] success", {
          userId: options.userId,
          importBatchId: options.importBatchId,
          isin: instrument.isin,
          displayName: update.displayName || instrument.displayName || instrument.name || null,
          securityType2: update.securityType2 || instrument.securityType2 || null,
          countryOfRisk: update.countryOfRisk || instrument.countryOfRisk || null,
          issuer: update.issuer || instrument.issuer || null,
          figi: update.figi || instrument.figi || null
        });
        enriched += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[ENRICH][OPENFIGI] batch failed", {
        userId: options.userId,
        importBatchId: options.importBatchId,
        error: message
      });
      for (const isin of batch) {
        await prisma.instrumentEnrichment.upsert({
          where: { isin_source: { isin, source: "OPENFIGI" } },
          update: {
            status: EnrichmentStatus.FAILED,
            errorMessage: message,
            fetchedAt: new Date(),
            payloadJson: toJsonValue({ isin, error: message })
          },
          create: {
            isin,
            status: EnrichmentStatus.FAILED,
            errorMessage: message,
            fetchedAt: new Date(),
            payloadJson: toJsonValue({ isin, error: message })
          }
        });
      }
      failed += batch.length;
    }
  }

  const skipped = isins.length - isinsToEnrich.length;
  return {
    attempted: isinsToEnrich.length,
    enriched,
    failed,
    skipped
  };
}
