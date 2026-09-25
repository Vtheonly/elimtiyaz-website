/**
 * T-413 — the website's student-application legs.
 *
 * Covers:
 *   1. The auth-provider's STUDENT-BOUND resolution (STUDENT-103): an
 *      active user with NO parent row but a bound students.auth_user_id
 *      resolves their OWN student record as the (self-scoped) child + the
 *      family row via parents_student_sees_own — NOT the endless
 *      "pending" wall.
 *   2. The StudentApplicationForm (STUDENT-102): it reads the user's OWN
 *      pending request (the 0116 own-pending SELECT policy), saves the
 *      payload through the RLS-guarded self-update, and treats the
 *      zero-row "successful" update as the error it is (the RLS-500
 *      silent-no-op lesson).
 *   3. The tri-lingual dictionary contract (T-385): every application.*
 *      key exists in fr + ar + en.
 *   4. The deep identity contract: the payload shape matches migration
 *      0116's student_application column (the desktop's pre-fill source).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ */
/* Shared Supabase mock factory                                        */
/* ------------------------------------------------------------------ */

type FromCall = { table: string; ops: unknown[] };

function makeSupabaseMock(handlers: {
  user_profiles?: (call: FromCall) => { data: unknown; error: unknown };
  parents?: (call: FromCall) => { data: unknown; error: unknown };
  students?: (call: FromCall) => { data: unknown; error: unknown };
}) {
  const calls: FromCall[] = [];
  const chain = (table: string) => {
    const ops: unknown[] = [];
    const proxy: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then" || prop === "catch") return undefined;
          if (prop === "maybeSingle" || prop === "single") {
            return () => {
              ops.push({ op: prop });
              const call = { table, ops };
              const h = handlers[table as keyof typeof handlers];
              return Promise.resolve(
                h ? h(call) : { data: null, error: null },
              );
            };
          }
          return (...args: unknown[]) => {
            ops.push({ op: prop, args });
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  return {
    calls,
    from: (table: string) => {
      calls.push({ table, ops: [] });
      return chain(table);
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "auth-student-1" } } }, error: null }),
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "auth-student-1" } }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  };
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

let supabaseMock: ReturnType<typeof makeSupabaseMock>;

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  get supabase() {
    return supabaseMock;
  },
}));

import { AuthProvider, useAuth as useAuthMocked } from "@/app/providers/auth-provider";

/** The REAL hook (bypassing this file's useAuth stub for the form tests). */
const { useAuth: useRealAuth } = await vi.importActual<
  typeof import("@/app/providers/auth-provider")
>("@/app/providers/auth-provider");

function renderAuth() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  return renderHook(() => useRealAuth(), { wrapper });
}
void useAuthMocked;

const activeProfile = {
  id: "profile-1",
  auth_user_id: "auth-student-1",
  email: "student@example.dz",
  status: "active",
  display_name: "Test Student",
  avatar_url: null,
  phone: null,
  tenant_id: "tenant-1",
  locale: "fr",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

/* ------------------------------------------------------------------ */
/* 1. The student-bound resolution                                     */
/* ------------------------------------------------------------------ */

describe("T-413 — the student-bound portal resolution (STUDENT-103)", () => {
  it("an active user with NO parent row but a bound student resolves SELF + family (state active)", async () => {
    supabaseMock = makeSupabaseMock({
      user_profiles: () => ({ data: activeProfile, error: null }),
      parents: () => ({ data: null, error: null }), // no parent row at first
      students: (call) => {
        // First students query = the self lookup (auth_user_id eq).
        const isSelfLookup = call.ops.some(
          (o) => (o as { op: string; args?: unknown[] }).op === "eq" &&
            (o as { args?: unknown[] }).args?.[0] === "auth_user_id",
        );
        if (isSelfLookup) {
          return {
            data: {
              id: "stu-1",
              student_code: "ELV-2026-000001",
              auth_user_id: "auth-student-1",
              parent_id: "par-1",
              first_name: "Self",
              last_name: "Student",
              deleted_at: null,
            },
            error: null,
          };
        }
        return { data: [], error: null };
      },
    });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.state).toBe("active"));
    // The student's own row is the (self-scoped) child list entry.
    expect(result.current.children).toHaveLength(1);
    expect(result.current.children[0]?.student_code).toBe("ELV-2026-000001");
  });
});

describe("T-413 — the full student resolution chain (profile → no parent → self student)", () => {
  it("resolves the student's own row as the child + the family row, ending active", async () => {
    const parentsResults: Record<string, { data: unknown; error: unknown }> = {};
    supabaseMock = makeSupabaseMock({
      user_profiles: () => ({ data: activeProfile, error: null }),
      parents: (call) => {
        // Two distinct parent queries: (1) auth_user_id lookup → null;
        // (2) id = parent_id lookup → the family row.
        const byAuth = call.ops.some(
          (o) => (o as { op: string; args?: unknown[] }).op === "eq" &&
            (o as { args?: unknown[] }).args?.[0] === "auth_user_id",
        );
        if (byAuth) return { data: null, error: null };
        return {
          data: {
            id: "par-1",
            parent_code: "PAR-2026-XXXX",
            first_name: "Fam",
            last_name: "Ily",
            auth_user_id: null,
            deleted_at: null,
          },
          error: null,
        };
      },
      students: (call) => {
        const isSelf = call.ops.some(
          (o) => (o as { op: string; args?: unknown[] }).op === "eq" &&
            (o as { args?: unknown[] }).args?.[0] === "auth_user_id",
        );
        if (isSelf) {
          return {
            data: {
              id: "stu-1",
              student_code: "ELV-2026-000001",
              auth_user_id: "auth-student-1",
              parent_id: "par-1",
              first_name: "Self",
              last_name: "Student",
              deleted_at: null,
            },
            error: null,
          };
        }
        return { data: [], error: null };
      },
    });
    void parentsResults;

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.state).toBe("active"));
    expect(result.current.children).toHaveLength(1);
    expect(result.current.children[0]?.student_code).toBe("ELV-2026-000001");
    expect(result.current.parent?.parent_code).toBe("PAR-2026-XXXX");
  });
});

/* ------------------------------------------------------------------ */
/* 2. The StudentApplicationForm                                       */
/* ------------------------------------------------------------------ */

import { StudentApplicationForm } from "@/features/auth/student-application-form";

function renderApp() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  return render(<StudentApplicationForm />, { wrapper });
}

/**
 * The auth-provider mock: `useAuth` returns a CONTROLLABLE stub — the
 * StudentApplicationForm tests set it to the pending user; the resolution
 * tests use the REAL provider (renderAuth uses the real AuthProvider whose
 * internal state flows through the real hook — the stub's state value is
 * irrelevant there because renderAuth's consumer IS the mocked useAuth…
 * no: to keep BOTH worlds in one file, the resolution tests assert on the
 * stub's OUTPUT which the real AuthProvider sets via the test harness is
 * impossible — so instead the resolution tests re-import the provider's
 * module fresh. Simplest correct split: the stub defaults to the pending
 * user; the resolution tests use the REAL hook (unmocked path below).
 */
let authStub: {
  state: string;
  user: unknown;
  parent: unknown;
  children: unknown[];
  error: unknown;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
} = {
  state: "pending",
  user: activeProfile,
  parent: null,
  children: [],
  error: null,
  configured: true,
  signInWithGoogle: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  refresh: () => Promise.resolve(),
};

vi.mock("@/app/providers/auth-provider", async () => {
  const actual = await vi.importActual("@/app/providers/auth-provider");
  return {
    ...actual,
    useAuth: () => authStub,
  };
});

describe("T-413 — the StudentApplicationForm (STUDENT-102)", () => {
  it("renders the form for a pending user with a visible pending request", async () => {
    supabaseMock = makeSupabaseMock({
      parents: () => ({ data: null, error: null }),
      students: () => ({ data: null, error: null }),
    });
    // The account_approval_requests read + update go through the same
    // .from() chain — add a dedicated handler.
    supabaseMock.from = ((table: string) => {
      if (table === "account_approval_requests") {
        const proxy: Record<string, unknown> = new Proxy({}, {
          get(_t, prop) {
            if (prop === "then" || prop === "catch") return undefined;
            if (prop === "maybeSingle" || prop === "single") {
              return () =>
                Promise.resolve({
                  data: {
                    id: "req-1",
                    student_application: null,
                  },
                  error: null,
                });
            }
            return (..._args: unknown[]) => proxy;
          },
        });
        return proxy;
      }
      return (supabaseMock as unknown as { __from: (t: string) => unknown }).__from?.(table) ?? (() => null);
    }) as typeof supabaseMock.from;
    // keep a reference to the original from
    (supabaseMock as unknown as { __from: typeof supabaseMock.from }).__from =
      makeSupabaseMock({ parents: () => ({ data: null, error: null }), students: () => ({ data: null, error: null }) }).from;

    renderApp();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2 })).toBeTruthy(),
    );
  });
});

/* ------------------------------------------------------------------ */
/* 3 + 4. The dictionary + payload contracts (source scans)            */
/* ------------------------------------------------------------------ */

const DICT = readFileSync(
  join(__dirname, "../../lib/i18n/dictionary.ts"),
  "utf8",
);
const FORM = readFileSync(
  join(__dirname, "../../features/auth/student-application-form.tsx"),
  "utf8",
);
const AUTH_PROVIDER = readFileSync(
  join(__dirname, "../../app/providers/auth-provider.tsx"),
  "utf8",
);
const TYPES = readFileSync(
  join(__dirname, "../../lib/types/database.ts"),
  "utf8",
);

const APPLICATION_KEYS = [
  "application.title",
  "application.subtitle",
  "application.student.firstName",
  "application.student.lastName",
  "application.student.dob",
  "application.student.gender",
  "application.student.male",
  "application.student.female",
  "application.student.level",
  "application.note",
  "application.notePlaceholder",
  "application.submit",
  "application.saving",
  "application.saved.title",
  "application.saved.body",
  "application.edit",
  "application.error.required",
  "application.error.notSaved",
];

describe("T-413 — the tri-lingual dictionary contract (T-385)", () => {
  it("every application.* key exists in ALL THREE locales", () => {
    const localeSections = DICT.split("const ");
    for (const key of APPLICATION_KEYS) {
      const occurrences = localeSections.filter((s) =>
        s.includes(`"${key}"`),
      ).length;
      expect(occurrences, `${key} must appear in fr + ar + en`).toBe(3);
    }
  });
});

describe("T-413 — the payload + policy contract (migration 0116 alignment)", () => {
  it("the form saves ONLY the student_application column (the column-guard contract)", () => {
    expect(FORM).toMatch(
      /\.update\(\{ student_application: payload \}\)/,
    );
    expect(FORM).toContain('.eq("status", "pending")');
    expect(FORM).toContain('.eq("auth_user_id", user.auth_user_id)');
  });

  it("the zero-row 'success' is treated as an error (the RLS-500 lesson)", () => {
    expect(FORM).toMatch(/if \(!updated\) \{/);
    expect(FORM).toContain("application.error.notSaved");
  });

  it("the pending screen mounts the form (only the pending variant)", () => {
    const pending = readFileSync(
      join(__dirname, "../../features/auth/pending-activation-screen.tsx"),
      "utf8",
    );
    expect(pending).toContain('{variant === "pending" && <StudentApplicationForm />}');
  });

  it("the auth-provider resolves the student-bound chain (self student + own parent)", () => {
    expect(AUTH_PROVIDER).toMatch(
      /\.eq\("auth_user_id", authUser\.id\)[\s\S]{0,120}\.is\("deleted_at", null\)/,
    );
    expect(AUTH_PROVIDER).toContain("T-413 (STUDENT-103)");
    // The self-scoped children: the student themselves, never the siblings.
    expect(AUTH_PROVIDER).toMatch(/setChildrenList\(\[selfStudent as StudentRow\]\)/);
  });

  it("the typed row carries the payload (the 0116 column)", () => {
    expect(TYPES).toContain(
      "student_application: StudentApplicationPayload | null;",
    );
    expect(TYPES).toContain("export type StudentApplicationPayload");
  });
});
