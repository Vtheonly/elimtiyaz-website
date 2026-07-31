/**
 * Zod validation schemas for every form in the portal.
 *
 * These schemas are the single source of truth for input validation — the
 * UI forms import them, and the server-side API routes (if added later)
 * can reuse them to validate incoming payloads.
 *
 * Why Zod: it's already a dependency (used by react-hook-form), provides
 * TypeScript type inference, and produces human-readable error messages.
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
      .max(2000, "La note ne peut pas dépasser 2000 caractères.")
      .optional()
      .or(z.literal("")),
    driveLink: z
      .string()
      .trim()
      .url("Le lien Google Drive n'est pas valide.")
      .refine(
        (v) => !v || v.includes("drive.google.com") || v.includes("docs.google.com"),
        "Le lien doit pointer vers Google Drive."
      )
      .optional()
      .or(z.literal("")),
    hasFile: z.boolean(),
  })
  .refine(
    (data) => data.note || data.driveLink || data.hasFile,
    {
      message:
        "Veuillez fournir une note, un fichier ou un lien Google Drive.",
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
    .min(1, "Le message ne peut pas être vide.")
    .max(5000, "Le message ne peut pas dépasser 5000 caractères."),
  channelId: z.string().uuid("Identifiant de canal invalide."),
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

export const uuidSchema = z.string().uuid("Identifiant invalide.");

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
    `Le fichier ne peut pas dépasser ${MAX_JUSTIFICATION_FILE_SIZE / 1024 / 1024} Mo.`
  )
  .refine(
    (f) => ALLOWED_JUSTIFICATION_FILE_TYPES.includes(f.type as (typeof ALLOWED_JUSTIFICATION_FILE_TYPES)[number]),
    "Type de fichier non autorisé. Formats acceptés: PDF, PNG, JPEG, WebP."
  );
