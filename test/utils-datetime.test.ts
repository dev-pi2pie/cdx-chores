import { describe, expect, test } from "bun:test";

import {
  formatLocalFileDateTime12Hour,
  formatLocalFileDateTimeISO,
  formatUtcFileDateTime12Hour,
  formatUtcFileDateTimeISO,
} from "../src/utils/datetime";

function formatExpectedLocalOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const minutes = String(absoluteMinutes % 60).padStart(2, "0");
  return `${sign}${hours}${minutes}`;
}

describe("datetime formatting helpers", () => {
  test("formatUtcFileDateTimeISO produces compact UTC ISO with Z", () => {
    expect(formatUtcFileDateTimeISO(new Date("2026-03-01T09:15:30.000Z"))).toBe("20260301T091530Z");
  });

  test("formatLocalFileDateTimeISO appends a numeric local offset", () => {
    const date = new Date("2026-03-01T09:15:30.000Z");
    const value = formatLocalFileDateTimeISO(date);
    expect(value).toMatch(/^\d{8}T\d{6}[+-]\d{4}$/);
    expect(value.endsWith(formatExpectedLocalOffset(date))).toBe(true);
  });

  test("formatUtcFileDateTime12Hour handles morning, noon, and midnight boundaries", () => {
    expect(formatUtcFileDateTime12Hour(new Date("2026-03-01T09:15:30.000Z"))).toBe(
      "20260301-091530AM",
    );
    expect(formatUtcFileDateTime12Hour(new Date("2026-03-01T12:00:00.000Z"))).toBe(
      "20260301-120000PM",
    );
    expect(formatUtcFileDateTime12Hour(new Date("2026-03-01T00:00:00.000Z"))).toBe(
      "20260301-120000AM",
    );
  });

  test("formatLocalFileDateTime12Hour uses compact AM/PM suffix", () => {
    const value = formatLocalFileDateTime12Hour(new Date("2026-03-01T09:15:30.000Z"));
    expect(value).toMatch(/^\d{8}-\d{6}(AM|PM)$/);
  });
});
