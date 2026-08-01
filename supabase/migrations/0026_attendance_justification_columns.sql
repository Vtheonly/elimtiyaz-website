-- ============================================================================
-- 0026_attendance_justification_columns.sql
-- ============================================================================
-- Adds justification columns to attendance_records so parents can submit
-- absence justifications from the web portal. The original 0004 schema only
-- had a generic `note` column; per the Client Web Portal plan ("Absence
-- Justification — Notes, Uploads, Drive Links"), the portal needs dedicated
-- columns for the note text, the uploaded file path, and an optional Google
-- Drive link.
--
-- These columns are nullable so existing attendance rows are unaffected.
-- Parents can UPDATE only these three columns (RLS policy in 0027).
-- Staff can still update the full row (status, arrival_time, note, etc.).
-- ============================================================================

alter table public.attendance_records
  add column if not exists justification_note text,
  add column if not exists justification_path text,
  add column if not exists justification_drive_link text,
  add column if not exists justification_status text
    not null default 'none'
    check (justification_status in ('none', 'submitted', 'accepted', 'rejected')),
  add column if not exists justification_reviewed_by uuid,
  add column if not exists justification_reviewed_at timestamptz;

comment on column public.attendance_records.justification_note is
  'Parent-submitted justification note (web portal). NULL until the parent submits one.';
comment on column public.attendance_records.justification_path is
  'Storage path under bucket "attendance-justifications" for the parent-uploaded file.';
comment on column public.attendance_records.justification_drive_link is
  'Optional Google Drive link supplied by the parent as supporting evidence.';
comment on column public.attendance_records.justification_status is
  'Workflow state of the parent-submitted justification. Staff flip submitted→accepted/rejected from the desktop app.';
comment on column public.attendance_records.justification_reviewed_by is
  'user_profiles.id of the staff member who accepted/rejected the justification.';
comment on column public.attendance_records.justification_reviewed_at is
  'Timestamp of the staff review decision.';

create index if not exists attendance_justification_status_idx
  on public.attendance_records (tenant_id, justification_status)
  where justification_status <> 'none';
