export type BenchmarkProvider = "eodhd";

export type BenchmarkConfig = {
  id: "sp500" | "ftse_all_world";
  label: string;
  provider: BenchmarkProvider;
  symbol: string;
  isin: string;
  currency: string;
  enabled: boolean;
};

function readBoolean(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function readString(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function createBenchmarkConfig(prefix: string, id: BenchmarkConfig["id"], defaults: Omit<BenchmarkConfig, "id">) {
  return {
    id,
    enabled: readBoolean(process.env[`${prefix}_ENABLED`], defaults.enabled),
    label: readString(process.env[`${prefix}_LABEL`], defaults.label),
    provider: readString(process.env[`${prefix}_PROVIDER`], defaults.provider) as BenchmarkProvider,
    symbol: readString(process.env[`${prefix}_SYMBOL`], defaults.symbol),
    isin: readString(process.env[`${prefix}_ISIN`], defaults.isin),
    currency: readString(process.env[`${prefix}_CURRENCY`], defaults.currency).toUpperCase()
  } satisfies BenchmarkConfig;
}

export function getEnabledBenchmarks(): BenchmarkConfig[] {
  return [
    createBenchmarkConfig("BENCHMARK_SP500", "sp500", {
      enabled: false,
      label: "S&P 500",
      provider: "eodhd",
      symbol: "VUAA.XETRA",
      isin: "IE00BFMXXD54",
      currency: "EUR"
    }),
    createBenchmarkConfig("BENCHMARK_FTSE_ALL_WORLD", "ftse_all_world", {
      enabled: false,
      label: "FTSE All-World",
      provider: "eodhd",
      symbol: "VWCE.XETRA",
      isin: "IE00BK5BQT80",
      currency: "EUR"
    })
  ].filter((benchmark) => benchmark.enabled && benchmark.provider === "eodhd" && benchmark.symbol && benchmark.isin);
}
