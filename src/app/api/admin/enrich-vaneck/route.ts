import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/appUser";
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

  try {
    const result = await ensureIsharesExposureSnapshots({
      userId: user.id,
      instrumentIds,
      issuers: ["VANECK"]
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "VanEck enrichment failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
