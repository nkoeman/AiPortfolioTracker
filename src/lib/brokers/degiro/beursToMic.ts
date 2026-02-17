import { prisma } from "@/lib/prisma";
import { logMap } from "@/lib/logging/mapping";

// Resolves the broker venue code from the DeGiro CSV to an ISO 10383 MIC via curated DB mapping.
export async function resolveMicFromBeurs(beursCode: string | null | undefined): Promise<string | null> {
  const normalizedCode = String(beursCode || "").trim().toUpperCase();

  logMap("DEGIRO", "resolving beurs -> MIC", { beursCode: normalizedCode || null });

  if (!normalizedCode) {
    logMap("DEGIRO", "missing beurs code", { beursCode: null }, "warn");
    return null;
  }

  const mapping = await prisma.degiroVenueMap.findUnique({
    where: { brokerVenueCode: normalizedCode }
  });

  if (!mapping) {
    logMap("DEGIRO", "beurs code not found in curated map", { beursCode: normalizedCode }, "warn");
    return null;
  }

  return mapping.mic.toUpperCase();
}