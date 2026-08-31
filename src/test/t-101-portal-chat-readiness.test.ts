/**
 * T-101 regression tests — website chat readiness for the completed backend
 * (migration 0061 + T-099 desktop writer; CHAT-103 resolved by the owner's
 * product decision "fix and test the chat in all platforms").
 *
 * The parent portal is READ+REPLY by design: parents see the channels staff
 * open for them (parent-detail-drawer "Messager" → create_direct_channel
 * RPC). These tests pin the portal-side behaviours that make those channels
 * render correctly:
 *
 *   1. the typed ChatChannelRow carries the 0061 completion columns
 *      (last_message_at / last_message_preview / archived_at / description /
 *      department_id) — no `as unknown as` widening needed (WEAK-017 rule).
 *   2. useChatChannels filters ARCHIVED channels and orders by LAST ACTIVITY
 *      (CHAT-104), not by any-column updated_at.
 *   3. the channel list renders the denormalized last-message preview.
 *   4. the unread-count accuracy note no longer claims "no production
 *      writers" (that condition was CHAT-103, resolved 2026-08-31).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../../src");

describe("T-101 — website chat on the completed backend (migration 0061)", () => {
  it("ChatChannelRow carries the 0061 completion columns", () => {
    const text = readFileSync(join(SRC, "lib/types/database.ts"), "utf8");
    const block = text.slice(
      text.indexOf("export type ChatChannelRow"),
      text.indexOf("export type ChatChannelRow") + 700,
    );
    for (const col of [
      "description",
      "department_id",
      "archived_at",
      "last_message_at",
      "last_message_preview",
    ]) {
      expect(block).toContain(`${col}:`);
    }
  });

  it("useChatChannels hides archived channels and orders by last activity (CHAT-104)", () => {
    const text = readFileSync(join(SRC, "lib/hooks/portal-queries.ts"), "utf8");
    expect(text).toContain('.is("archived_at", null)');
    expect(text).toContain('.order("last_message_at", { ascending: false, nullsFirst: false })');
    // the old any-activity ordering must be gone from the channels query
    const channelsBlock = text.slice(
      text.indexOf("export function useChatChannels"),
      text.indexOf("export function useChatMessages"),
    );
    expect(channelsBlock).not.toContain('order("updated_at"');
  });

  it("the channel list renders the denormalized last-message preview", () => {
    const text = readFileSync(join(SRC, "features/messages/messages-view.tsx"), "utf8");
    expect(text).toContain("channel.last_message_preview");
    expect(text).toContain("channel.last_message_at ?? channel.updated_at");
  });

  it("the unread-count note no longer claims chat has no production writers", () => {
    const text = readFileSync(join(SRC, "lib/hooks/portal-queries.ts"), "utf8");
    // The old note justified the lower-bound with CHAT-103/UNKNOWN-005 —
    // resolved 2026-08-31 (owner decision; migration 0061 + desktop writer).
    expect(text).not.toContain("while chat has no production writers");
    expect(text).toContain("chat HAS production writers");
  });
});
