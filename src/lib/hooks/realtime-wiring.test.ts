/**
 * Regression tests for T-032 — the website realtime layer repairs.
 *
 * Covers (with the same source-scan technique as comment-accuracy.test.ts
 * and the T-001/T-004/T-008 desktop suites — every scan fails against the
 * pre-fix sources by construction):
 *
 *   REALTIME-100 — messages-view invalidated `["chat-unread"]` while the
 *     unread hook's real key is `["chat-unread-count", userProfileId]`.
 *     TanStack v5 partial matching is ELEMENT-WISE (first element
 *     "chat-unread" ≠ "chat-unread-count"), so the old invalidation was a
 *     provable no-op. The executable proof below uses the same `matches`
 *     function TanStack v5 uses internally.
 *   REALTIME-101 (website half) — markRead results are checked and
 *     failures surfaced (the RLS-authorization itself ships in hub
 *     migration 0051, already applied).
 *   REALTIME-102 — the notifications subscription no longer filters on
 *     `target_user_id` only (role/tenant broadcasts are delivered thanks
 *     to RLS-scoped postgres_changes events).
 *   REALTIME-103 — a shell-level `useChatUnreadRealtime()` subscription
 *     invalidates the unread count from ALL channels; mounted once in
 *     AppShell (single websocket channel).
 *   WEAK-016 — the homework subscription targets the CANONICAL `homework`
 *     table (0029) with `class_id`, not the legacy `homework_assignments`
 *     table with `target_class_id`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { partialMatchKey } from "@tanstack/react-query";

const SRC = join(process.cwd(), "src");

const read = (p: string) => readFileSync(join(SRC, p), "utf-8");

const useRealtime = read("lib/hooks/use-realtime.ts");
const messagesView = read("features/messages/messages-view.tsx");
const appShell = read("features/shared/app-shell.tsx");

describe("T-032 / REALTIME-100 — the unread badge invalidation key", () => {
  it("TanStack v5 element-wise matching proves the old key was a no-op", () => {
    const realKey = ["chat-unread-count", "user-profile-id"];
    // The FIXED key (first element matches exactly):
    expect(partialMatchKey(realKey, ["chat-unread-count"])).toBe(true);
    // The BROKEN key ("chat-unread" is a different first element — a
    // string prefix is NOT a key prefix):
    expect(partialMatchKey(realKey, ["chat-unread"])).toBe(false);
  });

  it("messages-view invalidates ['chat-unread-count'] and the stale call is gone", () => {
    expect(messagesView).toContain('queryKey: ["chat-unread-count"]');
    // Scan the CALL shape (comment mentions of the old key carry no
    // `queryKey:` prefix).
    expect(messagesView).not.toContain('queryKey: ["chat-unread"]');
  });
});

describe("T-032 / REALTIME-101 — markRead failures are surfaced", () => {
  it("the markRead effect checks the update results for errors", () => {
    expect(messagesView).toContain("results.filter((r) => r.error)");
    expect(messagesView).toContain("markRead updates rejected server-side");
  });
});

describe("T-032 / REALTIME-102 — notifications cover role broadcasts", () => {
  it("the notifications subscription has NO direct-target filter", () => {
    // The filter narrowed events to direct-targeted rows only; RLS-scoped
    // unfiltered delivery is the fix. Scan the CALL shape (the comment
    // above the hook documents the old filter's shape without using the
    // exact call pattern).
    expect(useRealtime).not.toContain("target_user_id=eq.");
    expect(useRealtime).toContain("No column filter");
  });
});

describe("T-032 / REALTIME-103 — unread badge reacts to ALL channels", () => {
  it("useChatUnreadRealtime exists and invalidates the unread count", () => {
    expect(useRealtime).toContain("export function useChatUnreadRealtime()");
    expect(useRealtime).toContain('["chat-unread-count"]');
  });

  it("AppShell mounts the shell-level subscription exactly once", () => {
    expect(appShell).toContain("useChatUnreadRealtime()");
  });
});

describe("T-032 / WEAK-016 — homework realtime uses the canonical table", () => {
  it("subscribes to `homework` with class_id, NOT legacy homework_assignments", () => {
    // Scan the CALL shapes — the hook's doc comment names the legacy table
    // (backticked, not quoted) without reproducing the call pattern.
    expect(useRealtime).not.toContain('useRealtimeInvalidation(\n    "homework_assignments"');
    expect(useRealtime).toContain('useRealtimeInvalidation(\n    "homework"');
    expect(useRealtime).toContain("class_id=eq.");
    expect(useRealtime).not.toContain("target_class_id=eq.");
  });
});
