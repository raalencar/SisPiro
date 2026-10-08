import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatDateOnly, formatNumber } from "./format";

describe("formatters", () => {
  it("formats currency and numbers in Brazilian Portuguese", () => {
    expect(formatCurrency(1234.5)).toContain("1.234,50");
    expect(formatNumber(12345.6)).toBe("12.345,6");
  });

  it("formats dates in the São Paulo time zone", () => {
    expect(formatDate("2026-01-02T01:00:00Z")).toBe("01/01/2026");
    expect(formatDateOnly("2026-01-02T00:00:00.000Z")).toBe("02/01/2026");
  });
});
