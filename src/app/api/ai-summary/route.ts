import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { getOrCreatePortfolioAiSummary } from "@/lib/ai/portfolioSummary";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await getOrCreatePortfolioAiSummary(user.id, undefined, 4);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI summary failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
