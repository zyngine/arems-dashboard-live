-- CORRECTION to 0002_lock_role_column.sql.
--
-- That migration used REVOKE UPDATE (role), which is a no-op here: `authenticated`
-- and `anon` hold TABLE-level UPDATE on public.profiles, and Postgres will not let
-- a column-level REVOKE carve an exception out of a table-level grant. The statement
-- succeeds and changes nothing, which is why has_column_privilege still returned true
-- after 0002 was applied.
--
-- The working form is to drop the table-level grant and re-grant only the columns a
-- user may legitimately write. New columns added later (cert_level, shift) are then
-- un-writable by default, which is the behaviour we want.
--
-- Columns the client genuinely updates, from src/lib/database.js:
--   avatar_url      uploadProfilePicture (line 358)
--   queue_position  moveFTOToBottom / swapFTOQueuePositions (lines 100-118)
--   full_name, email, phone, updated_at   updateProfile (line 14)

revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

grant update (full_name, email, phone, avatar_url, queue_position, updated_at)
  on public.profiles to authenticated;

-- anon is unauthenticated; RLS already required auth.uid() = id, so it could never
-- update a row anyway. Withholding the grant makes that explicit.
