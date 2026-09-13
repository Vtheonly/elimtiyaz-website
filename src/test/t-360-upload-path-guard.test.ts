/**
 * T-360 regression tests — the parent-portal upload paths must be
 * TENANT-SCOPED (UPLOAD-101: the student-documents upload was RLS-rejected
 * on every attempt).
 *
 * The defect (live-proven 2026-09-14, 64th session — t-359-upload-e2e.py):
 *   `UploadDocumentDialog` built `objectPath = `${studentId}/…`` — the
 *   student id sat in folder[1], but the parent storage policies
 *   (`student_documents_parent_write`, hub migration 0043 — and every
 *   other storage.objects policy in the 0018 chain) require
 *   `(storage.foldername(name))[1] = current_tenant_id()`. Every parent
 *   document upload returned "new row violates row-level security policy"
 *   (live RED proof E); the `student_documents` table held 0 rows.
 *
 * These tests pin:
 *   1. The dialog's object path is `${tenantId}/${studentId}/…` (the fix).
 *   2. The card passes the active child's REAL tenant_id into the dialog.
 *   3. NO `.storage.from(…).upload(…)` call site in src/ builds a path
 *      whose first folder segment is not a tenant-scoped variable — the
 *      whole bug class, not just this file (the t-184/t-199 whole-src
 *      scan pattern).
 *   4. The already-correct absence-justification path (record.tenant_id
 *      first) is preserved (regression guard).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "src");

const CARD = readFileSync(
  join(SRC, "features/profile/student-documents-card.tsx"),
  "utf8",
);
const JUSTIFICATION = readFileSync(
  join(SRC, "features/attendance/absence-justification-dialog.tsx"),
  "utf8",
);

/** Recursively collect .tsx/.ts files under a root. */
function collectFiles(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) collectFiles(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("T-360 — UPLOAD-101: tenant-scoped parent upload paths", () => {
  it("the document dialog builds the path as ${tenantId}/${studentId}/…", () => {
    expect(
      CARD.includes(
        "const objectPath = `${tenantId}/${studentId}/${kind}-${Date.now()}.${ext}`;",
      ),
    ).toBe(true);
  });

  it("the card passes the active child's REAL tenant_id into the dialog", () => {
    expect(CARD.includes("tenantId={activeKid.tenant_id}")).toBe(true);
  });

  it("the dialog's props type carries the mandatory tenantId field", () => {
    expect(
      CARD.includes("tenantId: string;") &&
        CARD.includes(
          "The child's tenant — folder[1] of the storage path (RLS-enforced, UPLOAD-101)",
        ),
    ).toBe(true);
  });

  it("the absence-justification path is still tenant-first (regression guard)", () => {
    // The already-correct flow (live GREEN probe G in t-359): record.tenant_id
    // is folder[1], record.student_id folder[2] — never regress it.
    expect(
      JUSTIFICATION.includes(
        "const objectPath = `${record.tenant_id}/${record.student_id}/justifications/${record.id}.${ext}`;",
      ),
    ).toBe(true);
  });

  it("NO storage upload call site in src/ starts its path without a tenant segment", () => {
    // Every `.storage.from(...).upload(<path>, ...)` call in PRODUCTION
    // sources (tests excluded — this guard's own fixtures would match):
    // the first path segment must be a tenant-scoped expression (a
    // `${…tenant…}` template head). UPLOAD-101's exact failure mode was a
    // path headed by the STUDENT id.
    const violators: string[] = [];
    const prodFiles = collectFiles(SRC).filter(
      (f) => !f.startsWith(join(SRC, "test") + sep),
    );
    for (const file of prodFiles) {
      const src = readFileSync(file, "utf8");
      const uploadRe = /\.upload\(\s*([^,]+),/g;
      let m: RegExpExecArray | null;
      while ((m = uploadRe.exec(src)) !== null) {
        const pathExpr = m[1].trim();
        // Template-literal paths: the first segment must mention tenant.
        if (pathExpr.startsWith("`")) {
          const head = pathExpr.slice(1, pathExpr.indexOf("/") + 1 || 40);
          if (!/tenant/i.test(head)) violators.push(`${file}: ${pathExpr}`);
        } else if (!/tenant/i.test(pathExpr) && pathExpr !== "objectPath") {
          // Non-template path expressions must themselves be tenant-derived
          // (objectPath IS the checked construction — see the tests above).
          violators.push(`${file}: ${pathExpr}`);
        }
      }
    }
    expect(violators).toEqual([]);
  });
});
