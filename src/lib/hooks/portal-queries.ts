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
 * on top of the already-implemented backend.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type {
  ParentRow,
  StudentRow,
  PaymentRow,
  InstallmentRow,
  InvoiceRow,
  ReceiptRow,
  ServiceEnrollmentRow,
  AttendanceRecordRow,
  HomeworkAssignmentRow,
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
  AccountAdjustmentRow,
} from "@/lib/types/database";

/* -------------------------------------------------------------------------- */
/* Parent + children                                                          */
/* -------------------------------------------------------------------------- */

export function useParent(parentId: string | null | undefined): UseQueryResult<ParentRow | null> {
  return useQuery({
    queryKey: ["parent", parentId],
    queryFn: async () => {
      if (!parentId || !supabase) return null;
      const { data, error } = await supabase
        .from("parents")
        .select("*")
        .eq("id", parentId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return (data as ParentRow) ?? null;
    },
    enabled: Boolean(parentId),
  });
}

export function useStudents(parentId: string | null | undefined): UseQueryResult<StudentRow[]> {
  return useQuery({
    queryKey: ["students", parentId],
    queryFn: async () => {
      if (!parentId || !supabase) return [];
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("parent_id", parentId)
        .is("deleted_at", null)
        .order("first_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StudentRow[];
    },
    enabled: Boolean(parentId),
  });
}

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

export function useGradesForStudent(
  studentId: string | null | undefined
): UseQueryResult<
  (GradeRow & {
    assessment?: AssessmentRow | null;
    class_subject?: (ClassSubjectRow & { subject?: SubjectRow | null }) | null;
  })[]
> {
  return useQuery({
    queryKey: ["grades", studentId],
    queryFn: async () => {
      if (!studentId || !supabase) return [];
      const { data, error } = await supabase
        .from("grades")
        .select(
          `*,
            assessment:assessments(*,
              class_subject:class_subjects(*,
                subject:subjects(*)
              )
            )`
        )
        .eq("student_id", studentId)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (GradeRow & {
        assessment?: AssessmentRow | null;
        class_subject?: (ClassSubjectRow & { subject?: SubjectRow | null }) | null;
      })[];
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
): UseQueryResult<HomeworkAssignmentRow[]> {
  return useQuery({
    queryKey: ["homework", classId, options.limit],
    queryFn: async () => {
      if (!classId || !supabase) return [];
      let q = supabase
        .from("homework_assignments")
        .select("*")
        .eq("target_class_id", classId)
        .order("due_date", { ascending: true });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as HomeworkAssignmentRow[];
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
      let q = supabase
        .from("account_adjustments")
        .select("*")
        .eq("parent_id", parentId)
        .order("applied_at", { ascending: false });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AccountAdjustmentRow[];
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
      let q = supabase
        .from("notifications")
        .select("*")
        .eq("target_user_id", targetUserId)
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
        .gte("start_at", from)
        .order("start_at", { ascending: true });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CalendarEventRow[];
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

export function useChatChannels(
  parentId: string | null | undefined
): UseQueryResult<ChatChannelRow[]> {
  return useQuery({
    queryKey: ["chat-channels", parentId],
    queryFn: async () => {
      if (!parentId || !supabase) return [];
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("parent_id", parentId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChatChannelRow[];
    },
    enabled: Boolean(parentId),
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
        .order("created_at", { ascending: true });
      if (options.limit) q = q.limit(options.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ChatMessageRow[];
    },
    enabled: Boolean(channelId),
  });
}
