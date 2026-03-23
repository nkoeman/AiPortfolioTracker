import { comgestAdapter } from "@/lib/etf/issuers/comgestAdapter";
import { iSharesAdapter } from "@/lib/etf/issuers/iSharesAdapter";
import { spdrAdapter } from "@/lib/etf/issuers/spdrAdapter";
import type { IssuerExposureAdapter } from "@/lib/etf/issuers/types";
import { vaneckAdapter } from "@/lib/etf/issuers/vaneckAdapter";
import { vanguardAdapter } from "@/lib/etf/issuers/vanguardAdapter";

export const ISSUER_ADAPTERS: IssuerExposureAdapter[] = [iSharesAdapter, vanguardAdapter, spdrAdapter, comgestAdapter, vaneckAdapter];

export function resolveAdapterForInstrument(
  hints: Parameters<IssuerExposureAdapter["canHandleInstrument"]>[0]
) {
  return ISSUER_ADAPTERS.find((adapter) => adapter.canHandleInstrument(hints)) || null;
}
