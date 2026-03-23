export type ExposureRegionName = "North America" | "Europe" | "Asia Pacific" | "Emerging Markets" | "Global" | "Other";

const COUNTRY_TO_REGION: Record<string, ExposureRegionName> = {
  US: "North America",
  CA: "North America",
  MX: "North America",
  GB: "Europe",
  NL: "Europe",
  DE: "Europe",
  FR: "Europe",
  CH: "Europe",
  ES: "Europe",
  IT: "Europe",
  SE: "Europe",
  JP: "Asia Pacific",
  AU: "Asia Pacific",
  NZ: "Asia Pacific",
  SG: "Asia Pacific",
  HK: "Asia Pacific",
  TW: "Asia Pacific",
  KR: "Asia Pacific",
  CN: "Emerging Markets",
  IN: "Emerging Markets",
  BR: "Emerging Markets",
  ZA: "Emerging Markets"
};

export function countryCodeToRegion(countryCode: string): ExposureRegionName {
  const normalized = String(countryCode || "").trim().toUpperCase();
  return COUNTRY_TO_REGION[normalized] || "Other";
}
