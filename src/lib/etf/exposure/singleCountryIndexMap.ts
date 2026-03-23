export type SingleCountryIndexMapEntry = {
  keyword: string;
  countryCode: string;
  countryName: string;
};

export const SINGLE_COUNTRY_INDEX_MAP: SingleCountryIndexMapEntry[] = [
  { keyword: "S&P 500", countryCode: "US", countryName: "United States" },
  { keyword: "MSCI USA", countryCode: "US", countryName: "United States" },
  { keyword: "AEX", countryCode: "NL", countryName: "Netherlands" },
  { keyword: "MSCI NETHERLANDS", countryCode: "NL", countryName: "Netherlands" },
  { keyword: "DAX", countryCode: "DE", countryName: "Germany" },
  { keyword: "CAC 40", countryCode: "FR", countryName: "France" },
  { keyword: "FTSE 100", countryCode: "GB", countryName: "United Kingdom" },
  { keyword: "SMI", countryCode: "CH", countryName: "Switzerland" },
  { keyword: "NIKKEI 225", countryCode: "JP", countryName: "Japan" },
  { keyword: "TOPIX", countryCode: "JP", countryName: "Japan" },
  { keyword: "IBEX 35", countryCode: "ES", countryName: "Spain" },
  { keyword: "FTSE MIB", countryCode: "IT", countryName: "Italy" },
  { keyword: "OMX STOCKHOLM 30", countryCode: "SE", countryName: "Sweden" }
];
