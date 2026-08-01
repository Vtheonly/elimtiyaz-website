"use client";

/**
 * HomeworkView — assignments for the active student's class.
 *
 * Per platform matrix: portal = "View Tasks" (read-only).
 * Teachers push homework from Desktop/Mobile; parents/students just see them.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import { useAppStore } from "@/lib/store/app-store";
import { useHomeworkForClass } from "@/lib/hooks/portal-queries";
import { useHomeworkRealtime } from "@/lib/hooks/use-realtime";
import {
  StatusPill,
} from "@/features/shared/status-pill";
import {
  EmptyState,
  ListSkeleton,
  ErrorState,
} from "@/features/shared/state-views";
import { StudentSwitcherDropdown } from "@/features/students/student-switcher";
import { BookOpen, Clock, Lock, Paperclip } from "lucide-react";
import { formatDate, daysUntil, formatFullName } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { HomeworkAssignmentRow } from "@/lib/types/database";

export function HomeworkView() {
  const { t } = useT();
  const { children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeKid = kids.find((k) => k.id === activeStudentId);

  const homework = useHomeworkForClass(activeKid?.class_id ?? null, { limit: 50 });

  // Realtime: new homework pushed by teachers appears instantly.
  useHomeworkRealtime(activeKid?.class_id ?? null);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("homework.title")}</h1>
        {kids.length > 1 && <StudentSwitcherDropdown />}
      </div>

      {activeKid && (
        <p className="text-sm text-muted-foreground">{formatFullName(activeKid)}</p>
      )}

      {homework.isLoading ? (
        <ListSkeleton count={4} />
      ) : homework.isError ? (
        <ErrorState title={t("common.error.title")} onRetry={() => homework.refetch()} />
      ) : homework.data && homework.data.length > 0 ? (
        <div className="space-y-2">
          {homework.data.map((hw) => (
            <HomeworkItem key={hw.id} hw={hw} />
          ))}
        </div>
      ) : (
        <EmptyState title={t("homework.empty")} icon={<BookOpen className="h-6 w-6" />} />
      )}
    </div>
  );
}

function HomeworkItem({ hw }: { hw: HomeworkAssignmentRow }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const days = daysUntil(hw.due_date);
  // is_locked is computed at query time per the schema (due_date < today).
  const isLocked = new Date(hw.due_date) < new Date(new Date().toDateString());

  let tone: "success" | "warning" | "danger" | "info" | "muted" = "info";
  let label = formatDate(hw.due_date);
  if (isLocked) {
    tone = "muted";
    label = t("homework.locked");
  } else if (days < 0) {
    tone = "danger";
    label = `${Math.abs(days)}j ${t("homework.overdue").toLowerCase()}`;
  } else if (days === 0) {
    tone = "warning";
    label = t("homework.dueToday");
  } else if (days === 1) {
    tone = "warning";
    label = t("homework.dueTomorrow");
  } else if (days <= 7) {
    tone = "warning";
    label = `J-${days}`;
  }

  const openAttachment = async (path: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.storage
      .from("homework-attachments")
      .createSignedUrl(path, 300);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <>
      <Card
        className="cursor-pointer border-border/50 bg-card card-hover"
        onClick={() => setOpen(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isLocked ? <Lock className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{hw.title}</p>
                <StatusPill tone={tone}>{label}</StatusPill>
              </div>
              {hw.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {hw.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t("homework.due")}: {formatDate(hw.due_date)}
                </span>
                {hw.attachment_path && (
                  <span className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    1
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
              {hw.title}
            </DialogTitle>
            <DialogDescription>
              {t("homework.due")}: {formatDate(hw.due_date)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {hw.description && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                {hw.description}
              </div>
            )}

            {hw.attachment_path && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("homework.attachments")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => openAttachment(hw.attachment_path!)}
                >
                  <Paperclip className="mr-2 h-3.5 w-3.5" />
                  {hw.attachment_path.split("/").pop() ?? "Attachment"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
