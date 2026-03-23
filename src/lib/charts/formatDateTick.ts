export type TickLabelMode = "day" | "week" | "semi-month" | "month" | "quarter" | "year";

function asUtcDate(value: number) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDayMonth(value: number, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone
  }).format(asUtcDate(value));
}

function formatDayMonthYearShort(value: number, locale: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone
  }).formatToParts(asUtcDate(value));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${day} ${month} '${year}`;
}

function formatYearShort(value: number, locale: string, timeZone: string) {
  const year = new Intl.DateTimeFormat(locale, {
    year: "2-digit",
    timeZone
  }).format(asUtcDate(value));
  return `'${year}`;
}

export function formatDateTick(params: {
  value: number;
  mode: TickLabelMode;
  locale?: string;
  timeZone?: string;
  rangeCrossesYear?: boolean;
  compactYear?: boolean;
}) {
  const {
    value,
    mode,
    locale = "en-GB",
    timeZone = "UTC",
    rangeCrossesYear = false,
    compactYear = false
  } = params;

  if (!Number.isFinite(value)) return "";
  if (mode === "day") return formatDayMonth(value, locale, timeZone);
  if (mode === "week") {
    return rangeCrossesYear
      ? formatDayMonthYearShort(value, locale, timeZone)
      : formatDayMonth(value, locale, timeZone);
  }
  if (mode === "year" && compactYear) {
    return formatYearShort(value, locale, timeZone);
  }
  return formatDayMonthYearShort(value, locale, timeZone);
}
