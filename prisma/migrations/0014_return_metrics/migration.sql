-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('TRADE', 'DEPOSIT', 'WITHDRAWAL', 'CASH_TRANSFER');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "type" "TransactionType" NOT NULL DEFAULT 'TRADE';

-- AlterTable
ALTER TABLE "DailyPortfolioValue"
ADD COLUMN     "netExternalFlowEur" DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN     "periodReturnPct" DECIMAL(20,10),
ADD COLUMN     "returnIndex" DECIMAL(20,10),
ADD COLUMN     "cumulativeReturnPct" DECIMAL(20,10);

-- AlterTable
ALTER TABLE "WeeklyPortfolioValue"
ADD COLUMN     "netExternalFlowEur" DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN     "periodReturnPct" DECIMAL(20,10),
ADD COLUMN     "returnIndex" DECIMAL(20,10),
ADD COLUMN     "cumulativeReturnPct" DECIMAL(20,10);
