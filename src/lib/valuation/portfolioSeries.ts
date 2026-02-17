const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type DailyValueLike = {
  date: Date;
  valueEur: number;
  partialValuation?: boolean | null;
  cumulativeReturnPct?: number | null;
};

export type WeeklySeriesPoint = {
  weekStartDate: Date;
  weekEndDate: Date;
  valueEur: number;
  partialValuation: boolean;
  cumulativeReturnPct: number | null;
};

function startOfUtcDay(value: Date) {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function startOfUtcWeek(value: Date) {
  const day = value.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  return new Date(startOfUtcDay(value).getTime() - daysFromMonday * ONE_DAY_MS);
}

// Groups daily valuations into ISO weeks (Monday-start) and selects the latest date in each week.
export function getWeeklySeriesFromDaily(values: DailyValueLike[]): WeeklySeriesPoint[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a.date.getTime() - b.date.getTime());
  const byWeek = new Map<string, WeeklySeriesPoint>();

  for (const row of sorted) {
    const day = startOfUtcDay(row.date);
    const weekStart = startOfUtcWeek(day);
    const key = weekStart.toISOString().slice(0, 10);
    const existing = byWeek.get(key);

    if (!existing || day.getTime() >= existing.weekEndDate.getTime()) {
      byWeek.set(key, {
        weekStartDate: weekStart,
        weekEndDate: day,
        valueEur: row.valueEur,
        partialValuation: Boolean(row.partialValuation),
        cumulativeReturnPct: row.cumulativeReturnPct ?? null
      });
    }
  }

  return Array.from(byWeek.values()).sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime());
}
