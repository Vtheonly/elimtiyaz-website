/**
 * ============================================================================
 * TEMPORARY MOCK AUTHENTICATION — DEVELOPMENT & TESTING ONLY
 * ============================================================================
 *
 * ⚠️  WARNING: This module is a TEMPORARY mock authentication system
 *     intended ONLY for development and testing. It must NEVER be used
 *     in production.
 *
 * Purpose:
 *   - Allows developers to log in as a mock administrator without Google
 *     Sign-In or a configured Supabase backend.
 *   - Bypasses all external authentication providers (Google OAuth, Supabase
 *     Auth).
 *   - Grants full administrator permissions so every feature can be tested.
 *
 * Removal:
 *   - This entire file (`src/lib/auth/mock-auth.ts`) can be deleted once
 *     production authentication (Google via Supabase) is implemented.
 *   - Search for `MOCK_AUTH` / `mock-auth` / `signInWithMock` across the
 *     codebase to find all integration points and remove them.
 *
 * Feature Flag:
 *   - Controlled by `NEXT_PUBLIC_MOCK_AUTH_ENABLED` env var.
 *   - When set to `"true"`, the login screen shows a "Mock Admin Login"
 *     button and the AuthProvider checks for a mock session on mount.
 *   - When unset or `"false"`, this module is completely inert.
 *
 * Session Persistence:
 *   - The mock session is stored in localStorage under `mock-auth-session`
 *     so it survives page reloads during development.
 * ============================================================================
 */

import type { ParentRow, StudentRow, UserProfileRow } from "@/lib/types/database";

/** localStorage key for the mock session. */
export const MOCK_SESSION_KEY = "mock-auth-session";

/** Marker that identifies a user profile as the mock admin. */
export const MOCK_AUTH_USER_ID = "mock-admin-user-id";

/**
 * The mock administrator's user profile.
 * Status is "active" so the auth state machine transitions to the dashboard.
 * The `auth_user_id` is a sentinel value so we can detect mock sessions.
 */
export const MOCK_ADMIN_PROFILE: UserProfileRow = {
  id: "mock-admin-profile-id",
  auth_user_id: MOCK_AUTH_USER_ID,
  tenant_id: "mock-tenant-id",
  email: "admin@mock.elimtiyaz.test",
  display_name: "Mock Administrator",
  avatar_url: null,
  phone: "+213 000 000 000",
  locale: "fr",
  status: "active",
  approval_request_id: null,
  last_login_at: null,
  last_login_ip: null,
  last_user_agent: null,
  password_changed_at: null,
  failed_login_count: 0,
  locked_until: null,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

/**
 * The mock administrator's parent record.
 * This is populated so the dashboard and financial views have data to render.
 */
export const MOCK_ADMIN_PARENT: ParentRow = {
  id: "mock-admin-parent-id",
  tenant_id: "mock-tenant-id",
  parent_code: "MOCK-001",
  first_name: "Mock",
  last_name: "Administrator",
  primary_phone: "+213 000 000 000",
  secondary_phone: null,
  email: "admin@mock.elimtiyaz.test",
  national_id: null,
  occupation: "Administrator (Mock)",
  address: "123 Mock Street",
  city: "Mock City",
  postal_code: "00000",
  relationship: "guardian",
  notes: "This is a temporary mock administrator account for testing.",
  is_active: true,
  is_financially_restricted: false,
  auth_user_id: MOCK_AUTH_USER_ID,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  deleted_at: null,
};

/**
 * Mock student records (children linked to the mock parent).
 * Two students so the student switcher can be tested.
 */
export const MOCK_ADMIN_STUDENTS: StudentRow[] = [
  {
    id: "mock-student-1-id",
    tenant_id: "mock-tenant-id",
    parent_id: "mock-admin-parent-id",
    student_code: "MOCK-STU-001",
    first_name: "Mock",
    middle_name: null,
    last_name: "Student One",
    date_of_birth: "2015-03-15",
    gender: "male",
    grade_level_id: null,
    class_id: null,
    enrollment_date: "2024-09-01",
    enrollment_status: "active",
    medical_notes: null,
    is_active: true,
    auth_user_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "mock-student-2-id",
    tenant_id: "mock-tenant-id",
    parent_id: "mock-admin-parent-id",
    student_code: "MOCK-STU-002",
    first_name: "Mock",
    middle_name: null,
    last_name: "Student Two",
    date_of_birth: "2017-09-22",
    gender: "female",
    grade_level_id: null,
    class_id: null,
    enrollment_date: "2024-09-01",
    enrollment_status: "active",
    medical_notes: null,
    is_active: true,
    auth_user_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
];

/**
 * Full administrator permissions granted to the mock account.
 * In the real system, permissions are checked via the `has_permission`
 * Postgres function. For the mock, we grant a wildcard set so every
 * feature-gated UI element is visible.
 */
export const MOCK_ADMIN_PERMISSIONS = [
  // Financial
  "finance.view",
  "finance.payments.view",
  "finance.payments.create",
  "finance.payments.refund",
  "finance.invoices.view",
  "finance.invoices.create",
  "finance.adjustments.view",
  "finance.adjustments.create",
  "finance.receipts.view",
  "finance.receipts.generate",
  // Academic
  "academic.view",
  "academic.grades.view",
  "academic.grades.create",
  "academic.grades.edit",
  "academic.bulletins.view",
  "academic.bulletins.generate",
  // Attendance
  "attendance.view",
  "attendance.create",
  "attendance.edit",
  "attendance.justification.review",
  // Homework
  "homework.view",
  "homework.create",
  "homework.edit",
  "homework.delete",
  // Calendar
  "calendar.view",
  "calendar.create",
  "calendar.edit",
  "calendar.delete",
  // Messages
  "messages.view",
  "messages.send",
  "messages.delete",
  // Notifications
  "notifications.view",
  "notifications.manage",
  "notifications.send",
  // Profile & settings
  "profile.view",
  "profile.edit",
  "profile.documents.upload",
  "profile.documents.delete",
  // Admin
  "admin.access",
  "admin.users.view",
  "admin.users.manage",
  "admin.roles.manage",
  "admin.audit.view",
  "admin.settings.manage",
] as const;

/**
 * Administrator roles assigned to the mock account.
 */
export const MOCK_ADMIN_ROLES = ["admin", "super_admin"] as const;

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export interface MockSession {
  user: UserProfileRow;
  parent: ParentRow;
  children: StudentRow[];
  roles: string[];
  permissions: string[];
  signedInAt: string;
}

/**
 * Persist the mock session to localStorage.
 */
export function saveMockSession(): MockSession {
  if (typeof window === "undefined") {
    throw new Error("[mock-auth] saveMockSession called on the server");
  }

  const session: MockSession = {
    user: MOCK_ADMIN_PROFILE,
    parent: MOCK_ADMIN_PARENT,
    children: MOCK_ADMIN_STUDENTS,
    roles: [...MOCK_ADMIN_ROLES],
    permissions: [...MOCK_ADMIN_PERMISSIONS],
    signedInAt: new Date().toISOString(),
  };

  localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session));
  return session;
}

/**
 * Read the mock session from localStorage.
 * Returns null if no session exists or if parsing fails.
 */
export function getMockSession(): MockSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(MOCK_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MockSession;
  } catch {
    return null;
  }
}

/**
 * Remove the mock session from localStorage.
 */
export function clearMockSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MOCK_SESSION_KEY);
}

/**
 * Check whether a given auth_user_id belongs to the mock admin.
 * Used by the AuthProvider to distinguish mock sessions from real Supabase
 * sessions.
 */
export function isMockUser(authUserId: string | null | undefined): boolean {
  return authUserId === MOCK_AUTH_USER_ID;
}