import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { backfillNormalizeExposureSnapshots } from "@/lib/exposure/normalize";
import { ensureIsharesExposureSnapshots } from "@/lib/ishares/ensureIsharesExposure";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const instrumentIds = Array.isArray(body?.instrumentIds)
    ? body.instrumentIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
    : undefined;
  const force = body?.force === undefined ? false : Boolean(body?.force);

  try {
    const result = await ensureIsharesExposureSnapshots({
      userId: user.id,
      instrumentIds,
      force
    });
    const normalization = await backfillNormalizeExposureSnapshots({
      userId: user.id,
      instrumentIds,
      batchSize: 250,
      delayMs: 0
    });
    return NextResponse.json({ ok: true, result, normalization });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exposure enrichment failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
