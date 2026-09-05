/**
 * T-187 regression tests — the activation screen must tell the user when
 * the SERVER was never reached (ACT-204).
 *
 * The defect (owner-reported 2026-09-05, production Vercel console):
 *   `[activation-code] submit failed: TypeError: Failed to fetch`
 *
 * During the ACT-203 CORS-allowlist gap, the browser blocked the
 * bind-activation-code preflight (`Access-Control-Allow-Origin` was the
 * dev `http://localhost:5173`, not the production origin), so `fetch`
 * threw a TypeError with NO HTTP response. The screen's catch block
 * showed the generic "Impossible d'activer le compte. Veuillez
 * réessayer." — which wrongly blamed the activation CODE (and told the
 * user to retry, which could never succeed while blocked).
 *
 * T-187: a TypeError in the catch block now maps to the dedicated
 * `activation.code.error.network` key ("Impossible de joindre le
 * serveur…"), while non-TypeError throws keep the generic key. The
 * T-153/T-184 contracts (structured-error mapping, env-resolved URL)
 * are untouched.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "src");

const SCREEN = readFileSync(join(SRC, "features/auth/activation-code-screen.tsx"), "utf8");
const DICTIONARY = readFileSync(join(SRC, "lib/i18n/dictionary.ts"), "utf8");

describe("T-187 — activation network-failure message (ACT-204)", () => {
  it("the catch block maps TypeError (fetch-level failure) to the network key", () => {
    // The exact discriminator + key the fix introduced.
    expect(SCREEN).toContain("err instanceof TypeError");
    expect(SCREEN).toContain('"activation.code.error.network"');
  });

  it("non-TypeError throws keep the generic key (no behavior change for app errors)", () => {
    // The ternary fallback must remain the generic key.
    const ternary = SCREEN.match(
      /err instanceof TypeError\s*\?\s*"activation\.code\.error\.network"\s*:\s*"activation\.code\.error\.generic"/,
    );
    expect(ternary).toBeTruthy();
  });

  it("the network key exists in the dictionary with user-actionable French text", () => {
    expect(DICTIONARY).toContain('"activation.code.error.network"');
    const value = DICTIONARY.match(
      /"activation\.code\.error\.network":\s*"([^"]+)"/,
    )?.[1] ?? "";
    // Actionable: tells the user to check the connection and who to contact.
    expect(value).toContain("Impossible de joindre le serveur");
    expect(value).toContain("connexion internet");
  });

  it("the T-184 contract is preserved: the URL still resolves through @/lib/env", () => {
    expect(SCREEN).toContain("${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bind-activation-code");
  });

  it("the T-153 contract is preserved: structured HTTP errors still map via mapActivationError", () => {
    expect(SCREEN).toContain("mapActivationError(data)");
    // The network mapping must live in the CATCH block only — the HTTP
    // error path (resp.ok === false) keeps using mapActivationError.
    // (Check the CALL, not the word: the catch block's comment references
    // the helper by name.)
    const catchBlock = SCREEN.split("} catch (err) {")[1]?.split("};")[0] ?? "";
    expect(catchBlock).not.toContain("mapActivationError(");
  });
});
