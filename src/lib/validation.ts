/**
 * Zod validation schemas for every form in the portal.
 *
 * These schemas are the single source of truth for input validation — the
 * UI forms import them, and the server-side API routes (if added later)
 * can reuse them to validate incoming payloads.
 *
 * Why Zod: it's already a dependency (used by react-hook-form), provides
 * TypeScript type inference, and produces human-readable error messages.
 *
 * T-385 (I18N-500): every user-facing message is a DICTIONARY KEY
 * (`validation.*` in src/lib/i18n/dictionary.ts, fr/ar/en). The schemas
 * validate; the toast seams translate (`t(message)`). A raw key rendered
 * untranslated means a consumer forgot the seam — the t-385 guard's
 * scanner keeps the toast seams honest.
 *
 * NOTE: `validation.file.tooBig` states the 10 MB limit statically in the
 * dictionary (MAX_JUSTIFICATION_FILE_SIZE is a compile-time constant);
 * the dialog's pre-check interpolates the constant dynamically — if the
 * constant ever changes, update both.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Absence Justification                                                      */
/* -------------------------------------------------------------------------- */

export const absenceJustificationSchema = z
  .object({
    note: z
      .string()
      .trim()
      .max(2000, "validation.note.tooLong")
      .optional()
      .or(z.literal("")),
    driveLink: z
      .string()
      .trim()
      .url("validation.driveLink.invalid")
      .refine(
        (v) => !v || v.includes("drive.google.com") || v.includes("docs.google.com"),
        "validation.driveLink.notDrive"
      )
      .optional()
      .or(z.literal("")),
    hasFile: z.boolean(),
  })
  .refine(
    (data) => data.note || data.driveLink || data.hasFile,
    {
      message: "validation.absence.required",
      path: ["note"],
    }
  );

export type AbsenceJustificationInput = z.infer<typeof absenceJustificationSchema>;

/* -------------------------------------------------------------------------- */
/* Chat Message                                                               */
/* -------------------------------------------------------------------------- */

export const chatMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "validation.message.empty")
    .max(5000, "validation.message.tooLong"),
  channelId: z.string().uuid("validation.channelId.invalid"),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

/* -------------------------------------------------------------------------- */
/* Language / Theme preferences                                              */
/* -------------------------------------------------------------------------- */

export const localeSchema = z.enum(["fr", "ar", "en"]);
export const themeSchema = z.enum(["dark", "light"]);

export type LocalePref = z.infer<typeof localeSchema>;
export type ThemePref = z.infer<typeof themeSchema>;

/* -------------------------------------------------------------------------- */
/* Student / Parent ID params                                                */
/* -------------------------------------------------------------------------- */

export const uuidSchema = z.string().uuid("validation.uuid.invalid");

/* -------------------------------------------------------------------------- */
/* Notification mark-read                                                    */
/* -------------------------------------------------------------------------- */

export const markNotificationReadSchema = z.object({
  notificationId: z.string().uuid(),
});

/* -------------------------------------------------------------------------- */
/* File upload constraints                                                   */
/* -------------------------------------------------------------------------- */

export const ALLOWED_JUSTIFICATION_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const MAX_JUSTIFICATION_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const fileUploadSchema = z
  .instanceof(File)
  .refine(
    (f) => f.size <= MAX_JUSTIFICATION_FILE_SIZE,
    "validation.file.tooBig"
  )
  .refine(
    (f) => ALLOWED_JUSTIFICATION_FILE_TYPES.includes(f.type as (typeof ALLOWED_JUSTIFICATION_FILE_TYPES)[number]),
    "validation.file.type"
  );
