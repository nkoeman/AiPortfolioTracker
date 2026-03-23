import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { kickoffIsharesExposureSnapshots } from "@/lib/ishares/ensureIsharesExposure";
import { prisma } from "@/lib/prisma";
import { syncFullForUser, syncLast4WeeksForUser } from "@/lib/prices/sync";
import { withSyncLock } from "@/lib/prices/syncLock";

export const runtime = "nodejs";

// Triggers a protected on-demand price sync for the signed-in user's holdings.
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
  const force = Boolean(body?.force);

  try {
    const lockKey = `price-sync:${user.id}`;
    const lock = await withSyncLock(lockKey, () => (force ? syncFullForUser(user.id) : syncLast4WeeksForUser(user.id)), {
      lockedBy: user.id
    });
    if (!lock.acquired) {
      return NextResponse.json({ error: "A price sync is already running." }, { status: 409 });
    }
    kickoffIsharesExposureSnapshots({ userId: user.id });
    return NextResponse.json({ ok: true, result: lock.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
