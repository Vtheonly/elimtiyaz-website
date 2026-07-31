"use client";

/**
 * AttendanceView — absence and tardiness history for the active student.
 *
 * Per platform matrix: portal = "View Own" (read-only).
 * The portal CANNOT submit justifications — that's a desktop workflow. We
 * only display the justification status (uploaded by staff or pending).
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAppStore } from "@/lib/store/app-store";
import { useAttendanceForStudent } from "@/lib/hooks/portal-queries";
import { useQueryClient } from "@tanstack/react-query";
import { KpiCard } from "@/features/shared/kpi-card";
import {
  StatusPill,
  attendanceStatusTone,
} from "@/features/shared/status-pill";
import {
  EmptyState,
  ListSkeleton,
  ErrorState,
  CardListItem,
} from "@/features/shared/state-views";
import { StudentSwitcherDropdown } from "@/features/students/student-switcher";
import { AbsenceJustificationDialog } from "@/features/attendance/absence-justification-dialog";
import { CheckCircle2, XCircle, Clock, AlertCircle, FileText } from "lucide-react";
import { formatDate, formatFullName } from "@/lib/format";
import { useMemo, useState } from "react";
import type { AttendanceRecordRow } from "@/lib/types/database";

const statusIcons: Record<string, typeof CheckCircle2> = {
  present: CheckCircle2,
  absent_excused: AlertCircle,
  absent_unexcused: XCircle,
  late: Clock,
};

const statusLabels: Record<string, string> = {
  present: "Présent",
  absent_excused: "Absence justifiée",
  absent_unexcused: "Absence non justifiée",
  late: "Retard",
};

export function AttendanceView() {
  const { t } = useT();
  const { children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeKid = kids.find((k) => k.id === activeStudentId);

  const attendance = useAttendanceForStudent(activeKid?.id ?? null, { limit: 200 });
  const qc = useQueryClient();
  const [justifyRecord, setJustifyRecord] = useState<AttendanceRecordRow | null>(null);

  const stats = useMemo(() => {
    if (!attendance.data) return { present: 0, excused: 0, unexcused: 0, late: 0, total: 0, rate: null };
    const out = { present: 0, excused: 0, unexcused: 0, late: 0, total: attendance.data.length, rate: null as number | null };
    for (const a of attendance.data) {
      if (a.status === "present") out.present++;
      else if (a.status === "absent_excused") out.excused++;
      else if (a.status === "absent_unexcused") out.unexcused++;
      else if (a.status === "late") out.late++;
    }
    out.rate = out.total > 0 ? Math.round((out.present / out.total) * 100) : null;
    return out;
  }, [attendance.data]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("attendance.title")}</h1>
        {kids.length > 1 && <StudentSwitcherDropdown />}
      </div>

      {/* KPI grid */}
      {attendance.isLoading ? (
        <ListSkeleton count={2} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label={t("attendance.summary.present")}
            value={stats.present}
            tone="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
            hint={stats.rate !== null ? `${stats.rate}%` : undefined}
          />
          <KpiCard
            label={t("attendance.summary.excused")}
            value={stats.excused}
            tone="warning"
            icon={<AlertCircle className="h-5 w-5" />}
          />
          <KpiCard
            label={t("attendance.summary.unexcused")}
            value={stats.unexcused}
            tone="danger"
            icon={<XCircle className="h-5 w-5" />}
          />
          <KpiCard
            label={t("attendance.summary.late")}
            value={stats.late}
            tone="info"
            icon={<Clock className="h-5 w-5" />}
          />
        </div>
      )}

      {/* History */}
      {activeKid && (
        <p className="text-sm text-muted-foreground">
          {formatFullName(activeKid)}
        </p>
      )}

      {attendance.isLoading ? (
        <ListSkeleton count={6} />
      ) : attendance.isError ? (
        <ErrorState title={t("common.error.title")} onRetry={() => attendance.refetch()} />
      ) : attendance.data && attendance.data.length > 0 ? (
        <div className="space-y-2">
          {attendance.data.map((rec) => {
            const Icon = statusIcons[rec.status] ?? AlertCircle;
            const tone = attendanceStatusTone(rec.status);
            const hasJustification = Boolean(rec.justification_note || rec.justification_path || rec.justification_drive_link);
            const canJustify = rec.status !== "present" && !hasJustification;
            return (
              <div key={rec.id} className="space-y-1">
                <CardListItem
                  leading={
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted/40 ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-destructive" : "text-info"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  }
                  title={`${formatDate(rec.date)} • ${statusLabels[rec.status] ?? rec.status}`}
                  subtitle={rec.justification_note ?? (hasJustification ? t("attendance.justification.uploaded") : rec.status !== "present" ? t("attendance.justification.pending") : undefined)}
                  trailing={
                    rec.status !== "present" && (
                      <StatusPill tone={hasJustification ? "info" : "warning"}>
                        {hasJustification ? t("attendance.justification.uploaded") : t("attendance.justification.pending")}
                      </StatusPill>
                    )
                  }
                />
                {canJustify && (
                  <button
                    onClick={() => setJustifyRecord(rec)}
                    className="ml-13 flex items-center gap-1 px-2 py-1 text-xs text-primary hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    Justifier cette absence
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title={t("attendance.empty")} icon={<CheckCircle2 className="h-6 w-6" />} />
      )}

      <AbsenceJustificationDialog
        record={justifyRecord}
        open={justifyRecord !== null}
        onOpenChange={(v) => !v && setJustifyRecord(null)}
        onSubmitted={() => {
          qc.invalidateQueries({ queryKey: ["attendance", activeKid?.id] });
        }}
      />
    </div>
  );
}
