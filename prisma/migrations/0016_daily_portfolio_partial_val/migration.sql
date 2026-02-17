ALTER TABLE "DailyPortfolioValue"
ADD COLUMN "partialValuation" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "DailyPortfolioValue_userId_date_idx"
ON "DailyPortfolioValue" ("userId", "date");
