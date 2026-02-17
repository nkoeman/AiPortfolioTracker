import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { syncLast4WeeksForUser } from "@/lib/prices/sync";
import { withSyncLock } from "@/lib/prices/syncLock";

export const runtime = "nodejs";

// Triggers a protected on-demand daily price sync for the signed-in user's holdings.
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
    const lockKey = `price-sync:${user.id}`;
    const lock = await withSyncLock(
      lockKey,
      () => syncLast4WeeksForUser(user.id),
      { lockedBy: user.id }
    );

    if (!lock.acquired) {
      return NextResponse.json({ error: "A price sync is already running." }, { status: 409 });
    }

    return NextResponse.json({ ok: true, result: lock.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recent sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
