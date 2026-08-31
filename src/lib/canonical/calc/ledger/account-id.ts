/**
 * CANONICAL ENGINE PORT (website) — verbatim port of the desktop canonical
 * implementation (source path below; sha256 pins the port). T-057
 * (DRIFT-009/DEAD-011): there is NO port-canonical.mjs script (the old
 * header promised one that never existed). When refreshing this file, port
 * the function(s) below verbatim from the desktop source and keep the
 * exported surface identical — the website is a read-only portal, and the
 * unused payment/pricing subtrees were pruned in T-057 (never re-add them;
 * financial write-path logic lives server-side per ADR-002).
 * Source: elimtiyaz-desktop/src/domain/calc/ledger/account-id.ts
 * Source sha256 (first 12): 906cce926d06
 * Equivalence: verified by cross-platform-equivalence suite.
 */
/**
 * Ledger account ID derivation — single source of truth.
 *
 * Account IDs are deterministic: the same `(parentId, category, studentId)`
 * always produces the same ID. This means balances can be looked up
 * without a separate "accounts" table.
 *
 * Format: `parent:{parentId}:category:{category}` (+ `:student:{studentId}`
 * when student-scoped).
 *
 * Extracted verbatim from `domain/model/ledger.ts` `deriveAccountId`.
 */
import type { PaymentCategory } from "../../model/payment";

/**
 * Derive the canonical account ID for a parent + (optional) student + category.
 *
 * @param parentId   The parent's unique ID.
 * @param category   The payment category (tuition, transport, etc.).
 * @param studentId  Optional student ID for student-scoped accounts.
 * @returns The deterministic account ID string.
 */
export function deriveAccountId(
  parentId: string,
  category: PaymentCategory,
  studentId: string | null = null,
): string {
  // Use a delimiter that cannot appear in IDs themselves.
  const parts = ["parent", parentId, "category", category];
  if (studentId) parts.push("student", studentId);
  return parts.join(":");
}
