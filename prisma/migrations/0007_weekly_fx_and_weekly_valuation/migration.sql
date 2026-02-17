CREATE TABLE "FxRate" (
  "id" TEXT NOT NULL,
  "weekEndDate" DATE NOT NULL,
  "base" TEXT NOT NULL DEFAULT 'EUR',
  "quote" TEXT NOT NULL,
  "rate" NUMERIC(20,10) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'ECB',
  "observedDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FxRate_weekEndDate_base_quote_key" ON "FxRate"("weekEndDate", "base", "quote");
CREATE INDEX "FxRate_quote_weekEndDate_idx" ON "FxRate"("quote", "weekEndDate");

CREATE TABLE "WeeklyPortfolioValue" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekEndDate" DATE NOT NULL,
  "valueEur" NUMERIC(20,8) NOT NULL,
  "partialValuation" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyPortfolioValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyPortfolioValue_userId_weekEndDate_key" ON "WeeklyPortfolioValue"("userId", "weekEndDate");
CREATE INDEX "WeeklyPortfolioValue_userId_weekEndDate_idx" ON "WeeklyPortfolioValue"("userId", "weekEndDate");

ALTER TABLE "WeeklyPortfolioValue"
ADD CONSTRAINT "WeeklyPortfolioValue_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
