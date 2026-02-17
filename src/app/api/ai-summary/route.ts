import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { getOrCreatePortfolioAiSummary } from "@/lib/ai/portfolioSummary";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const summary = await getOrCreatePortfolioAiSummary(user.id, undefined, 4);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI summary failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
