"use client";

/**
 * Portal data hooks — TanStack Query wrappers around Supabase queries.
 *
 * All queries inherit Row-Level Security automatically. The parent signing in
 * via Google OAuth will only ever see rows where:
 *   - tenant_id matches their user_profiles.tenant_id, AND
 *   - they are the linked parent (parents.auth_user_id = auth.uid())
 *
 * These hooks MUST NOT introduce new business logic — they are thin readers
 * on top of the already-implemented backend. Aggregates (balance, GPA,
 * attendance rate) are computed exclusively in src/lib/canonical/ so every
 * platform derives identical values from identical rows.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import {
  PaymentRow,
  InstallmentRow,
  InvoiceRow,
  ReceiptRow,
  ServiceEnrollmentRow,
  AttendanceRecordRow,
  HomeworkRow,
  GradeRow,
  AssessmentRow,
  ClassSubjectRow,
  SubjectRow,
  ClassRow,
  AcademicLevelRow,
  NotificationRow,
  CalendarEventRow,
  ChatChannelRow,
  ChatMessageRow,
  ChatMessageReadEntry,
  AccountAdjustmentRow,
  NotificationPreferenceRow,
  NotificationCategory,
  StudentDocumentRow,
  StudentDocumentKind,
  LedgerEntryRow,
} from "@/lib/types/database";

/* -------------------------------------------------------------------------- */
/* Parent + children                                                          */
/* -------------------------------------------------------------------------- */
/* Note: useParent() and useStudents() are intentionally NOT exposed.
 * The parent + children data is loaded once by the AuthProvider (which
 * subscribes to Supabase onAuthStateChange) and shared via React context.
 * Exposing per-component TanStack Query hooks would duplicate the cache
 * and risk drift between the auth state and the query cache. If a future
 * feature needs to re-fetch the parent/children outside of the auth flow,
 * call `refresh()` from useAuth() instead. */

/* -------------------------------------------------------------------------- */
/* Academic context                                                           */
/* -------------------------------------------------------------------------- */

export function useAcademicLevels(): UseQueryResult<AcademicLevelRow[]> {
  return useQuery({
    queryKey: ["academic-levels"],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("academic_levels")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AcademicLevelRow[];
    },
  });
}

export function useClass(classId: string | null | undefined): UseQueryResult<ClassRow | null> {
  return useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      if (!classId || !supabase) return null;
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .maybeSingle();
      if (error) throw error;
      return (data as ClassRow) ?? null;
    },
    enabled: Boolean(classId),
  });
}

/* -------------------------------------------------------------------------- */
/* Grades                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Canonical grade data — reads the `assessments` table (migration 0029
 * shape: one row per student × subject × term × year with devoir1/devoir2/
 * examen + subject_average + coefficient). This is the table the DESKTOP
 * grade-entry flow and the ANDROID sync dispatcher write to, so the portal
 * sees exactly what staff entered. (The legacy `grades` table from 0004 is
 * no longer written by any platform — reading it left the portal's Academic
 * Hub permanently empty.)
 */
export type PortalAssessmentRow = AssessmentRow & {
  subject?: Pick<
    SubjectRow,
    "id" | "name_fr" | "name_en" | "default_coefficient" | "is_extracurricular" | "passing_grade"
  > | null;
};

export function useGradesForStudent(
  studentId: string | null | undefined
): UseQueryResult<PortalAssessmentRow[]> {
  return useQuery({
    queryKey: ["grades", studentId],
    queryFn: async () => {
      if (!studentId || !supabase) return [];
      const { data, error } = await supabase
        .from("assessments")
        .select(
          `*,
            subject:subjects(
              id, name_fr, name_en, default_coefficient, is_extracurricular, passing_grade
            )`
        )
        .eq("student_id", studentId)
        .order("entered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PortalAssessmentRow[];
    },
    enabled: Boolean(studentId),
  });
}

/* -------------------------------------------------------------------------- */
/* Attendance                                                                 */
/* -------------------------------------------------------------------------- */

export function useAttendanceForStudent(
  studentId: string | null | undefined,
  options: { limit?: number } = {}
): UseQueryResult<AttendanceRecordRow[]> {
  return useQuery({
    queryKey: ["attendance", studentId, options.limit],
    queryFn: async () => {
      if (!studentId || !supabase) return [];
      let q = supabase
        .from("attendance_records")
        .select("*")
        .eq("student_id", studentId)
        .order("date", { ascending: false });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AttendanceRecordRow[];
    },
    enabled: Boolean(studentId),
  });
}

/* -------------------------------------------------------------------------- */
/* Homework                                                                   */
/* -------------------------------------------------------------------------- */

export function useHomeworkForClass(
  classId: string | null | undefined,
  options: { limit?: number } = {}
): UseQueryResult<HomeworkRow[]> {
  return useQuery({
    queryKey: ["homework", classId, options.limit],
    queryFn: async () => {
      if (!classId || !supabase) return [];
      // Canonical `homework` table (migration 0029) — written by the desktop
      // homework-push flow and the Android sync dispatcher.
      let q = supabase
        .from("homework")
        .select("*")
        .eq("class_id", classId)
        .order("due_date", { ascending: true });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as HomeworkRow[];
    },
    enabled: Boolean(classId),
  });
}

/* -------------------------------------------------------------------------- */
/* Financial                                                                  */
/* -------------------------------------------------------------------------- */

export function useInstallments(
  parentId: string | null | undefined,
  options: { studentId?: string | null; limit?: number } = {}
): UseQueryResult<InstallmentRow[]> {
  return useQuery({
    queryKey: ["installments", parentId, options.studentId, options.limit],
    queryFn: async () => {
      if (!parentId || !supabase) return [];
      let q = supabase
        .from("installments")
        .select("*")
        .eq("parent_id", parentId)
        .order("due_date", { ascending: true });
      if (options.studentId) q = q.eq("student_id", options.studentId);
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InstallmentRow[];
    },
    enabled: Boolean(parentId),
  });
}

export function usePayments(
  parentId: string | null | undefined,
  options: { studentId?: string | null; limit?: number } = {}
): UseQueryResult<PaymentRow[]> {
  return useQuery({
    queryKey: ["payments", parentId, options.studentId, options.limit],
    queryFn: async () => {
      if (!parentId || !supabase) return [];
      let q = supabase
        .from("payments")
        .select("*")
        .eq("parent_id", parentId)
        .order("collected_at", { ascending: false });
      if (options.studentId) q = q.eq("student_id", options.studentId);
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
    enabled: Boolean(parentId),
  });
}

export function useInvoices(
  parentId: string | null | undefined,
  options: { limit?: number } = {}
): UseQueryResult<InvoiceRow[]> {
  return useQuery({
    queryKey: ["invoices", parentId, options.limit],
    queryFn: async () => {
      if (!parentId || !supabase) return [];
      let q = supabase
        .from("invoices")
        .select("*")
        .eq("parent_id", parentId)
        .order("invoice_date", { ascending: false });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InvoiceRow[];
    },
    enabled: Boolean(parentId),
  });
}

export function useReceiptsForPayment(
  paymentId: string | null | undefined
): UseQueryResult<ReceiptRow | null> {
  return useQuery({
    queryKey: ["receipt", paymentId],
    queryFn: async () => {
      if (!paymentId || !supabase) return null;
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("payment_id", paymentId)
        .maybeSingle();
      if (error) throw error;
      return (data as ReceiptRow) ?? null;
    },
    enabled: Boolean(paymentId),
  });
}

export function useServiceEnrollments(
  studentId: string | null | undefined
): UseQueryResult<ServiceEnrollmentRow[]> {
  return useQuery({
    queryKey: ["service-enrollments", studentId],
    queryFn: async () => {
      if (!studentId || !supabase) return [];
      const { data, error } = await supabase
        .from("service_enrollments")
        .select("*")
        .eq("student_id", studentId)
        .eq("is_active", true)
        .order("service_kind", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ServiceEnrollmentRow[];
    },
    enabled: Boolean(studentId),
  });
}

export function useAccountAdjustments(
  parentId: string | null | undefined,
  options: { limit?: number } = {}
): UseQueryResult<AccountAdjustmentRow[]> {
  return useQuery({
    queryKey: ["adjustments", parentId, options.limit],
    queryFn: async () => {
      if (!parentId || !supabase) return [];
      // `performed_at` is the real column (migration 0007) — the previous
      // `applied_at` ordering caused a PostgREST 400 on every load.
      let q = supabase
        .from("account_adjustments")
        .select("*")
        .eq("parent_id", parentId)
        .order("performed_at", { ascending: false });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AccountAdjustmentRow[];
    },
    enabled: Boolean(parentId),
  });
}

/**
 * Ledger entries for a parent — the canonical source the portal replays to
 * compute balances (INV-1: balances are NEVER stored, always replayed).
 * RLS allows parents to SELECT their own entries (migration 0019).
 */
export function useLedgerEntries(
  parentId: string | null | undefined,
  options: { limit?: number } = {}
): UseQueryResult<LedgerEntryRow[]> {
  return useQuery({
    queryKey: ["ledger-entries", parentId, options.limit],
    queryFn: async () => {
      if (!parentId || !supabase) return [];
      let q = supabase
        .from("ledger_entries")
        .select("*")
        .eq("parent_id", parentId)
        .order("at", { ascending: true });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as LedgerEntryRow[];
    },
    enabled: Boolean(parentId),
  });
}

/* -------------------------------------------------------------------------- */
/* Notifications + Calendar                                                   */
/* -------------------------------------------------------------------------- */

export function useNotifications(
  targetUserId: string | null | undefined,
  options: { limit?: number; unreadOnly?: boolean } = {}
): UseQueryResult<NotificationRow[]> {
  return useQuery({
    queryKey: ["notifications", targetUserId, options.limit, options.unreadOnly],
    queryFn: async () => {
      if (!targetUserId || !supabase) return [];
      // Two delivery paths exist in the backend schema:
      //   1. direct targeting — notifications.target_user_id = the user
      //   2. role broadcasts — target_user_id IS NULL + target_role = the
      //      user's role ('parent' for portal accounts)
      // The old query matched ANY null-target row and missed neither
      // half correctly: parents saw no role broadcasts at all (the
      // query-side half of REALTIME-102). RLS still filters what this
      // session is allowed to read.
      let q = supabase
        .from("notifications")
        .select("*")
        .or(
          `target_user_id.eq.${targetUserId},and(target_user_id.is.null,target_role.eq.parent)`
        )
        .order("triggered_at", { ascending: false });
      if (options.unreadOnly) q = q.eq("is_read", false);
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    enabled: Boolean(targetUserId),
  });
}

export function useUpcomingEvents(
  options: { limit?: number; from?: string } = {}
): UseQueryResult<CalendarEventRow[]> {
  return useQuery({
    queryKey: ["calendar-events", options.limit, options.from],
    queryFn: async () => {
      if (!supabase) return [];
      const from = options.from ?? new Date().toISOString();
      let q = supabase
        .from("calendar_events")
        .select("*")
        .is("is_deleted", false)
        .gte("start_at", from)
        .order("start_at", { ascending: true });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CalendarEventRow[];
    },
  });
}

/** Fetch calendar events in a specific month range (for the month grid view). */
export function useEventsInRange(
  rangeStart: string | null,
  rangeEnd: string | null
): UseQueryResult<CalendarEventRow[]> {
  return useQuery({
    queryKey: ["calendar-events-range", rangeStart, rangeEnd],
    queryFn: async () => {
      if (!rangeStart || !rangeEnd || !supabase) return [];
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .is("is_deleted", false)
        .gte("start_at", rangeStart)
        .lte("start_at", rangeEnd)
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CalendarEventRow[];
    },
    enabled: Boolean(rangeStart && rangeEnd),
  });
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Fetch all chat channels where the current user is a member.
 * The `member_ids` column is a uuid[] — we filter with `.contains()`.
 * RLS also enforces this server-side, so even a buggy filter can't leak data.
 */
export function useChatChannels(
  userProfileId: string | null | undefined
): UseQueryResult<ChatChannelRow[]> {
  return useQuery({
    queryKey: ["chat-channels", userProfileId],
    queryFn: async () => {
      if (!userProfileId || !supabase) return [];
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .contains("member_ids", [userProfileId])
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChatChannelRow[];
    },
    enabled: Boolean(userProfileId),
  });
}

export function useChatMessages(
  channelId: string | null | undefined,
  options: { limit?: number } = {}
): UseQueryResult<ChatMessageRow[]> {
  return useQuery({
    queryKey: ["chat-messages", channelId, options.limit],
    queryFn: async () => {
      if (!channelId || !supabase) return [];
      let q = supabase
        .from("chat_messages")
        .select("*")
        .eq("channel_id", channelId)
        .is("deleted_at", null)
        .order("sent_at", { ascending: true });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ChatMessageRow[];
    },
    enabled: Boolean(channelId),
  });
}

/**
 * Count of unread chat messages across all of the user's channels.
 * A message is unread when its `read_by` jsonb array does NOT contain an
 * entry with `user_id = current_user`.
 *
 * Accuracy note (WEAK-023, T-065): the query fetches the latest 500
 * `chat_messages` rows TOTAL (ordered by `sent_at` desc — NOT "200 per
 * channel" as a stale comment once claimed), relying on RLS to expose only
 * channels the user is a member of. The returned count is therefore a
 * LOWER BOUND: if unread + read volume across all channels exceeds the
 * 500-row window, older unread messages are not counted. An exact count
 * would need a channel-scoped fetch or a server-side counter — deliberately
 * deferred to the chat rework (T-032) while chat has no production writers
 * (CHAT-103 / UNKNOWN-005).
 *
 * The bottom-nav badge uses this instead of the previous (incorrect) count
 * from the `notifications` table.
 */
export function useUnreadChatCount(
  userProfileId: string | null | undefined
): UseQueryResult<number> {
  return useQuery({
    queryKey: ["chat-unread-count", userProfileId],
    queryFn: async () => {
      if (!userProfileId || !supabase) return 0;
      // Latest 500 chat_messages TOTAL (RLS limits this to channels the
      // user is a member of — there is no per-channel split; see the
      // hook's accuracy note). Counted client-side: unread = authored by
      // someone else AND no read_by entry for this user.
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, author_id, read_by, channel_id")
        .is("deleted_at", null)
        .order("sent_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<{
        id: string;
        author_id: string;
        read_by: ChatMessageReadEntry[] | null;
      }>;
      // Only count messages authored by someone OTHER than this user.
      const unread = rows.filter((r) => {
        if (r.author_id === userProfileId) return false;
        const reads = Array.isArray(r.read_by) ? r.read_by : [];
        return !reads.some((entry) => entry.user_id === userProfileId);
      });
      return unread.length;
    },
    enabled: Boolean(userProfileId),
    // Refetch on window focus so the badge updates when the user returns.
    refetchOnWindowFocus: true,
  });
}

/* -------------------------------------------------------------------------- */
/* Notification preferences                                                    */
/* -------------------------------------------------------------------------- */

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "payment",
  "absence",
  "message",
  "announcement",
  "grade",
  "homework",
  "calendar",
  "account",
  "system",
];

/**
 * Fetch the user's per-category notification preferences.
 * Missing rows are treated as "both push and in-app enabled" (default opt-in).
 * The hook returns a complete map keyed by category so callers don't need
 * to handle missing rows themselves.
 */
export function useNotificationPreferences(
  userProfileId: string | null | undefined
): UseQueryResult<Map<NotificationCategory, NotificationPreferenceRow>> {
  return useQuery({
    queryKey: ["notification-preferences", userProfileId],
    queryFn: async () => {
      const map = new Map<NotificationCategory, NotificationPreferenceRow>();
      if (!userProfileId || !supabase) return map;
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_profile_id", userProfileId);
      if (error) throw error;
      for (const row of (data ?? []) as NotificationPreferenceRow[]) {
        map.set(row.category, row);
      }
      return map;
    },
    enabled: Boolean(userProfileId),
  });
}

/* -------------------------------------------------------------------------- */
/* Student documents                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Fetch all documents uploaded for a given student.
 * RLS limits this to the parent's own children (migration 0027).
 */
export function useStudentDocuments(
  studentId: string | null | undefined
): UseQueryResult<StudentDocumentRow[]> {
  return useQuery({
    queryKey: ["student-documents", studentId],
    queryFn: async () => {
      if (!studentId || !supabase) return [];
      const { data, error } = await supabase
        .from("student_documents")
        .select("*")
        .eq("student_id", studentId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StudentDocumentRow[];
    },
    enabled: Boolean(studentId),
  });
}

/**
 * Fetch all documents for all of the parent's children, merged.
 * Useful for a "family documents" overview.
 */
export function useAllStudentDocuments(
  studentIds: string[]
): UseQueryResult<StudentDocumentRow[]> {
  return useQuery({
    queryKey: ["student-documents-all", studentIds],
    queryFn: async () => {
      if (studentIds.length === 0 || !supabase) return [];
      const { data, error } = await supabase
        .from("student_documents")
        .select("*")
        .in("student_id", studentIds)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StudentDocumentRow[];
    },
    enabled: studentIds.length > 0,
  });
}

/* -------------------------------------------------------------------------- */
/* Receipts (parent-scoped, both kinds)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Fetch all receipts (recent_payment + account_statement) for the parent.
 * Used by the financial view to surface downloadable PDFs.
 */
export function useReceipts(
  parentId: string | null | undefined,
  options: { limit?: number; kind?: "recent_payment" | "account_statement" } = {}
): UseQueryResult<ReceiptRow[]> {
  return useQuery({
    queryKey: ["receipts", parentId, options.limit, options.kind],
    queryFn: async () => {
      if (!parentId || !supabase) return [];
      let q = supabase
        .from("receipts")
        .select("*")
        .eq("parent_id", parentId)
        .order("generated_at", { ascending: false });
      if (options.kind) q = q.eq("receipt_kind", options.kind);
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ReceiptRow[];
    },
    enabled: Boolean(parentId),
  });
}
