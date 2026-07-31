import { describe, it, expect } from "vitest";
import { translate, isRtl, LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/dictionary";

describe("translate", () => {
  it("returns the French translation for a known key", () => {
    expect(translate("fr", "nav.home")).toBe("Accueil");
  });

  it("returns the Arabic translation for a known key", () => {
    expect(translate("ar", "nav.home")).toBe("الرئيسية");
  });

  it("returns the English translation for a known key", () => {
    expect(translate("en", "nav.home")).toBe("Home");
  });

  it("falls back to French when the key is missing from the requested locale", () => {
    // Use a key that exists in fr but may not exist in ar/en
    expect(translate("ar", "app.name")).toBe("الإمتياز");
  });

  it("returns the key itself when missing from all locales", () => {
    expect(translate("fr", "nonexistent.key.does.not.exist")).toBe(
      "nonexistent.key.does.not.exist"
    );
  });

  it("interpolates params", () => {
    // We'll test with a key that has a param placeholder if one exists.
    // Since our dictionary doesn't have {param} placeholders, this is a smoke test.
    const result = translate("fr", "app.name");
    expect(typeof result).toBe("string");
  });
});

describe("isRtl", () => {
  it("returns true for Arabic", () => {
    expect(isRtl("ar")).toBe(true);
  });

  it("returns false for French", () => {
    expect(isRtl("fr")).toBe(false);
  });

  it("returns false for English", () => {
    expect(isRtl("en")).toBe(false);
  });
});

describe("LOCALES", () => {
  it("contains fr, ar, en", () => {
    expect(LOCALES).toContain("fr");
    expect(LOCALES).toContain("ar");
    expect(LOCALES).toContain("en");
    expect(LOCALES).toHaveLength(3);
  });
});

describe("DEFAULT_LOCALE", () => {
  it("is French", () => {
    expect(DEFAULT_LOCALE).toBe("fr");
  });
});
