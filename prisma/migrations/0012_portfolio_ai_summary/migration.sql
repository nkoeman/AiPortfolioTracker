CREATE TYPE "PortfolioAiSummaryStatus" AS ENUM ('READY', 'FAILED');

CREATE TABLE "PortfolioAiSummary" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekEndDate" DATE NOT NULL,
  "windowWeeks" INTEGER NOT NULL DEFAULT 4,
  "inputHash" TEXT NOT NULL,
  "summaryJson" JSONB NOT NULL,
  "summaryMarkdown" TEXT,
  "model" TEXT NOT NULL,
  "temperature" DOUBLE PRECISION NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "status" "PortfolioAiSummaryStatus" NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioAiSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioAiSummary_userId_weekEndDate_windowWeeks_key"
ON "PortfolioAiSummary"("userId", "weekEndDate", "windowWeeks");

CREATE INDEX "PortfolioAiSummary_userId_weekEndDate_idx"
ON "PortfolioAiSummary"("userId", "weekEndDate");

ALTER TABLE "PortfolioAiSummary"
ADD CONSTRAINT "PortfolioAiSummary_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
