import { Prisma } from "@prisma/client";
import type { ExposureSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  NORMALIZER_VERSION,
  normalizeCountryLabelToIso2,
  normalizeSectorLabelToGics11
} from "@/lib/exposure/normalize/mapping";
import type {
  CountryKey,
  NormalizedExposureMeta,
  NormalizedExposurePayload,
  NormalizedExposureRow,
  SectorKey
} from "@/lib/exposure/normalize/types";

type RawExposureRow = {
  label: string;
  weight: number;
};

type NormalizeExposurePayloadResult = {
  normalizedPayload: NormalizedExposurePayload;
  coverageMeta: NormalizedExposureMeta;
};

type ParsedRawPayload = {
  value: Record<string, unknown>;
  parseError?: string;
};

type BackfillOptions = {
  source?: ExposureSource;
  issuer?: string;
  userId?: string;
  instrumentIds?: string[];
  batchSize?: number;
  delayMs?: number;
};

type BackfillSummary = {
  scanned: number;
  normalized: number;
  skipped: number;
};

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundWeight(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(8));
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) return Number(value);
  return Number.NaN;
}

function normalizeWeight(value: unknown) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  if (numeric > 1 && numeric <= 100) return roundWeight(numeric / 100);
  return roundWeight(numeric);
}

function parseRawPayload(rawPayload: unknown): ParsedRawPayload {
  if (typeof rawPayload === "string") {
    try {
      return {
        value: JSON.parse(rawPayload) as Record<string, unknown>,
        parseError: undefined
      };
    } catch (error) {
      return {
        value: {},
        parseError: error instanceof Error ? error.message : String(error)
      };
    }
  }

  if (rawPayload && typeof rawPayload === "object") {
    return {
      value: rawPayload as Record<string, unknown>,
      parseError: undefined
    };
  }

  return {
    value: {},
    parseError: rawPayload === null || rawPayload === undefined ? undefined : "Unsupported exposure payload type"
  };
}

function extractRows(rawValue: unknown, aliases: string[]): RawExposureRow[] {
  if (!Array.isArray(rawValue)) return [];

  const rows: RawExposureRow[] = [];
  for (const entry of rawValue) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const label =
      aliases
        .map((key) => row[key])
        .find((value): value is string => typeof value === "string" && value.trim().length > 0) ||
      (typeof row.name === "string" && row.name.trim().length > 0 ? row.name : "") ||
      (typeof row.label === "string" && row.label.trim().length > 0 ? row.label : "") ||
      (typeof row.key === "string" && row.key.trim().length > 0 ? row.key : "");
    const weight =
      normalizeWeight(row.weight) ??
      normalizeWeight(row.value) ??
      normalizeWeight(row.pct) ??
      normalizeWeight(row.percentage);

    if (!label || weight === null) continue;
    rows.push({ label, weight });
  }

  return rows;
}

function mergeRows<K extends string>(rows: NormalizedExposureRow<K>[]) {
  const totals = new Map<K, number>();
  for (const row of rows) {
    totals.set(row.key, roundWeight((totals.get(row.key) || 0) + row.weight));
  }
  return Array.from(totals.entries())
    .map(([key, weight]) => ({ key, weight }))
    .filter((row) => row.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

function sumRows<K extends string>(rows: NormalizedExposureRow<K>[]) {
  return roundWeight(rows.reduce((total, row) => total + row.weight, 0));
}

export function normalizeExposurePayload(rawPayload: unknown): NormalizeExposurePayloadResult {
  const parsed = parseRawPayload(rawPayload);
  const countryRows = extractRows(parsed.value.country, ["country"]);
  const sectorRows = extractRows(parsed.value.sector, ["sector"]);

  const normalizedCountry: NormalizedExposureRow<CountryKey>[] = [];
  const normalizedSector: NormalizedExposureRow<SectorKey>[] = [];
  const unmappedCountryLabels: string[] = [];
  const unmappedSectorLabels: string[] = [];

  for (const row of countryRows) {
    const normalized = normalizeCountryLabelToIso2(row.label);
    normalizedCountry.push({ key: normalized.key, weight: row.weight });
    if (normalized.confidence === 0) unmappedCountryLabels.push(row.label);
  }

  for (const row of sectorRows) {
    const normalized = normalizeSectorLabelToGics11(row.label);
    normalizedSector.push({ key: normalized.key, weight: row.weight });
    if (normalized.confidence === 0) unmappedSectorLabels.push(row.label);
  }

  const country = mergeRows(normalizedCountry);
  const sector = mergeRows(normalizedSector);
  const meta: NormalizedExposureMeta = {
    countrySum: sumRows(country),
    sectorSum: sumRows(sector),
    unmappedCountryLabels: Array.from(new Set(unmappedCountryLabels)).sort(),
    unmappedSectorLabels: Array.from(new Set(unmappedSectorLabels)).sort(),
    normalizerVersion: NORMALIZER_VERSION,
    rawCountryLabels: Array.from(new Set(countryRows.map((row) => row.label))).sort(),
    rawSectorLabels: Array.from(new Set(sectorRows.map((row) => row.label))).sort(),
    ...(parsed.parseError ? { parseError: parsed.parseError } : {})
  };

  return {
    normalizedPayload: {
      country,
      sector,
      meta
    },
    coverageMeta: meta
  };
}

export async function normalizeExposureSnapshot(snapshotId: string) {
  const snapshot = await prisma.instrumentExposureSnapshot.findUnique({
    where: { id: snapshotId },
    select: {
      id: true,
      instrumentId: true,
      payload: true,
      normalizedPayload: true,
      normalizerVersion: true
    }
  });

  if (!snapshot) {
    throw new Error(`Exposure snapshot ${snapshotId} was not found.`);
  }

  if (snapshot.normalizedPayload && snapshot.normalizerVersion === NORMALIZER_VERSION) {
    return { snapshotId, instrumentId: snapshot.instrumentId, skipped: true as const };
  }

  const normalized = normalizeExposurePayload(snapshot.payload);

  await prisma.instrumentExposureSnapshot.update({
    where: { id: snapshot.id },
    data: {
      normalizedPayload: normalized.normalizedPayload,
      normalizerVersion: NORMALIZER_VERSION,
      coverageMeta: normalized.coverageMeta
    }
  });

  console.info("[EXPOSURE][NORMALIZE]", {
    snapshotId: snapshot.id,
    instrumentId: snapshot.instrumentId,
    countrySum: normalized.normalizedPayload.meta.countrySum,
    sectorSum: normalized.normalizedPayload.meta.sectorSum,
    unmappedCountryLabels: normalized.normalizedPayload.meta.unmappedCountryLabels,
    unmappedSectorLabels: normalized.normalizedPayload.meta.unmappedSectorLabels
  });

  return { snapshotId: snapshot.id, instrumentId: snapshot.instrumentId, skipped: false as const };
}

export async function backfillNormalizeExposureSnapshots(
  options: BackfillOptions = {}
): Promise<BackfillSummary> {
  const batchSize = Math.max(1, Math.min(250, options.batchSize ?? 50));
  const delayMs = Math.max(0, options.delayMs ?? 50);
  const filteredInstrumentIds =
    options.instrumentIds?.filter((value) => typeof value === "string" && value.trim().length > 0) || [];

  const summary: BackfillSummary = {
    scanned: 0,
    normalized: 0,
    skipped: 0
  };

  while (true) {
    const instrumentFilters: Record<string, unknown> = {};
    if (options.issuer) {
      instrumentFilters.issuer = { contains: options.issuer, mode: "insensitive" };
    }
    if (options.userId) {
      instrumentFilters.transactions = { some: { userId: options.userId } };
    }

    const snapshots = await prisma.instrumentExposureSnapshot.findMany({
      where: {
        ...(options.source ? { source: options.source } : {}),
        ...(filteredInstrumentIds.length ? { instrumentId: { in: filteredInstrumentIds } } : {}),
        ...(Object.keys(instrumentFilters).length ? { instrument: instrumentFilters } : {}),
        OR: [
          { normalizedPayload: { equals: Prisma.DbNull } },
          { normalizerVersion: { not: NORMALIZER_VERSION } }
        ]
      },
      select: { id: true },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: batchSize
    });

    if (!snapshots.length) break;
    summary.scanned += snapshots.length;

    for (const snapshot of snapshots) {
      const result = await normalizeExposureSnapshot(snapshot.id);
      if (result.skipped) {
        summary.skipped += 1;
      } else {
        summary.normalized += 1;
      }
      await sleep(delayMs);
    }
  }

  return summary;
}
