import type { RawExposureRow } from "@/lib/etf/exposure/finalizeExposure";

export function stripHtml(value: string) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

export function parseAsOfDate(text: string): Date | null {
  const match = /\b(?:as of|as at|data as at|updated)\s*:?\s*([0-9]{1,2}[\/\-][A-Za-z]{3}[\/\-][0-9]{4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i.exec(
    text
  );
  if (!match?.[1]) return null;
  const value = match[1].trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  const normalized = value.replace(/,/g, "").replace(/-/g, "/");
  const parts = normalized.split("/");
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    const monthMap: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11
    };
    const month = monthMap[p2.slice(0, 3).toLowerCase()];
    if (month !== undefined) {
      const d = new Date(Date.UTC(Number(p3), month, Number(p1)));
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function parseRowsFromHtmlTable(tableHtml: string): RawExposureRow[] {
  const rows: RawExposureRow[] = [];
  const regex = /<tr[^>]*>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<\/tr>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(tableHtml)) !== null) {
    const name = stripHtml(match[1]);
    const weightText = stripHtml(match[2]).replace("%", "");
    const numeric = Number(weightText.replace(",", "."));
    if (!name.trim() || !Number.isFinite(numeric)) continue;
    rows.push({ name, weight: numeric });
  }
  return rows;
}

export function extractRowsForHeadings(html: string, headingKeywords: string[]): RawExposureRow[] {
  const rows: RawExposureRow[] = [];
  const headingPattern = headingKeywords.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(
    `<h[1-6][^>]*>[^<]*(?:${headingPattern})[^<]*</h[1-6]>[\\s\\S]{0,2500}?<table[^>]*>([\\s\\S]*?)</table>`,
    "gi"
  );
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html)) !== null) {
    rows.push(...parseRowsFromHtmlTable(match[1]));
  }
  return rows;
}

export function extractJsonArrayFromScript<T>(html: string, keys: string[]): T[] {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`"${escaped}"\\s*:\\s*(\\[[\\s\\S]*?\\])`, "i");
    const match = regex.exec(html);
    if (!match?.[1]) continue;
    try {
      const parsed = JSON.parse(match[1]) as T[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      continue;
    }
  }
  return [];
}

export function findFirstPdfUrl(html: string): string | null {
  const match = /href="([^"]+\.pdf[^"]*)"/i.exec(html);
  return match?.[1] || null;
}

export function toAbsoluteUrl(baseUrl: string, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, `${baseUrl}/`).toString();
}
