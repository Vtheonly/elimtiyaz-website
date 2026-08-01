"use client";

/**
 * StudentDocumentsCard — parent-uploaded documents per child.
 *
 * Per the plan §04.07: parents can upload documents (birth certificate,
 * medical certificate, contract, etc.) to the `student_documents` table.
 * The portal uses the `student-documents` Storage bucket + RLS policies
 * (migration 0027) that let a parent read + upload only for their own
 * children.
 *
 * The card lists documents for the currently-active student and lets the
 * parent upload a new one. Deletion is NOT supported from the portal —
 * once a document is uploaded, only staff can remove it (it becomes part
 * of the official record).
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Upload, Loader2, File as FileIcon, Download } from "lucide-react";
import { useT } from "@/lib/i18n/use-t";
import { useAuth } from "@/app/providers/auth-provider";
import { useAppStore } from "@/lib/store/app-store";
import { useStudentDocuments } from "@/lib/hooks/portal-queries";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDate, formatFullName } from "@/lib/format";
import {
  fileUploadSchema,
  ALLOWED_JUSTIFICATION_FILE_TYPES,
  MAX_JUSTIFICATION_FILE_SIZE,
} from "@/lib/validation";
import type { StudentDocumentKind } from "@/lib/types/database";

const DOCUMENT_KINDS: StudentDocumentKind[] = [
  "birth_certificate",
  "medical_certificate",
  "contract",
  "justification_letter",
  "id_photo",
  "report_card",
  "other",
];

export function StudentDocumentsCard() {
  const { t } = useT();
  const { children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeKid = kids.find((k) => k.id === activeStudentId) ?? kids[0] ?? null;

  const documents = useStudentDocuments(activeKid?.id ?? null);
  const [showUpload, setShowUpload] = useState(false);

  const downloadDoc = async (storagePath: string, fileName: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.storage
      .from("student-documents")
      .download(storagePath);
    if (error) {
      toast.error(error.message);
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("documents.title")}
          </span>
          {activeKid && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUpload(true)}
              className="text-xs"
            >
              <Upload className="mr-1 h-3 w-3" />
              {t("documents.upload")}
            </Button>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("documents.body")}</p>
        {activeKid && (
          <p className="text-xs font-medium text-foreground">{formatFullName(activeKid)}</p>
        )}
      </CardHeader>
      <CardContent>
        {!activeKid ? (
          <p className="py-3 text-sm text-muted-foreground">{t("dashboard.empty.noChildren")}</p>
        ) : documents.isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : documents.isError ? (
          <p className="py-3 text-sm text-destructive">{t("common.error.title")}</p>
        ) : documents.data && documents.data.length > 0 ? (
          <div className="space-y-2">
            {documents.data.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                  <FileIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t(`documents.kind.${doc.kind}`)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {doc.file_name} • {t("documents.uploadedAt")} {formatDate(doc.uploaded_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => downloadDoc(doc.storage_path, doc.file_name)}
                  aria-label={t("common.download")}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("documents.empty")}</p>
        )}
      </CardContent>

      {activeKid && (
        <UploadDocumentDialog
          open={showUpload}
          onOpenChange={setShowUpload}
          studentId={activeKid.id}
          studentName={formatFullName(activeKid)}
          onUploaded={() => documents.refetch()}
        />
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function UploadDocumentDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  onUploaded: () => void;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const [kind, setKind] = useState<StudentDocumentKind>("birth_certificate");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setKind("birth_certificate");
    setDescription("");
    setFile(null);
  };

  const handleSubmit = async () => {
    if (!file || !user || !supabase) return;

    // Validate the file with the same Zod schema used for absence justifications.
    const fileParsed = fileUploadSchema.safeParse(file);
    if (!fileParsed.success) {
      toast.error(fileParsed.error.issues[0]?.message ?? "Fichier invalide.");
      return;
    }

    setSaving(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const objectPath = `${studentId}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("student-documents")
        .upload(objectPath, file, { upsert: false });
      if (upErr) {
        toast.error(`Échec de l'envoi du fichier: ${upErr.message}`);
        setSaving(false);
        return;
      }

      const { error: insertErr } = await supabase
        .from("student_documents")
        .insert({
          student_id: studentId,
          kind,
          file_name: file.name,
          storage_path: objectPath,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: user.id,
          description: description.trim() || null,
        });
      if (insertErr) {
        toast.error(insertErr.message);
        setSaving(false);
        return;
      }

      toast.success(t("common.success"));
      reset();
      onOpenChange(false);
      onUploaded();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("documents.upload")}</DialogTitle>
          <DialogDescription>{studentName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("documents.title")}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as StudentDocumentKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`documents.kind.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-file">{t("documents.file")}</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm hover:bg-muted/40">
              <Upload className="h-4 w-4" />
              <span className="flex-1 truncate">
                {file ? file.name : t("documents.file")}
              </span>
              <input
                id="doc-file"
                type="file"
                accept={ALLOWED_JUSTIFICATION_FILE_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > MAX_JUSTIFICATION_FILE_SIZE) {
                    toast.error(
                      `Le fichier dépasse la taille maximale de ${MAX_JUSTIFICATION_FILE_SIZE / 1024 / 1024} Mo.`
                    );
                    return;
                  }
                  setFile(f);
                }}
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                {t("common.delete")}
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-description">{t("documents.description")}</Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !file}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("common.upload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
