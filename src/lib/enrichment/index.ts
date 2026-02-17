import { AssetClass, AssetType, Region } from "@prisma/client";
import { buildInstrumentProfileFromRules } from "@/lib/enrichment/rules";
import { prisma } from "@/lib/prisma";

type EnsureContext = {
  userId?: string;
  importBatchId?: string;
};

type RuleProfile = {
  assetType: AssetType;
  assetClass: AssetClass;
  region: Region;
  trackedIndexName: string | null;
  fxHedged: boolean | null;
  sector: string | null;
  industry: string | null;
  issuer: string | null;
  countryOfRisk: string | null;
  confidence: number;
};

function mergeRuleProfile(existing: RuleProfile | null, patch: RuleProfile): RuleProfile {
  return {
    assetType: patch.assetType,
    assetClass: patch.assetClass,
    region: patch.region,
    trackedIndexName: patch.trackedIndexName ?? existing?.trackedIndexName ?? null,
    fxHedged: patch.fxHedged ?? existing?.fxHedged ?? null,
    sector: patch.sector ?? existing?.sector ?? null,
    industry: patch.industry ?? existing?.industry ?? null,
    issuer: patch.issuer ?? existing?.issuer ?? null,
    countryOfRisk: patch.countryOfRisk ?? existing?.countryOfRisk ?? null,
    confidence: Math.max(existing?.confidence ?? 0, patch.confidence)
  };
}

export async function ensureInstrumentProfiles(isins: string[], context: EnsureContext = {}) {
  if (!isins.length) return;

  const instruments = await prisma.instrument.findMany({
    where: { isin: { in: isins } },
    include: { profile: true }
  });

  for (const instrument of instruments) {
    const { profilePatch, debugReasons } = buildInstrumentProfileFromRules(instrument);
    const existingProfile = instrument.profile
      ? {
          assetType: instrument.profile.assetType,
          assetClass: instrument.profile.assetClass,
          region: instrument.profile.region,
          trackedIndexName: instrument.profile.trackedIndexName,
          fxHedged: instrument.profile.fxHedged,
          sector: instrument.profile.sector,
          industry: instrument.profile.industry,
          issuer: instrument.profile.issuer,
          countryOfRisk: instrument.profile.countryOfRisk,
          confidence: instrument.profile.confidence
        }
      : null;

    const mergedRuleProfile = mergeRuleProfile(existingProfile, profilePatch);

    await prisma.instrumentProfile.upsert({
      where: { isin: instrument.isin },
      update: mergedRuleProfile,
      create: {
        isin: instrument.isin,
        ...mergedRuleProfile
      }
    });

    console.info("[ENRICH][RULE] applied", {
      userId: context.userId,
      importBatchId: context.importBatchId,
      isin: instrument.isin,
      assetType: mergedRuleProfile.assetType,
      assetClass: mergedRuleProfile.assetClass,
      region: mergedRuleProfile.region,
      trackedIndexName: mergedRuleProfile.trackedIndexName,
      reasons: debugReasons
    });
  }
}
