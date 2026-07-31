import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatRelative,
  formatInitials,
  formatFullName,
  daysUntil,
} from "@/lib/format";

describe("formatCurrency", () => {
  it("formats a positive amount in DZD by default", () => {
    const result = formatCurrency(15000);
    expect(result).toContain("15");
    // DZD may render as "DZD", "DA", or "د.ج" depending on runtime locale data.
    expect(result).toMatch(/DZD|DA|د\.ج/);
  });

  it("handles zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("handles negative amounts when signed", () => {
    const result = formatCurrency(-500, { signed: true });
    expect(result).toContain("-");
    expect(result).toContain("500");
  });

  it("respects custom currency", () => {
    const result = formatCurrency(100, { currency: "EUR" });
    expect(result).toContain("100");
    // Intl may render "€" or "EUR" depending on the runtime — accept either.
    expect(result).toMatch(/EUR|€/);
  });
});

describe("formatNumber", () => {
  it("formats integers with no decimals by default", () => {
    const result = formatNumber(1500);
    // The exact thousands separator depends on the runtime locale data;
    // we just verify the digits are present.
    expect(result).toContain("1");
    expect(result).toContain("500");
    expect(result).not.toContain(".");
  });

  it("respects decimal parameter", () => {
    const result = formatNumber(3.14159, { decimals: 2 });
    expect(result).toContain("3");
    expect(result).toContain("14");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date string", () => {
    const result = formatDate("2026-07-15T10:00:00Z");
    expect(result).toContain("2026");
  });

  it("returns a dash for invalid dates", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("handles Date objects", () => {
    const d = new Date("2026-07-15");
    const result = formatDate(d);
    expect(result).toContain("2026");
  });
});

describe("formatRelative", () => {
  it("returns a string for a future date", () => {
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const result = formatRelative(future);
    expect(typeof result).toBe("string");
    expect(result).not.toBe("—");
  });

  it("returns a string for a past date", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = formatRelative(past);
    expect(typeof result).toBe("string");
    expect(result).not.toBe("—");
  });

  it("returns dash for invalid date", () => {
    expect(formatRelative("invalid")).toBe("—");
  });
});

describe("formatInitials", () => {
  it("returns first + last initials", () => {
    expect(formatInitials("Amine", "Belkacem")).toBe("AB");
  });

  it("returns uppercase", () => {
    expect(formatInitials("amine", "belkacem")).toBe("AB");
  });

  it("returns ? for empty input", () => {
    expect(formatInitials(null, undefined)).toBe("?");
  });

  it("handles single name", () => {
    expect(formatInitials("Amine", null)).toBe("A");
  });
});

describe("formatFullName", () => {
  it("joins first + last name", () => {
    expect(formatFullName({ first_name: "Amine", last_name: "Belkacem" })).toBe(
      "Amine Belkacem"
    );
  });

  it("includes middle name when present", () => {
    expect(
      formatFullName({ first_name: "Amine", middle_name: "Mohamed", last_name: "Belkacem" })
    ).toBe("Amine Mohamed Belkacem");
  });

  it("trims whitespace", () => {
    expect(formatFullName({ first_name: "  Amine  ", last_name: "  Belkacem  " })).toBe(
      "Amine Belkacem"
    );
  });
});

describe("daysUntil", () => {
  it("returns positive days for a future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(daysUntil(future)).toBeGreaterThanOrEqual(4);
    expect(daysUntil(future)).toBeLessThanOrEqual(5);
  });

  it("returns negative days for a past date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    expect(daysUntil(past)).toBeLessThanOrEqual(-3);
    expect(daysUntil(past)).toBeGreaterThanOrEqual(-4);
  });

  it("returns 0 for invalid date", () => {
    expect(daysUntil("invalid")).toBe(0);
  });

  it("returns ~0 for today", () => {
    expect(daysUntil(new Date())).toBe(0);
  });
});
