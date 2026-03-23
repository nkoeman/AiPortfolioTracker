export type DietzTimingAssumption = "END_OF_DAY" | "MID_DAY" | "START_OF_DAY";

export type CashFlow = {
  amountEur: number;
  occurredAt?: Date;
};

export type ModifiedDietzParams = {
  startValueEur: number;
  endValueEur: number;
  cashFlows: CashFlow[];
  periodStart: Date;
  periodEnd: Date;
  timingAssumption: DietzTimingAssumption;
};

const EPSILON = 1e-12;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function defaultWeight(timingAssumption: DietzTimingAssumption) {
  if (timingAssumption === "START_OF_DAY") return 1;
  if (timingAssumption === "MID_DAY") return 0.5;
  return 0;
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveFlowWeight(params: {
  occurredAt?: Date;
  periodStart: Date;
  periodEnd: Date;
  timingAssumption: DietzTimingAssumption;
}) {
  const fallback = defaultWeight(params.timingAssumption);
  if (!params.occurredAt) return fallback;

  const periodStartMs = params.periodStart.getTime();
  const periodEndMs = params.periodEnd.getTime();
  const durationMs = periodEndMs - periodStartMs;
  if (durationMs <= 0) return fallback;

  const occurredAtMs = clamp(params.occurredAt.getTime(), periodStartMs, periodEndMs);
  const weight = (periodEndMs - occurredAtMs) / durationMs;
  return clamp(weight, 0, 1);
}

// Modified Dietz period return:
// r = (B - A - ΣF_i) / (A + Σ(w_i * F_i))
export function modifiedDietzReturn(params: ModifiedDietzParams): number | null {
  const startValueEur = toFiniteNumber(params.startValueEur);
  const endValueEur = toFiniteNumber(params.endValueEur);
  if (startValueEur === null || endValueEur === null) return null;

  let totalFlowEur = 0;
  let weightedFlowEur = 0;

  for (const flow of params.cashFlows) {
    const amount = toFiniteNumber(flow.amountEur);
    if (amount === null || amount === 0) continue;
    const weight = resolveFlowWeight({
      occurredAt: flow.occurredAt,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      timingAssumption: params.timingAssumption
    });
    totalFlowEur += amount;
    weightedFlowEur += amount * weight;
  }

  const denominator = startValueEur + weightedFlowEur;
  if (Math.abs(denominator) < EPSILON) return null;

  return (endValueEur - startValueEur - totalFlowEur) / denominator;
}

