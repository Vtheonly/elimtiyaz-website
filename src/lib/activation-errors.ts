/**
 * Activation-bind error mapping (T-153 / ACT-200 UX half).
 *
 * The activation-code screen used to regex-test `data.error` — but the
 * canonical hub EF (bind-activation-code, consolidated by T-146) returns
 * STRUCTURED errors: `{ error: { code, message, details } }` (the
 * _shared/cors.ts jsonError shape). Stringifying that object yields
 * "[object Object]", so every failure — expired, suspended, not-found —
 * collapsed into the generic "Code d'activation invalide ou déjà
 * utilisé." message (the owner's exact report).
 *
 * This helper maps the structured error to a precise dictionary key:
 *   account_already_active → success (the portal refreshes; idempotent)
 *   code_expired           → expired message
 *   account_suspended /
 *   account_rejected       → actionable "contact the administration" message
 *   code_not_found         → invalid-or-used message (honest: the code is
 *                            missing from the server OR consumed)
 *   parent_already_bound   → the family profile is linked to another account
 *   auth_failed /
 *   unauthorized /
 *   profile_not_found      → session message (sign in again)
 *   anything else          → generic error
 *
 * String-shaped errors (the pre-T-146 drifted EF returned plain strings)
 * are tolerated via regex fallbacks for safety.
 */

export type ActivationErrorAction =
  | { kind: "already-active" }
  | { kind: "error"; messageKey: string };

const KEY_INVALID = "activation.code.error.invalid";
const KEY_EXPIRED = "activation.code.error.expired";
const KEY_SUSPENDED = "activation.code.error.suspended";
const KEY_SESSION = "activation.code.error.session";
const KEY_BOUND = "activation.code.error.bound";
const KEY_GENERIC = "activation.code.error.generic";

interface StructuredError {
  code?: string;
  message?: string;
}

/**
 * Map a bind-activation-code HTTP error body to the action the
 * activation screen should take. Accepts the canonical structured shape
 * `{ error: { code, message } }`, a legacy plain-string `error`, or
 * anything else (→ generic).
 */
export function mapActivationError(body: unknown): ActivationErrorAction {
  const err = (body as { error?: unknown } | null | undefined)?.error;
  const structured: StructuredError | null =
    typeof err === "object" && err !== null ? (err as StructuredError) : null;
  const code = structured?.code ?? "";
  const message = typeof err === "string" ? err : structured?.message ?? "";

  if (code === "account_already_active" || /already.*active/i.test(message)) {
    return { kind: "already-active" };
  }
  if (code === "code_expired" || /expired/i.test(message)) {
    return { kind: "error", messageKey: KEY_EXPIRED };
  }
  if (code === "account_suspended" || code === "account_rejected") {
    return { kind: "error", messageKey: KEY_SUSPENDED };
  }
  if (code === "auth_failed" || code === "unauthorized" || code === "profile_not_found") {
    return { kind: "error", messageKey: KEY_SESSION };
  }
  if (code === "parent_already_bound") {
    return { kind: "error", messageKey: KEY_BOUND };
  }
  if (code === "code_not_found" || /invalid|not found|already.*used/i.test(message)) {
    return { kind: "error", messageKey: KEY_INVALID };
  }
  return { kind: "error", messageKey: KEY_GENERIC };
}
