/**
 * T-367 regression tests — the `student_documents` row INSERT must carry
 * `tenant_id` (UPLOAD-104: the table leg the 64th session never probed).
 *
 * The defect (live-proven 2026-09-14, 66th session — the owner's console
 * evidence `rest/v1/student_documents → 403` ×2):
 *   `UploadDocumentDialog` uploaded the file to Storage under the
 *   tenant-scoped path (the T-360 fix — that leg SUCCEEDS), then inserted
 *   the metadata row WITHOUT `tenant_id`. The column has NO default
 *   (hub migration 0005) and the `student_documents_parent_insert` WITH
 *   CHECK (hub 0043) requires `tenant_id = current_tenant_id()` — the
 *   omitted column lands as NULL, fails the RLS check with SQLSTATE 42501,
 *   and PostgREST answers HTTP 403. Every attempt also ORPHANED the just
 *   -uploaded Storage object.
 *
 * These tests pin:
 *   1. The dialog's insert payload includes `tenant_id: tenantId` (the fix).
 *   2. The insert is still preceded by the tenant-scoped storage upload
 *      (the UPLOAD-101 fix is not regressed by the UPLOAD-104 fix).
 *   3. EVERY `.from("student_documents").insert(` call site in src/ carries
 *      a tenant_id key in its payload — the whole bug class, not just this
 *      file (the t-184/t-199/t-360 whole-src scan pattern).
 *   4. The sibling convention (chat_messages insert carries
 *      `tenant_id: channel.tenant_id`) stays in place (cross-writer guard).
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
const MESSAGES = readFileSync(
  join(SRC, "features/messages/messages-view.tsx"),
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

describe("T-367 — UPLOAD-104: the student_documents row insert carries tenant_id", () => {
  it("the insert payload includes tenant_id: tenantId (the one-line fix)", () => {
    expect(CARD.includes("tenant_id: tenantId,")).toBe(true);
  });

  it("the insert payload keeps the policy-required uploaded_by: user.id term", () => {
    // The 0043 WITH CHECK has TWO caller-owned terms: tenant_id AND
    // uploaded_by = current_user_profile_id() (the portal's user is the
    // user_profiles row — user.id satisfies it). Pin both stay present.
    expect(CARD.includes("uploaded_by: user.id,")).toBe(true);
  });

  it("the storage upload still precedes the insert with the tenant-scoped path (UPLOAD-101 guard)", () => {
    expect(
      CARD.includes(
        "const objectPath = `${tenantId}/${studentId}/${kind}-${Date.now()}.${ext}`;",
      ),
    ).toBe(true);
    // The upload call must appear BEFORE the insert call in the submit flow.
    const uploadIdx = CARD.indexOf('.from("student-documents")\n        .upload(');
    const insertIdx = CARD.indexOf('.from("student_documents")');
    expect(uploadIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(uploadIdx);
  });

  it("the insert cites UPLOAD-104/T-367 in the code comment (traceability)", () => {
    expect(CARD.includes("UPLOAD-104/T-367")).toBe(true);
  });

  it("EVERY student_documents insert call site in src/ carries a tenant_id key", () => {
    // Every `.from("student_documents").insert({ … })` in PRODUCTION
    // sources: the payload object must contain a `tenant_id:` key. NULL
    // tenant_id is RLS-rejected by the 0043 WITH CHECK (SQLSTATE 42501 →
    // HTTP 403) — the exact UPLOAD-104 failure mode.
    const violators: string[] = [];
    const prodFiles = collectFiles(SRC).filter(
      (f) => !f.startsWith(join(SRC, "test") + sep),
    );
    for (const file of prodFiles) {
      const src = readFileSync(file, "utf8");
      const insertRe =
        /\.from\(\s*["']student_documents["']\s*\)\s*\.\s*insert\(\s*\{/g;
      let m: RegExpExecArray | null;
      while ((m = insertRe.exec(src)) !== null) {
        // Capture the payload object body (balanced to the first `});`).
        const bodyStart = m.index + m[0].length;
        const bodyEnd = src.indexOf("});", bodyStart);
        const body = src.slice(bodyStart, bodyEnd === -1 ? bodyStart + 800 : bodyEnd);
        if (!/tenant_id\s*:/.test(body)) {
          violators.push(`${file}: insert payload without tenant_id`);
        }
      }
    }
    expect(violators).toEqual([]);
  });

  it("the chat_messages insert keeps its tenant_id convention (cross-writer guard)", () => {
    expect(MESSAGES.includes("tenant_id: channel.tenant_id,")).toBe(true);
  });
});
