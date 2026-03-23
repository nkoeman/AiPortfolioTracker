import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { ExposureSource } from "@prisma/client";
import { authOptions } from "@/lib/auth/options";
import { backfillNormalizeExposureSnapshots } from "@/lib/exposure/normalize";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseSource(value: unknown): ExposureSource | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  const allowed: ExposureSource[] = ["ISHARES", "VANGUARD", "SPDR", "COMGEST", "VANECK"];
  return allowed.includes(normalized as ExposureSource) ? (normalized as ExposureSource) : undefined;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
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
