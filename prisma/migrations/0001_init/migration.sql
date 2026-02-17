-- Initial schema for portfolio-tracker

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "fileName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Instrument" (
  "id" TEXT NOT NULL,
  "isin" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "importBatchId" TEXT,
  "tradeAt" TIMESTAMP(3) NOT NULL,
  "quantity" NUMERIC(20,8) NOT NULL,
  "price" NUMERIC(20,8),
  "valueEur" NUMERIC(20,8),
  "totalEur" NUMERIC(20,8),
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "uniqueKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Price" (
  "id" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "close" NUMERIC(20,8) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyPortfolioValue" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "totalValueEur" NUMERIC(20,8) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyPortfolioValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Instrument_isin_key" ON "Instrument"("isin");
CREATE UNIQUE INDEX "Transaction_uniqueKey_key" ON "Transaction"("uniqueKey");
CREATE UNIQUE INDEX "Price_instrumentId_date_key" ON "Price"("instrumentId", "date");
CREATE UNIQUE INDEX "DailyPortfolioValue_userId_date_key" ON "DailyPortfolioValue"("userId", "date");

CREATE INDEX "Transaction_userId_tradeAt_idx" ON "Transaction"("userId", "tradeAt");
CREATE INDEX "Transaction_instrumentId_tradeAt_idx" ON "Transaction"("instrumentId", "tradeAt");

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Price" ADD CONSTRAINT "Price_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyPortfolioValue" ADD CONSTRAINT "DailyPortfolioValue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
