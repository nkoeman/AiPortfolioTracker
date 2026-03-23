import { describe, expect, it } from "vitest";
import { computeTimeTicks } from "@/lib/charts/timeTicks";

function toIsoDay(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

describe("computeTimeTicks", () => {
  it("uses weekly Monday ticks for 1M on desktop", () => {
    const ticks = computeTimeTicks({
      startDate: new Date("2026-01-01T12:00:00.000Z"),
      endDate: new Date("2026-01-31T18:00:00.000Z"),
      window: "1M",
      chartWidthPx: 900
    });

    expect(ticks.map((tick) => toIsoDay(tick.value))).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
      "2026-01-26"
    ]);
    expect(ticks[0]?.label).toBe("5 Jan");
  });

  it("uses semi-monthly ticks for 1M on narrow mobile", () => {
    const ticks = computeTimeTicks({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-31T00:00:00.000Z"),
      window: "1M",
      chartWidthPx: 320
    });

    expect(ticks.map((tick) => toIsoDay(tick.value))).toEqual([
      "2026-01-01",
      "2026-01-15"
    ]);
    expect(ticks.map((tick) => tick.label)).toEqual(["1 Jan '26", "15 Jan '26"]);
  });

  it("uses monthly ticks for YTD desktop", () => {
    const ticks = computeTimeTicks({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-10-20T00:00:00.000Z"),
      window: "YTD",
      chartWidthPx: 1100
    });

    expect(ticks).toHaveLength(10);
    expect(ticks.every((tick) => new Date(tick.value).getUTCDate() === 1)).toBe(true);
    expect(ticks[0]?.label).toBe("1 Jan '26");
    expect(ticks[9]?.label).toBe("1 Oct '26");
  });

  it("uses every-2-month ticks for YTD mobile", () => {
    const ticks = computeTimeTicks({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-10-20T00:00:00.000Z"),
      window: "YTD",
      chartWidthPx: 360
    });

    expect(ticks.map((tick) => toIsoDay(tick.value))).toEqual([
      "2026-01-01",
      "2026-03-01",
      "2026-05-01",
      "2026-07-01",
      "2026-09-01"
    ]);
  });

  it("uses every-2-month ticks for 1Y mobile", () => {
    const ticks = computeTimeTicks({
      startDate: new Date("2025-11-15T00:00:00.000Z"),
      endDate: new Date("2026-11-14T00:00:00.000Z"),
      window: "1Y",
      chartWidthPx: 390
    });

    expect(ticks.map((tick) => toIsoDay(tick.value))).toEqual([
      "2026-01-01",
      "2026-03-01",
      "2026-05-01",
      "2026-07-01",
      "2026-09-01",
      "2026-11-01"
    ]);
  });

  it("uses yearly ticks for MAX over 5 years", () => {
    const ticks = computeTimeTicks({
      startDate: new Date("2021-03-10T00:00:00.000Z"),
      endDate: new Date("2026-02-10T00:00:00.000Z"),
      window: "MAX",
      chartWidthPx: 1000
    });

    expect(ticks.map((tick) => toIsoDay(tick.value))).toEqual([
      "2022-01-01",
      "2023-01-01",
      "2024-01-01",
      "2025-01-01",
      "2026-01-01"
    ]);
    expect(ticks[0]?.label).toBe("1 Jan '22");
  });

  it("keeps ticks unique and within range", () => {
    const startDate = new Date("2026-01-03T18:00:00.000Z");
    const endDate = new Date("2026-01-20T06:00:00.000Z");
    const ticks = computeTimeTicks({
      startDate,
      endDate,
      window: "1M",
      chartWidthPx: 360
    });

    const startMs = Date.UTC(2026, 0, 3);
    const endMs = Date.UTC(2026, 0, 20);
    const values = ticks.map((tick) => tick.value);

    expect(values.every((value) => value >= startMs && value <= endMs)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });

  it("limits short ranges to daily ticks with max 5 labels", () => {
    const ticks = computeTimeTicks({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-07T00:00:00.000Z"),
      window: "1M",
      chartWidthPx: 1200
    });

    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });
});
