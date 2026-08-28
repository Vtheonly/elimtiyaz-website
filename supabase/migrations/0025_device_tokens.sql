-- ============================================================================
-- 0025_device_tokens.sql — PORTAL ALIGNMENT PATCH (canonical schema)
-- ============================================================================
-- FCM device token registration for push notifications.
--
-- REWRITE NOTE (cross-platform equivalence finding W-0025-SCHEMA):
-- The original version of this migration CREATEd a `device_tokens` table
-- with a `user_profile_id` column. The canonical backend chain (desktop
-- repo, migration 0027_shared_unification.sql) already defines
-- `public.device_tokens` with `user_id` — so on any database provisioned
-- from the canonical chain this migration's CREATE TABLE IF NOT EXISTS was
-- a no-op and every subsequent statement (unique index + RLS policies on
-- `user_profile_id`) FAILED with "column user_profile_id does not exist".
--
-- The portal now registers tokens through the canonical
-- `register_fcm_token(p_user_id, p_token, p_platform)` RPC (migration 0027)
-- — the exact same entry point the Android app's FcmTokenRegistrar uses —
-- and reads/deactivates rows via the `user_id` column with the RLS
-- policies installed by migration 0037.
--
-- This patch therefore only adds the portal-specific `user_agent` column
-- (additive, nullable) and documents the alignment. It contains ZERO
-- business logic.
-- ============================================================================

-- Portal-specific metadata column (additive — the canonical 0027 table has
-- `app_version` for native clients; the browser portal records its UA).
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

COMMENT ON COLUMN public.device_tokens.user_agent IS
  'Browser user agent for tokens registered by the web portal (NULL for native clients).';
