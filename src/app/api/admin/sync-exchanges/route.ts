import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { upsertEodhdExchanges } from "@/lib/eodhd/exchanges";

export const runtime = "nodejs";

// Runs a protected exchange-directory sync so MIC-based listing selection has fresh EODHD metadata.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
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