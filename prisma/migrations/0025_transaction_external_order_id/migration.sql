ALTER TABLE "Transaction"
ADD COLUMN "externalOrderId" TEXT;

CREATE UNIQUE INDEX "Transaction_userId_externalOrderId_key"
ON "Transaction"("userId", "externalOrderId");
