import { describe, it, expect } from "vitest";
import { formatNumber, formatPrice, formatPriceRange, formatDuration } from "../format.js";

describe("formatNumber", () => {
  it("passes small numbers through", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
  });

  it("abbreviates thousands, millions and billions with one decimal", () => {
    expect(formatNumber(1_000)).toBe("1.0K");
    expect(formatNumber(15_250)).toBe("15.3K");
    expect(formatNumber(2_500_000)).toBe("2.5M");
    expect(formatNumber(3_000_000_000)).toBe("3.0B");
  });
});

describe("formatPrice", () => {
  it("shows chaos below one divine, rounded", () => {
    expect(formatPrice(0.4, 200)).toBe("0c");
    expect(formatPrice(12.6, 200)).toBe("13c");
    expect(formatPrice(199, 200)).toBe("199c");
  });

  it("switches to divines at or above the divine rate", () => {
    expect(formatPrice(200, 200)).toBe("1.0 div");
    expect(formatPrice(450, 200)).toBe("2.3 div");
  });

  it("never divides by a zero or negative rate", () => {
    expect(formatPrice(5000, 0)).toBe("5000c");
    expect(formatPrice(5000, -1)).toBe("5000c");
  });
});

describe("formatPriceRange", () => {
  it("formats both ends independently", () => {
    expect(formatPriceRange([50, 400], 200)).toBe("50c - 2.0 div");
  });
});

describe("formatDuration", () => {
  it("shows seconds under a minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(59_999)).toBe("59s");
  });

  it("shows minutes and seconds under an hour", () => {
    expect(formatDuration(60_000)).toBe("1m 0s");
    expect(formatDuration(4 * 60_000 + 7_500)).toBe("4m 7s");
  });

  it("shows hours and minutes past an hour", () => {
    expect(formatDuration(3_600_000)).toBe("1h 0m");
    expect(formatDuration(2 * 3_600_000 + 35 * 60_000 + 59_000)).toBe("2h 35m");
  });
});
