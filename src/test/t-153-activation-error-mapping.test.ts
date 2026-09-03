/**
 * T-153 regression tests — activation-screen precise error mapping
 * (ACT-200's UX half; the EF consolidation is T-146).
 *
 * The defect: the activation-code screen regex-tested `data.error` — but
 * the canonical hub EF returns STRUCTURED errors
 * `{ error: { code, message, details } }` (the _shared/cors.ts jsonError
 * shape). Stringifying that object yields "[object Object]", so EVERY
 * failure — expired, suspended, already-used, session — collapsed into
 * the generic "Code d'activation invalide ou déjà utilisé." message: the
 * exact string in the owner's 2026-09-03 report.
 *
 * These tests pin the mapActivationError contract against the codes the
 * consolidated EF actually emits (live-verified by T-147's round-trip:
 * 200 / 404 code_not_found / 409 account_already_active / 400
 * invalid_code_format / 401 auth_failed + the 403 account_suspended /
 * account_rejected and 409 parent_already_bound branches):
 *   1. account_already_active → the refresh success path
 *   2. code_not_found → the invalid-or-used message (single-use honesty)
 *   3. code_expired → the expired message
 *   4. account_suspended / account_rejected → the suspended message
 *   5. auth_failed / unauthorized / profile_not_found → the session message
 *   6. parent_already_bound → the bound message
 *   7. unknown structured errors → the generic message
 *   8. legacy STRING-shaped errors still map (regex fallback)
 *   9. the activation screen consumes the helper (no raw data.error regex)
 *  10. all new message keys exist in all three locales
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mapActivationError } from "@/lib/activation-errors";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "src");

describe("T-153 — activation-bind error mapping (ACT-200 UX)", () => {
  it("account_already_active maps to the refresh success path", () => {
    expect(
      mapActivationError({ error: { code: "account_already_active", message: "Account is already active." } }),
    ).toEqual({ kind: "already-active" });
  });

  it("code_not_found maps to the invalid-or-used message (single-use honesty)", () => {
    expect(
      mapActivationError({ error: { code: "code_not_found", message: "Invalid or already-used activation code" } }),
    ).toEqual({ kind: "error", messageKey: "activation.code.error.invalid" });
  });

  it("code_expired maps to the expired message", () => {
    expect(
      mapActivationError({ error: { code: "code_expired", message: "Activation code has expired." } }),
    ).toEqual({ kind: "error", messageKey: "activation.code.error.expired" });
  });

  it("account_suspended and account_rejected map to the suspended message", () => {
    expect(mapActivationError({ error: { code: "account_suspended" } })).toEqual({
      kind: "error",
      messageKey: "activation.code.error.suspended",
    });
    expect(mapActivationError({ error: { code: "account_rejected" } })).toEqual({
      kind: "error",
      messageKey: "activation.code.error.suspended",
    });
  });

  it("auth_failed / unauthorized / profile_not_found map to the session message", () => {
    for (const code of ["auth_failed", "unauthorized", "profile_not_found"]) {
      expect(mapActivationError({ error: { code } })).toEqual({
        kind: "error",
        messageKey: "activation.code.error.session",
      });
    }
  });

  it("parent_already_bound maps to the bound message", () => {
    expect(mapActivationError({ error: { code: "parent_already_bound" } })).toEqual({
      kind: "error",
      messageKey: "activation.code.error.bound",
    });
  });

  it("unknown structured errors fall back to the generic message", () => {
    expect(mapActivationError({ error: { code: "something_new", message: "weird" } })).toEqual({
      kind: "error",
      messageKey: "activation.code.error.generic",
    });
    expect(mapActivationError({})).toEqual({ kind: "error", messageKey: "activation.code.error.generic" });
  });

  it("legacy STRING-shaped errors still map via the regex fallbacks", () => {
    expect(mapActivationError({ error: "Account is already active." })).toEqual({ kind: "already-active" });
    expect(mapActivationError({ error: "This activation code has expired" })).toEqual({
      kind: "error",
      messageKey: "activation.code.error.expired",
    });
    expect(mapActivationError({ error: "Invalid or already-used activation code." })).toEqual({
      kind: "error",
      messageKey: "activation.code.error.invalid",
    });
  });

  it("the activation screen consumes the helper (no raw data.error regex testing)", () => {
    const text = readFileSync(join(SRC, "features/auth/activation-code-screen.tsx"), "utf8");
    expect(text).toContain("mapActivationError(data)");
    expect(text).not.toContain("data?.error ??");
    expect(text).not.toMatch(/\/expired\/i\.test\(msg\)/);
  });

  it("all new message keys exist in all three locales", () => {
    const dict = readFileSync(join(SRC, "lib/i18n/dictionary.ts"), "utf8");
    for (const key of [
      "activation.code.error.suspended",
      "activation.code.error.session",
      "activation.code.error.bound",
    ]) {
      const occurrences = dict.split(`"${key}"`).length - 1;
      expect(occurrences).toBeGreaterThanOrEqual(3);
    }
  });
});
