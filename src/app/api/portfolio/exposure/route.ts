import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getPortfolioExposure } from "@/lib/exposure/portfolioExposure";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseAsOf(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid asOf date. Use YYYY-MM-DD.");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid asOf date. Use YYYY-MM-DD.");
  }
  return parsed;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const url = new URL(req.url);
    const asOfDate = parseAsOf(url.searchParams.get("asOf")) || new Date();
    const result = await getPortfolioExposure(user.id, asOfDate);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=60"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load portfolio exposure.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
