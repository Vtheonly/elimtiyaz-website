-- ============================================================================
-- 0027_portal_parent_rls_policies.sql
-- ============================================================================
-- Adds the Row-Level Security policies the web portal needs but the desktop
-- migrations (0019) didn't include:
--
--   1. Parents can UPDATE attendance_records but ONLY the justification_*
--      columns (and only for their own children). The trigger below enforces
--      the column restriction because Postgres RLS itself can't.
--
--   2. Parents can SELECT and INSERT student_documents for their own children
--      (so they can upload birth certificates, medical certificates, etc.).
--
--   3. Parents can UPDATE their own parents row but ONLY contact fields
--      (primary_phone, secondary_phone, email, address, city, postal_code,
--      occupation). The trigger below enforces the column restriction.
--
-- These policies do NOT grant any new access to staff tables (expenses, HR,
-- audit logs, etc.) — the portal remains a strict client interface.
-- ============================================================================

-- ============================================================================
-- 1. attendance_records — parent can update justification_* for own children
-- ============================================================================
-- The existing attendance_teacher_update policy already allows
-- super_admin/teacher/support_staff to update any column. We add a separate
-- policy that allows parents to update rows for their own children, then
-- enforce column restrictions via a BEFORE UPDATE trigger.

drop policy if exists attendance_parent_update_justification on public.attendance_records;
create policy attendance_parent_update_justification on public.attendance_records
  for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.has_role('parent')
    and student_id in (
      select s.id from public.students s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid() and s.deleted_at is null and p.deleted_at is null
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.has_role('parent')
    and student_id in (
      select s.id from public.students s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid() and s.deleted_at is null and p.deleted_at is null
    )
  );

-- BEFORE UPDATE trigger: when the caller is a parent, restrict the update to
-- the justification_* columns only. Other columns (status, date, recorded_by,
-- etc.) must be rejected. Staff roles are unaffected.
create or replace function public.enforce_parent_attendance_update_columns()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_parent boolean;
begin
  select public.has_role('parent') into is_parent;
  if is_parent then
    -- Only allow the parent to touch justification_* columns.
    if new.student_id is distinct from old.student_id
       or new.class_id is distinct from old.class_id
       or new.class_subject_id is distinct from old.class_subject_id
       or new.date is distinct from old.date
       or new.status is distinct from old.status
       or new.arrival_time is distinct from old.arrival_time
       or new.note is distinct from old.note
       or new.recorded_by is distinct from old.recorded_by
       or new.tenant_id is distinct from old.tenant_id then
      raise exception 'Parents can only update justification columns on attendance_records';
    end if;
    -- Auto-set justification_status = 'submitted' the first time a parent
    -- submits a justification, but never override an accepted/rejected one.
    if old.justification_status in ('none', 'rejected') and new.justification_status = old.justification_status then
      new.justification_status = 'submitted';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_records_enforce_parent_columns on public.attendance_records;
create trigger attendance_records_enforce_parent_columns
  before update on public.attendance_records
  for each row execute function public.enforce_parent_attendance_update_columns();

-- ============================================================================
-- 2. student_documents — parents can SELECT + INSERT for own children
-- ============================================================================
-- The existing student_documents_select policy already covers staff. We add
-- a parallel policy that lets parents read documents for their own children,
-- and an INSERT policy that lets them upload new ones (the desktop 0019
-- migration had student_documents_admin with FOR ALL but only for staff).

drop policy if exists student_documents_parent_select on public.student_documents;
create policy student_documents_parent_select on public.student_documents
  for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.has_role('parent')
    and student_id in (
      select s.id from public.students s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid() and s.deleted_at is null and p.deleted_at is null
    )
  );

drop policy if exists student_documents_parent_insert on public.student_documents;
create policy student_documents_parent_insert on public.student_documents
  for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and public.has_role('parent')
    and student_id in (
      select s.id from public.students s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid() and s.deleted_at is null and p.deleted_at is null
    )
    and uploaded_by = public.current_user_profile_id()
  );

-- ============================================================================
-- 3. parents — parent can self-update contact fields
-- ============================================================================
-- The existing parents_update policy only covers staff. We add a parallel
-- policy that allows a parent to update their own row, then enforce column
-- restrictions via a BEFORE UPDATE trigger.

drop policy if exists parents_self_update on public.parents;
create policy parents_self_update on public.parents
  for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.has_role('parent')
    and auth_user_id = auth.uid()
    and deleted_at is null
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.has_role('parent')
    and auth_user_id = auth.uid()
    and deleted_at is null
  );

create or replace function public.enforce_parent_self_update_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Parents can only touch contact fields. Anything else is rejected.
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.parent_code is distinct from old.parent_code
     or new.first_name is distinct from old.first_name
     or new.last_name is distinct from old.last_name
     or new.national_id is distinct from old.national_id
     or new.relationship is distinct from old.relationship
     or new.notes is distinct from old.notes
     or new.is_active is distinct from old.is_active
     or new.is_financially_restricted is distinct from old.is_financially_restricted
     or new.auth_user_id is distinct from old.auth_user_id
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'Parents can only update contact fields (phone, email, address, occupation)';
  end if;
  return new;
end;
$$;

drop trigger if exists parents_enforce_self_update_columns on public.parents;
create trigger parents_enforce_self_update_columns
  before update on public.parents
  for each row execute function public.enforce_parent_self_update_columns();
