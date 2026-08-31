/**
 * T-052 — notification badge correctness regression suite (NOTIF-102/103).
 *
 * NOTIF-102 (desktop): the topbar computed unreadCount AFTER slicing the
 * sorted list to 8 items — the bell badge capped at 8 even with 50 unread.
 * Fixed: the count is computed from the FULL visible list; the slice is a
 * dropdown display limit only.
 *
 * NOTIF-103 (website): bottom-nav/DesktopRail ran a dead unread query
 * (fetched 1 row, computed a boolean, never rendered it) and the top-app-bar
 * used limit:50 + .length (badge capped at 50). Fixed: dead queries removed;
 * the top bar uses the NEW useUnreadNotificationCount COUNT-only hook.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DESKTOP = "/home/z/my-project/repos/AgentGithubUplaod/elimtiyaz-desktop/src";
const WEBSITE = join(__dirname, "../../src");

describe("T-052 — NOTIF-102: desktop badge counts ALL unread (no 8-cap)", () => {
  it("unreadCount is computed from the full visible list, before the 8-item display slice", () => {
    const text = readFileSync(join(DESKTOP, "shared/layout/topbar.tsx"), "utf8");
    // the full list exists…
    expect(text).toContain("allVisibleNotifications");
    // …the display list is its slice…
    expect(text).toContain("allVisibleNotifications.slice(0, 8)");
    // …and the count filters the FULL list, not the slice.
    expect(text).toContain("allVisibleNotifications.filter((n) => !n.readAt).length");
    // the old slice-then-count pattern must be gone.
    expect(text).not.toContain("visibleNotifications.filter((n) => !n.readAt).length");
  });
});

describe("T-052 — NOTIF-103: website badge is the TRUE count + dead queries gone", () => {
  it("the COUNT-only hook exists (head:true, no row transfer, same delivery paths)", () => {
    const text = readFileSync(join(WEBSITE, "lib/hooks/portal-queries.ts"), "utf8");
    expect(text).toContain("export function useUnreadNotificationCount");
    expect(text).toContain('{ count: "exact", head: true }');
    // the delivery paths mirror useNotifications (direct + parent broadcast)
    expect(text).toContain("target_user_id.eq.${targetUserId},and(target_user_id.is.null,target_role.eq.parent)");
  });

  it("the top app bar uses the count hook (no 50-cap length pattern)", () => {
    const text = readFileSync(join(WEBSITE, "features/shared/top-app-bar.tsx"), "utf8");
    expect(text).toContain("useUnreadNotificationCount(user?.id ?? null)");
    expect(text).not.toContain("limit: 50");
    expect(text).not.toMatch(/unread\?\.length/);
  });

  it("the dead unread queries are gone from bottom-nav (both components)", () => {
    const text = readFileSync(join(WEBSITE, "features/shared/bottom-nav.tsx"), "utf8");
    expect(text).not.toContain("useNotifications");
    expect(text).not.toContain("hasUnreadNotifications");
    expect(text).not.toContain("limit: 1");
  });
});
