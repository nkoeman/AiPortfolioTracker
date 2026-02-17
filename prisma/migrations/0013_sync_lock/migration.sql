CREATE TABLE "SyncLock" (
  "key" TEXT NOT NULL,
  "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lockedBy" TEXT,

  CONSTRAINT "SyncLock_pkey" PRIMARY KEY ("key")
);
