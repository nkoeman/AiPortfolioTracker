import { Instrument } from "@prisma/client";
import { OpenFigiCandidate } from "@/lib/openfigi/client";

// OpenFIGI returns listing-level identifiers (ticker/exchange/MIC). We intentionally
// ignore those because Instrument is ISIN-level identity only. Listing identifiers
// belong to InstrumentListing, which is derived from DeGiro -> MIC -> EODHD mapping.
export function normalizeInstrumentEnrichment(candidate: OpenFigiCandidate, current: Instrument) {
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const displayName =
    name && (!current.displayName || name.length >= current.displayName.length) ? name : undefined;

  return {
    displayName,
    figi: candidate.figi || undefined,
    figiComposite: candidate.compositeFIGI || undefined,
    securityType: candidate.securityType || undefined,
    securityType2: candidate.securityType2 || undefined,
    marketSector: candidate.marketSector || undefined,
    assetClass: candidate.assetClass || undefined,
    issuer: candidate.issuer || undefined,
    countryOfRisk: candidate.country || undefined
  };
}
