import { prisma } from "@/lib/prisma";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

type LockOptions = {
  ttlMs?: number;
  lockedBy?: string | null;
};

export type LockResult<T> =
  | { acquired: true; result: T }
  | { acquired: false; result: null };

async function tryAcquireLock(key: string, options: LockOptions = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const lockedBy = options.lockedBy ?? null;

  try {
    await prisma.syncLock.create({
      data: {
        key,
        lockedAt: now,
        expiresAt,
        lockedBy
      }
    });
    return true;
  } catch {
    const updated = await prisma.syncLock.updateMany({
      where: {
        key,
        expiresAt: { lt: now }
      },
      data: {
        lockedAt: now,
        expiresAt,
        lockedBy
      }
    });
    return updated.count > 0;
  }
}

async function releaseLock(key: string, lockedBy?: string | null) {
  try {
    await prisma.syncLock.deleteMany({
      where: lockedBy ? { key, lockedBy } : { key }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[SYNC][LOCK] release failed", { key, message });
  }
}

export async function withSyncLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<LockResult<T>> {
  const acquired = await tryAcquireLock(key, options);
  if (!acquired) return { acquired: false, result: null };

  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    await releaseLock(key, options.lockedBy ?? null);
  }
}
