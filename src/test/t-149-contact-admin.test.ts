/**
 * T-149 regression tests — the parent-initiated "Contacter l'administration"
 * action (ADR-012 / hub migration 0067, the owner's 2026-09-03 mandate:
 * the web messenger connects parents to the Administrator one-on-one;
 * parent↔parent communication is forbidden).
 *
 * Before T-149 the portal messenger was READ+REPLY only with ZERO
 * channel-creation capability — and since staff never open channels
 * proactively (live: 0 rows in chat_channels), parents saw
 * "Aucune conversation" forever (CHAT-200a). The portal now offers exactly
 * ONE creation action: open the administration channel via the canonical,
 * caller-verified, idempotent open_parent_admin_channel RPC.
 *
 * These source-scan tests pin:
 *   1. the RPC is typed in the Database interface (WEAK-017: no casts).
 *   2. MessagesView calls the RPC and invalidates the channels query with
 *      the element-wise key ["chat-channels", user?.id] (the REALTIME-100
 *      lesson: a mismatched first element silently matches nothing).
 *   3. the action is idempotent-safe (guarded against double-clicks) and
 *      surfaces BOTH the success and error toasts.
 *   4. the i18n dictionary carries the contactAdmin keys in ALL THREE
 *      locales (fr/ar/en) — the dictionary completeness test enforces
 *      key parity, this pins the keys exist at all.
 *   5. the portal does NOT call create_direct_channel (staff-only, 0061)
 *      — the parent side must go through the parent-gated RPC only.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../../src");

const read = (rel: string): string => readFileSync(join(SRC, rel), "utf8");

describe("T-149 — Contacter l'administration (ADR-012, migration 0067)", () => {
  it("open_parent_admin_channel is typed in the Database interface (WEAK-017)", () => {
    const text = read("lib/types/database.ts");
    expect(text).toContain("open_parent_admin_channel: { Args: { p_name?: string | null }; Returns: ChatChannelRow }");
  });

  it("MessagesView calls the canonical RPC and selects the returned channel", () => {
    const text = read("features/messages/messages-view.tsx");
    expect(text).toContain('supabase.rpc("open_parent_admin_channel")');
    expect(text).toContain("setActiveChannelId(data.id)");
  });

  it("the channels query is invalidated with the element-wise key (REALTIME-100 lesson)", () => {
    const text = read("features/messages/messages-view.tsx");
    // The channels hook's key is ["chat-channels", userProfileId] — the
    // invalidation must match element-wise, not with a different key family.
    expect(text).toContain(
      'queryClient.invalidateQueries({ queryKey: ["chat-channels", user?.id] })',
    );
    const hookText = read("lib/hooks/portal-queries.ts");
    expect(hookText).toContain('queryKey: ["chat-channels", userProfileId]');
  });

  it("the action guards double-clicks and surfaces success + error toasts", () => {
    const text = read("features/messages/messages-view.tsx");
    expect(text).toContain("if (!supabase || openingAdmin) return;");
    expect(text).toContain('t("messages.contactAdmin.error")');
    expect(text).toContain('t("messages.contactAdmin.success")');
  });

  it("the contactAdmin i18n keys exist in all three locales", () => {
    const dict = read("lib/i18n/dictionary.ts");
    for (const key of [
      "messages.contactAdmin",
      "messages.contactAdmin.opening",
      "messages.contactAdmin.body",
      "messages.contactAdmin.success",
      "messages.contactAdmin.error",
    ]) {
      // each key must appear 3 times (fr, ar, en sections)
      const occurrences = dict.split(`"${key}"`).length - 1;
      expect(occurrences).toBeGreaterThanOrEqual(3);
    }
  });

  it("the portal NEVER calls the staff-only create_direct_channel RPC", () => {
    const view = read("features/messages/messages-view.tsx");
    const queries = read("lib/hooks/portal-queries.ts");
    expect(view).not.toContain("create_direct_channel");
    expect(queries).not.toContain("create_direct_channel");
  });
});
