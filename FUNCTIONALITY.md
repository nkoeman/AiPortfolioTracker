# Portfolio Tracker - Implemented Functionality and Logic

## 1. What the app does
The app imports DeGiro transactions, maps instruments to exchange listings, syncs market prices and FX rates, computes portfolio valuation series, and shows portfolio analytics across:
- `Performance` (`/`)
- `Portfolio` (`/portfolio`)
- `Transactions` (`/import`)

It also generates a cached AI insights block for the last 4 weeks.

## 2. Runtime stack
- Next.js 14 App Router + TypeScript
- Prisma + PostgreSQL
- NextAuth credentials auth (JWT session strategy)
- EODHD for listing discovery and historical prices
- ECB SDMX API for FX series
- OpenFIGI for instrument enrichment
- OpenAI Chat Completions for AI insights (structured JSON output)
- Recharts for chart rendering
- Vitest for tests

## 3. Auth and route protection

### 3.1 Middleware
`middleware.ts` protects:
- `/`
- `/import/:path*`

Unauthenticated users are redirected to `/login` with `callbackUrl`.

### 3.2 Server-side auth guards
Pages and API routes also validate the current session server-side (`getServerSession(...)`) and reject unauthorized access.

### 3.3 App shell behavior
`AppShell` shows sidebar + header for app pages, but hides both on:
- `/login`
- `/register`

## 4. Current pages

### 4.1 `/` (Performance)
Main performance page with:
- AI insights card
- Portfolio value card (switch between `Max` and `Last 4 weeks`)
- Last 4 weeks performance summary + contributors (graph removed from this card)

### 4.2 `/portfolio` (Portfolio)
Portfolio composition page with:
- Open positions overview table
- Closed positions overview table
- Server-side sorting support for open positions via query params

### 4.3 `/import` (Transactions)
Transactions page with:
- `Data update` section (sync buttons)
- CSV import form
- Full transaction table with:
  - Date (`tradeAt`)
  - Name (`instrument.displayName` fallback to `instrument.name`)
  - Quantity
  - Price
  - Amount (`valueEur` fallback to `totalEur`)

### 4.4 Auth pages
- `/login`: sign in form with Chief Capital logo
- `/register`: create account form with Chief Capital logo

## 5. API endpoints
- `POST /api/auth/register`: register user
- `GET|POST /api/auth/[...nextauth]`: NextAuth
- `POST /api/import`: import DeGiro CSV and trigger recent sync
- `GET /api/ai-summary`: get/generate cached AI insights
- `POST /api/sync-prices/recent`: sync last ~4 weeks
- `POST /api/sync-prices/full`: full sync from first transaction date
- `POST /api/sync-prices`: legacy wrapper (`force=true` => full, else recent)
- `POST /api/sync-prices/daily`: alias of recent sync
- `POST /api/sync-prices/weekly`: alias of full sync
- `POST /api/admin/sync-exchanges`: refresh EODHD exchange directory

## 6. Prisma data model (runtime-relevant)

### 6.1 Core
- `User`
- `ImportBatch`
- `Transaction`

### 6.2 Instruments and listing mapping
- `Instrument`
- `InstrumentListing`
- `DegiroVenueMap` (beurs -> MIC)
- `EodhdExchange` (exchange directory)

### 6.3 Market data and valuation caches
- `DailyListingPrice` (canonical price cache; unique `(listingId, date)`)
- `FxRate` (weekly FX cache; unique `(weekEndDate, base, quote)`)
- `DailyPortfolioValue` (canonical valuation cache; unique `(userId, date)`)

### 6.4 AI and enrichment
- `PortfolioAiSummary`
- `InstrumentEnrichment`
- `InstrumentProfile`

### 6.5 Concurrency
- `SyncLock` (server-side sync lock)

### 6.6 Removed
- `WeeklyPortfolioValue` has been removed from schema/runtime.

## 7. CSV import flow (`POST /api/import`)
1. Validate auth and uploaded file
2. Parse CSV rows (`parseDegiroCsv`)
3. Create `ImportBatch`
4. Upsert instruments by ISIN
5. Run OpenFIGI enrichment (best effort)
6. Run rules-based profile enrichment (best effort)
7. Resolve listing per row (`resolveOrCreateListingForTransaction`)
8. Generate deterministic `uniqueKey` hash per transaction
9. Bulk insert with `skipDuplicates: true` (idempotent import)
10. Trigger async `syncLast4WeeksForUser(userId)` (best effort)

## 8. Listing mapping logic
Mapping uses MIC-first resolution:
1. DeGiro beurs code -> MIC (`DegiroVenueMap`)
2. MIC -> target EODHD exchange code
3. Fetch EODHD candidates by ISIN
4. Candidate selection strategy:
   - `EXACT`: suffix/exchange exact match
   - `COUNTRY`: fallback by exchange country
   - `CURRENCY`: fallback by currency
   - deterministic low-confidence fallback if needed
5. Upsert listing mapping result; mark failures as `FAILED` with `mappingError`

Logs include structured `[MAP]` stages and selection reason/confidence.

## 9. Price sync architecture (`src/lib/prices/sync.ts`)

Two sync modes:
- `syncLast4WeeksForUser(userId)`
- `syncFullForUser(userId)`

Pipeline order:
1. Ensure exchange directory loaded
2. Re-link unmapped transactions where possible
3. Sync daily prices (`syncDailyPricesForUser`)
4. Ensure weekly FX coverage for required range (`ensureWeeklyFxRates`)
5. Recompute daily portfolio values (`refreshDailyPortfolioValuesForUser`)

Important:
- Recent sync does **not** delete historical prices.
- Overlapping sync requests are prevented via `withSyncLock(...)`.

## 10. Daily price ingestion
`fetchDailyPricesForListings(...)`:
- Calls EODHD historical endpoint with `period="d"` (daily)
- Upserts into `DailyListingPrice` by `(listingId, date)`
- Stores `adjustedClose` and `close` when available
- Includes retry/backoff and small inter-call delay
- Emits `[DAILY][PRICES]` logs

## 11. FX ingestion
`ensureWeeklyFxRates(...)`:
- Determines required currencies from mapped listings
- Determines required Friday week-end dates from date range / known prices
- Fetches ECB daily series
- For each week-end date, uses nearest observation on/before week end
- Upserts `FxRate`
- Emits `[FX]` and `[FX][FALLBACK]` logs

## 12. Canonical valuation computation (`DailyPortfolioValue`)
`getOrCreateDailyPortfolioSeries(...)` computes and upserts per day:
- Holdings as-of each day from transaction history
- Price selection with carry-forward fallback (lookback window)
- EUR conversion using FX nearest on/before valuation day
- `partialValuation=true` when holdings are excluded due to missing price/FX

Return fields stored:
- `netExternalFlowEur`
- `periodReturnPct`
- `returnIndex`
- `cumulativeReturnPct`

Price field used in valuation:
- `close` when present
- otherwise fallback to `adjustedClose`

Return chain continuity:
- If prior `DailyPortfolioValue` exists before the requested window, index continuation uses that prior value/index instead of resetting.

## 13. Weekly series derivation (without weekly table)
`getWeeklySeriesFromDaily(...)` groups daily values by ISO week (Monday start) and selects the latest point in each week, returning:
- `weekStartDate`
- `weekEndDate`
- `valueEur`
- `partialValuation`
- `cumulativeReturnPct`

This derived weekly series is used in runtime reads (charts and recent analytics).

## 14. Performance page logic (`/`)

### 14.1 Portfolio value card
- Range toggle:
  - `Max` -> weekly series (Friday-dated points)
  - `1Y` -> weekly series (Friday-dated points)
  - `1M` -> daily series (last month)
  - `YTD` -> weekly series (Friday-dated points from Jan 1)
- Metric toggle:
  - `Value (EUR)` (green value line + dotted invested line)
  - `Return (%)` (organic return)

### 14.2 Last 4 weeks card
- Shows summary metrics and contributors
- Shows window and last-updated metadata
- Graph removed from this card

### 14.3 AI insights card
- Separate card titled `AI Portfolio insights`
- Shows one quote-style one-liner + up to 5 bullets

## 15. Portfolio page logic (`/portfolio`)
- Builds open positions from transactions + mapped listings + price/FX data
- Calculates market value, total P&L, YTD P&L and YTD%
- Builds closed positions when net quantity returns to ~0
- Uses existing table style (`.table`) and server-side sort query params

## 16. Transactions page logic (`/import`)
- Data update controls:
  - `Sync last 4 weeks`
  - `Full sync`
- CSV import form (`POST /api/import`)
- Full transaction table in same style as open positions

## 17. AI summary pipeline
`getOrCreatePortfolioAiSummary(...)`:
- Uses canonical `getRecentPerformance(userId, 4)` output
- Builds facts payload with contributor metadata
- Hash key: `sha256(promptVersion + temperature + factsPayload)`
- Caches by `(userId, weekEndDate, windowWeeks)`
- Uses structured output schema:
  - `oneLiner` (single sentence, <=180 chars)
  - `bullets` (1..5 items, each <=120 chars)
- If history is insufficient (`weeksCount < 2`), returns `EMPTY`

## 18. Environment variables used
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `EODHD_API_KEY`
- `EODHD_BASE_URL` (optional)
- `OPENFIGI_API_KEY`
- `OPENFIGI_BASE_URL` (optional)
- `OPENFIGI_ENRICH_TTL_DAYS` (optional)
- `ECB_BASE_URL` (optional)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4o-mini`)
- `OPENAI_TEMPERATURE` (optional, default `0.2`)

## 19. Notable constraints / caveats
- `middleware.ts` matcher currently protects `/` and `/import/*`; `/portfolio` is protected by server-side checks in the page itself.
- Position valuation on `/portfolio` currently reads `DailyListingPrice.adjustedClose` for instrument-level metrics.
