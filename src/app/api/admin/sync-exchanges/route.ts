import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { upsertEodhdExchanges } from "@/lib/eodhd/exchanges";

export const runtime = "nodejs";

// Runs a protected exchange-directory sync so MIC-based listing selection has fresh EODHD metadata.
export async function POST() {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await upsertEodhdExchanges();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exchange sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
