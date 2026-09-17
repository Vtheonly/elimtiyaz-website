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
 * Progress: iteration 3 complete (shared components + app chrome migrated:
 * global-error, page splash, dialog Close, error-boundary, state-views,
 * offline-indicator, sw-update-banner, pwa-install-prompt, bottom-nav,
 * top-app-bar — 21 pairs migrated, 32 remain).
 */
const ALLOWLIST: ReadonlyArray<readonly [string, string]> = [
    ["src/features/academic/academic-view.tsx", "Aucun élève sélectionné"],
    ["src/features/academic/academic-view.tsx", "Aucune note pour cette période"],
    ["src/features/academic/academic-view.tsx", "Bulletin ouvert — utilisez le dialogue d'impression pour enregistrer en PDF"],
    ["src/features/academic/academic-view.tsx", "• hors moyenne"],
    ["src/features/attendance/absence-justification-dialog.tsx", "Annuler"],
    ["src/features/attendance/absence-justification-dialog.tsx", "Choisir un fichier"],
    ["src/features/attendance/absence-justification-dialog.tsx", "Envoyer"],
    ["src/features/attendance/absence-justification-dialog.tsx", "Ex: Certificat médical fourni. Enfant malade du…"],
    ["src/features/attendance/absence-justification-dialog.tsx", "Fournissez une note explicative et/ou un justificatif (certificat médical, convocation, etc.). L'administration examinera votre demande."],
    ["src/features/attendance/absence-justification-dialog.tsx", "Justification envoyée. L'administration va l'examiner."],
    ["src/features/attendance/absence-justification-dialog.tsx", "Justifier une absence"],
    ["src/features/attendance/absence-justification-dialog.tsx", "Lien Google Drive (optionnel)"],
    ["src/features/attendance/absence-justification-dialog.tsx", "Note de justification"],
    ["src/features/attendance/absence-justification-dialog.tsx", "Pièce jointe (PDF, image — max 10 Mo)"],
    ["src/features/attendance/absence-justification-dialog.tsx", "Retirer"],
    ["src/features/attendance/absence-justification-dialog.tsx", "Échec de l'envoi du fichier:"],
    ["src/features/attendance/absence-justification-dialog.tsx", "Validation error."],
    ["src/features/attendance/attendance-view.tsx", "Justifier cette absence"],
    ["src/features/auth/activation-code-screen.tsx", "— ou —"],
    ["src/features/financial/financial-view.tsx", "↔ Paire annulée :"],
    ["src/features/homework/homework-view.tsx", "Attachment"],
    ["src/features/messages/messages-view.tsx", "Conversations"],
    ["src/features/messages/messages-view.tsx", "Sélectionnez une conversation"],
    ["src/features/notifications/notifications-view.tsx", "Marqué comme lu"],
    ["src/features/notifications/notifications-view.tsx", "Notification invalide."],
    ["src/features/profile/profile-view.tsx", "Impossible d'activer les notifications"],
    ["src/features/profile/profile-view.tsx", "Non disponible"],
    ["src/features/profile/profile-view.tsx", "Notifications activées"],
    ["src/features/profile/profile-view.tsx", "Notifications désactivées"],
    ["src/features/profile/profile-view.tsx", "Notifications push"],
    ["src/features/profile/profile-view.tsx", "Préférences"],
    ["src/features/profile/student-documents-card.tsx", "Échec de l'envoi du fichier:"],
];

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

  it("scanner and dictionary parse cleanly (report is an array)", () => {
    expect(Array.isArray(findings)).toBe(true);
  });
});
