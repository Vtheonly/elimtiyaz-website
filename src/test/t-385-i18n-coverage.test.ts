/**
 * T-385 regression suite — full i18n coverage guards (I18N-500).
 *
 * The portal is a 3-locale application (fr / ar / en) whose entire visible
 * surface must route through the dictionary (src/lib/i18n/dictionary.ts).
 * The 58th-session dossier audit (T-328) fixed the dossier dialog; this
 * suite generalizes the discipline to the WHOLE app.
 *
 * Three guards:
 *
 *  1. LOCALE PARITY — fr/ar/en dictionaries must carry the IDENTICAL key
 *     set (a key present in one locale and missing in another silently
 *     falls back to French — the `activation.code.error.network` gap this
 *     task started from).
 *
 *  2. NO NEW HARDCODED STRINGS — the AST scanner
 *     (scripts/i18n/scan-hardcoded-strings.mjs) parses every source file
 *     and reports user-visible literals. Every finding must appear in the
 *     ALLOWLIST below (file + text). The allowlist is the burn-down list:
 *     as strings are migrated to the dictionary their entries are
 *     DELETED here; the list is EMPTY when T-385 completes. A finding
 *     NOT in the list fails the suite — new code may not ship hardcoded
 *     UI text.
 *
 *  3. NO DUPLICATE KEYS within a locale block (a duplicate silently
 *     shadows the earlier definition).
 *
 * Out of scope by design (documented in the hub task registry T-385):
 *   - PDF generation (lib/pdf/*, bulletin.ts) — French-only: pdf-lib
 *     standard fonts are WinAnsi (no Arabic script) and the layout is the
 *     T-194/T-368 verbatim port of the desktop reference (ADR-002 parity).
 *   - app metadata (layout.tsx title/description) and the PWA manifest —
 *     static export surfaces; French is the school's default locale
 *     (tenants.default_locale).
 *   - console.* developer logs and `new Error` invariant guards.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DICT = readFileSync(join(ROOT, "src/lib/i18n/dictionary.ts"), "utf8");

/* ─── Guard 1 + 3: locale parity & duplicate keys ─────────────────────────── */

function extractBlock(startIdx: number): string {
  let depth = 0,
    started = false;
  for (let i = startIdx; i < DICT.length; i++) {
    if (DICT[i] === "{") {
      depth++;
      started = true;
    } else if (DICT[i] === "}") {
      depth--;
      if (started && depth === 0) return DICT.slice(startIdx, i + 1);
    }
  }
  throw new Error("unbalanced braces in dictionary.ts");
}

function keysOf(block: string): string[] {
  const out: string[] = [];
  const re = /"([a-zA-Z0-9_.-]+)"\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push(m[1]);
  return out;
}

const frBlock = extractBlock(DICT.indexOf("const fr: Dict = {") + "const fr: Dict = ".length);
const arBlock = extractBlock(DICT.indexOf("const ar: Dict = {") + "const ar: Dict = ".length);
const enBlock = extractBlock(DICT.indexOf("const en: Dict = {") + "const en: Dict = ".length);
const fr = keysOf(frBlock);
const ar = keysOf(arBlock);
const en = keysOf(enBlock);

describe("T-385 — dictionary locale parity", () => {
  it("fr has no duplicate keys", () => {
    expect(new Set(fr).size).toBe(fr.length);
  });
  it("ar has no duplicate keys", () => {
    expect(new Set(ar).size).toBe(ar.length);
  });
  it("en has no duplicate keys", () => {
    expect(new Set(en).size).toBe(en.length);
  });
  it("ar carries exactly the fr key set", () => {
    expect([...new Set(ar)].sort()).toEqual([...new Set(fr)].sort());
  });
  it("en carries exactly the fr key set", () => {
    expect([...new Set(en)].sort()).toEqual([...new Set(fr)].sort());
  });
});

/* ─── Guard 2: hardcoded user-visible strings ─────────────────────────────── */

interface Finding {
  file: string;
  line: number;
  kind: string;
  text: string;
}

/**
 * The T-385 burn-down list (baseline 2026-09-17: 53 unique strings in 20
 * files). Entries are DELETED as their strings migrate to the dictionary.
 * The suite reaches its end state when this list is empty — then every
 * finding of the scanner is a failure.
 *
 * Progress: COMPLETE (2026-09-17) — iterations 3+4 migrated all 53 pairs
 * (shared components, feature views, validation messages, the financial
 * canonical-label render mappings). The list is EMPTY: any new hardcoded
 * user-visible string fails this suite.
 */
const ALLOWLIST: ReadonlyArray<readonly [string, string]> = [];

function runScanner(): Finding[] {
  const script = join(ROOT, "scripts", "i18n", "scan-hardcoded-strings.mjs");
  if (!existsSync(script)) return [];
  // The scanner exits 1 while findings remain — that is expected here.
  try {
    execFileSync("node", [script], { stdio: "pipe", cwd: ROOT });
  } catch {
    /* findings exist — read the report */
  }
  const reportPath = join(ROOT, "scripts", "i18n", "hardcoded-strings-report.json");
  return JSON.parse(readFileSync(reportPath, "utf8")) as Finding[];
}

describe("T-385 — no hardcoded user-visible strings outside the burn-down list", () => {
  const findings = runScanner();
  const allow = new Set(ALLOWLIST.map(([f, t]) => `${f}\u0000${t}`));

  it("every scanner finding is registered in the burn-down list", () => {
    const unregistered = findings.filter((f) => !allow.has(`${f.file}\u0000${f.text}`));
    expect(
      unregistered.map((f) => `${f.file}:${f.line} [${f.kind}] ${f.text}`),
    ).toEqual([]);
  });

  it("the burn-down is complete — zero hardcoded user-visible strings", () => {
    // The end state: the allowlist is empty AND the scanner reports nothing.
    expect(ALLOWLIST).toEqual([]);
    expect(findings).toEqual([]);
  });

  it("scanner and dictionary parse cleanly (report is an array)", () => {
    expect(Array.isArray(findings)).toBe(true);
  });
});
