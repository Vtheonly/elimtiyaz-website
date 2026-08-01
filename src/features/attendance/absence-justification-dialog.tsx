"use client";

/**
 * AbsenceJustificationDialog — lets a parent submit a justification for an
 * absence or lateness.
 *
 * Per the Client Web Portal plan:
 *   "Absence Justification — Notes, Uploads, Drive Links"
 *
 * The parent provides:
 *   1. A free-text justification note
 *   2. (Optional) A file upload (medical certificate, etc.) → Supabase Storage
 *   3. (Optional) A Google Drive link to a scanned document
 *
 * The justification is written to `attendance_records.justification_note`,
 * `justification_path`, and `justification_drive_link`. The record itself is
 * NOT created by the parent — only the justification fields are updated on an
 * existing absence record. This respects the platform matrix: parents can
 * justify absences but cannot create or delete attendance records.
 *
 * The status is NOT changed by the parent — staff review the justification
 * and may flip `absent_unexcused` → `absent_excused` from the desktop app.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Link as LinkIcon, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  absenceJustificationSchema,
  fileUploadSchema,
  ALLOWED_JUSTIFICATION_FILE_TYPES,
  MAX_JUSTIFICATION_FILE_SIZE,
} from "@/lib/validation";
import type { AttendanceRecordRow } from "@/lib/types/database";

interface Props {
  record: AttendanceRecordRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function AbsenceJustificationDialog({
  record,
  open,
  onOpenChange,
  onSubmitted,
}: Props) {
  const [note, setNote] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setNote("");
    setDriveLink("");
    setFile(null);
  };

  const handleSubmit = async () => {
    if (!record || !supabase) return;

    // Validate the form payload with Zod.
    const parsed = absenceJustificationSchema.safeParse({
      note: note.trim(),
      driveLink: driveLink.trim(),
      hasFile: Boolean(file),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Validation error.");
      return;
    }

    // Validate the file separately if provided.
    if (file) {
      const fileParsed = fileUploadSchema.safeParse(file);
      if (!fileParsed.success) {
        toast.error(fileParsed.error.issues[0]?.message ?? "Fichier invalide.");
        return;
      }
    }

    setSaving(true);

    let path: string | null = null;

    // Upload the file to Supabase Storage if provided.
    if (file) {
      const ext = file.name.split(".").pop() ?? "bin";
      const objectPath = `${record.tenant_id}/${record.student_id}/justifications/${record.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("attendance-justifications")
        .upload(objectPath, file, { upsert: true });
      if (upErr) {
        toast.error(`Échec de l'envoi du fichier: ${upErr.message}`);
        setSaving(false);
        return;
      }
      path = objectPath;
    }

    // Update the attendance record with the justification fields.
    // The BEFORE UPDATE trigger (migration 0027) will auto-flip
    // justification_status from 'none' to 'submitted' the first time
    // a parent submits, but we also set it explicitly here so the
    // status is correct even if the trigger hasn't been applied yet.
    const { error } = await supabase
      .from("attendance_records")
      .update({
        justification_note: note.trim() || null,
        justification_path: path,
        justification_drive_link: driveLink.trim() || null,
        justification_status: "submitted",
      })
      .eq("id", record.id);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    toast.success("Justification envoyée. L'administration va l'examiner.");
    reset();
    onOpenChange(false);
    onSubmitted?.();
    setSaving(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Justifier une absence</DialogTitle>
          <DialogDescription>
            Fournissez une note explicative et/ou un justificatif (certificat
            médical, convocation, etc.). L'administration examinera votre demande.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="just-note">Note de justification</Label>
            <Textarea
              id="just-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Certificat médical fourni. Enfant malade du…"
              rows={4}
            />
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <Label htmlFor="just-file">Pièce jointe (PDF, image — max 10 Mo)</Label>
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm hover:bg-muted/40">
                <Upload className="h-4 w-4" />
                <span>{file ? file.name : "Choisir un fichier"}</span>
                <input
                  id="just-file"
                  type="file"
                  accept={ALLOWED_JUSTIFICATION_FILE_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > MAX_JUSTIFICATION_FILE_SIZE) {
                      toast.error(`Le fichier dépasse la taille maximale de ${MAX_JUSTIFICATION_FILE_SIZE / 1024 / 1024} Mo.`);
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
                  Retirer
                </button>
              )}
            </div>
          </div>

          {/* Drive link */}
          <div className="space-y-2">
            <Label htmlFor="just-link" className="flex items-center gap-1">
              <LinkIcon className="h-3 w-3" />
              Lien Google Drive (optionnel)
            </Label>
            <Input
              id="just-link"
              type="url"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              placeholder="https://drive.google.com/…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
