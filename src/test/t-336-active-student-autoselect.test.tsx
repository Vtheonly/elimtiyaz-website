/**
 * T-336 / GRADE-102 regression tests — the active-student auto-selection.
 *
 * Problem: the per-child views (academic / attendance / homework /
 * financial) derive their active kid from the app store's
 * `activeStudentId`, but that id was only auto-selected INSIDE the
 * StudentSwitcher components — which every view renders ONLY when the
 * parent has 2+ children. A single-child parent therefore kept
 * `activeStudentId = null` FOREVER:
 *   - the dashboard fell back locally (`kids.find(...) ?? kids[0]`), so the
 *     child WAS visible there;
 *   - every OTHER per-child view had no fallback: `useGradesForStudent(
 *     undefined)` → `enabled: false` → "Aucune note pour cette période"
 *     even with entered grades — the exact owner-reported symptom
 *     ("exam grades are recorded in the system but the website is not
 *     displaying them").
 *
 * Fix: the AppShell owns the auto-selection ONCE (fixes every per-child
 * view for the 1-child case AND resets a stale persisted id after an
 * account re-binding). The duplicated switcher effects are removed.
 *
 * These tests pin:
 *   1. BEHAVIORAL — rendering the AppShell sets activeStudentId to the
 *      first child when null (1 child AND multiple children).
 *   2. BEHAVIORAL — a STALE persisted id (no longer among this parent's
 *      children, e.g. after an account re-binding) resets to kids[0].
 *   3. BEHAVIORAL — a VALID persisted id is left untouched.
 *   4. BEHAVIORAL — no children → activeStudentId stays null.
 *   5. SOURCE — the shell owns the effect; the switchers no longer
 *      auto-select (one derivation, not three).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

import { useAppStore } from "@/lib/store/app-store";
import type { StudentRow } from "@/lib/types/database";

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf-8");

// ─── Mocks ──────────────────────────────────────────────────────────────────
// The auth children list is test-controlled via `mockKids`.
let mockKids: StudentRow[] = [];

vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({
    state: "active",
    user: { id: "profile-1", auth_user_id: "auth-1", status: "active" },
    parent: { id: "parent-1" },
    children: mockKids,
    error: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// next/dynamic is stubbed so NO feature view module is imported (they fire
// real queries); the shell's own effect is what's under test.
vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("@/lib/hooks/use-realtime", () => ({
  useChatUnreadRealtime: () => undefined,
}));

vi.mock("@/features/shared/top-app-bar", () => ({ TopAppBar: () => null }));
vi.mock("@/features/shared/bottom-nav", () => ({
  BottomNav: () => null,
  DesktopRail: () => null,
}));
vi.mock("@/features/shared/offline-indicator", () => ({ OfflineIndicator: () => null }));
vi.mock("@/features/shared/sw-update-banner", () => ({ SwUpdateBanner: () => null }));
vi.mock("@/features/shared/pwa-install-prompt", () => ({ PwaInstallPrompt: () => null }));
vi.mock("@/features/shared/state-views", () => ({ ListSkeleton: () => null }));

import { AppShell } from "@/features/shared/app-shell";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const kid = (id: string, first: string): StudentRow =>
  ({
    id,
    tenant_id: "t1",
    student_code: `ELV-2026-${id}`,
    first_name: first,
    last_name: "TEST",
    parent_id: "parent-1",
    class_id: null,
    grade_level_id: null,
    enrollment_status: "active",
    enrollment_date: null,
    date_of_birth: null,
    gender: null,
    medical_notes: null,
    auth_user_id: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    deleted_at: null,
  }) as unknown as StudentRow;

const KID_A = kid("kid-a", "Alpha");
const KID_B = kid("kid-b", "Beta");

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ activeStudentId: null, activeView: "home" });
  mockKids = [];
});

afterEach(() => {
  cleanup();
});

describe("T-336 / GRADE-102 — AppShell owns the active-student auto-selection", () => {
  it("single-child parent: activeStudentId is set to the only child (the bug)", async () => {
    // BEFORE the fix this stayed null forever — the academic view queried
    // useGradesForStudent(undefined) and showed "Aucune note pour cette
    // période" even with entered grades.
    mockKids = [KID_A];
    await act(async () => {
      render(<AppShell />);
    });
    expect(useAppStore.getState().activeStudentId).toBe(KID_A.id);
  });

  it("multi-child parent: the first child is auto-selected", async () => {
    mockKids = [KID_A, KID_B];
    await act(async () => {
      render(<AppShell />);
    });
    expect(useAppStore.getState().activeStudentId).toBe(KID_A.id);
  });

  it("a STALE persisted id (after an account re-binding) resets to kids[0]", async () => {
    // The store persists activeStudentId in localStorage; a parent whose
    // account was re-bound to another family keeps a foreign id on disk.
    useAppStore.setState({ activeStudentId: "foreign-student-id" });
    mockKids = [KID_A, KID_B];
    await act(async () => {
      render(<AppShell />);
    });
    expect(useAppStore.getState().activeStudentId).toBe(KID_A.id);
  });

  it("a VALID persisted id is left untouched (no state churn on remount)", async () => {
    useAppStore.setState({ activeStudentId: KID_B.id });
    mockKids = [KID_A, KID_B];
    await act(async () => {
      render(<AppShell />);
    });
    expect(useAppStore.getState().activeStudentId).toBe(KID_B.id);
  });

  it("no children: activeStudentId stays null (nothing to select)", async () => {
    mockKids = [];
    await act(async () => {
      render(<AppShell />);
    });
    expect(useAppStore.getState().activeStudentId).toBeNull();
  });
});

describe("T-336 / GRADE-102 — one derivation, not three (source scans)", () => {
  const appShell = read("features/shared/app-shell.tsx");
  const switcher = read("features/students/student-switcher.tsx");

  it("the AppShell mounts the canonical auto-selection effect", () => {
    expect(appShell).toContain("useEffect(() => {");
    expect(appShell).toMatch(/if \(!activeStudentId \|\| !kids\.some\(\(k\) => k\.id === activeStudentId\)\)/);
    expect(appShell).toMatch(/setActiveStudentId\(kids\[0\]\.id\)/);
  });

  it("the switcher components no longer auto-select (duplicated effects removed)", () => {
    expect(switcher).not.toContain("setActiveStudentId(kids[0].id)");
    expect(switcher).not.toMatch(/useEffect\(\(\) => \{\s*if \(!activeStudentId/);
    // Explicit selection (clicking a child) is preserved.
    expect(switcher).toContain("onClick={() => setActiveStudentId(kid.id)}");
  });

  it("every per-child view still renders its switcher only for 2+ kids (display concern), while the SHELL guarantees the id", () => {
    // The conditional rendering itself is fine NOW (the id is always set);
    // this pins the coupling so a future refactor cannot silently
    // reintroduce a view-local auto-select dependency.
    for (const view of [
      "features/academic/academic-view.tsx",
      "features/attendance/attendance-view.tsx",
      "features/homework/homework-view.tsx",
      "features/financial/financial-view.tsx",
    ]) {
      const src = read(view);
      expect(src, view).toMatch(/kids\.length > 1 && <StudentSwitcherDropdown/);
    }
  });
});
