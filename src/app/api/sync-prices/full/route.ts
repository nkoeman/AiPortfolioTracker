import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { kickoffIsharesExposureSnapshots } from "@/lib/ishares/ensureIsharesExposure";
import { prisma } from "@/lib/prisma";
import { syncFullForUser } from "@/lib/prices/sync";
import { withSyncLock } from "@/lib/prices/syncLock";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  try {
    const lockKey = `price-sync:${user.id}`;
    const lock = await withSyncLock(lockKey, () => syncFullForUser(user.id), {
      lockedBy: user.id
    });
    if (!lock.acquired) {
      return NextResponse.json({ error: "A price sync is already running." }, { status: 409 });
    }
    kickoffIsharesExposureSnapshots({ userId: user.id });
    return NextResponse.json({ ok: true, result: lock.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Full sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
