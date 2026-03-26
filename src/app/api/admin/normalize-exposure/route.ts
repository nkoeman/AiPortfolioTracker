import { NextResponse } from "next/server";
import type { ExposureSource } from "@prisma/client";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { backfillNormalizeExposureSnapshots } from "@/lib/exposure/normalize";

export const runtime = "nodejs";

function parseSource(value: unknown): ExposureSource | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  const allowed: ExposureSource[] = ["ISHARES", "VANGUARD", "SPDR", "COMGEST", "VANECK"];
  return allowed.includes(normalized as ExposureSource) ? (normalized as ExposureSource) : undefined;
}

export async function POST(req: Request) {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const result = await backfillNormalizeExposureSnapshots({
      source: parseSource(body?.source),
      issuer: typeof body?.issuer === "string" && body.issuer.trim().length > 0 ? body.issuer.trim() : undefined,
      batchSize: typeof body?.batchSize === "number" ? body.batchSize : undefined,
      delayMs: typeof body?.delayMs === "number" ? body.delayMs : undefined
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exposure normalization backfill failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
