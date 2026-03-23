import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { ensureIsharesExposureSnapshots } from "@/lib/ishares/ensureIsharesExposure";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
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
