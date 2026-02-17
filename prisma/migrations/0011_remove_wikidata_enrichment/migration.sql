-- Drop Wikidata enrichment audit table and enums, keep rule-based profiling only.
DROP TABLE IF EXISTS "InstrumentEnrichmentAttempt";

ALTER TABLE "InstrumentProfile" DROP COLUMN IF EXISTS "source";

DROP TYPE IF EXISTS "EnrichmentAttemptStatus";
DROP TYPE IF EXISTS "EnrichmentAttemptSource";
DROP TYPE IF EXISTS "ProfileSource";
