-- !! The two REVOKE statements below DO NOT WORK. See 0002b_fix_role_column_privileges.sql,
-- !! which supersedes them. Kept here because this is what was actually applied to the
-- !! database, and the history should show what happened. If you are rebuilding from
-- !! scratch, apply 0002b straight after this file.
--
-- DEFECT BEING FIXED
-- The policy "Users can update own profile" is USING (auth.uid() = id) with no
-- WITH CHECK. Postgres reuses USING as WITH CHECK when it is omitted, so the only
-- constraint on the new row is that the user still owns it. Nothing stops a user
-- from setting their own role to 'admin', and the app gates on that value.
--
-- Fix: remove write access to the privileged columns entirely. Role changes now go
-- through set_user_roles(), which checks the caller is an admin. Column privileges
-- apply to the SQL role, not per-row, so this also blocks admins from writing the
-- column directly -- deliberate, since profiles.role is derived from user_roles now.
--
-- handle_new_user() and link_orientee_by_email() are SECURITY DEFINER and run as the
-- function owner, so they are unaffected by this revoke.

revoke update (role) on public.profiles from authenticated;
revoke update (role) on public.profiles from anon;

create or replace function public.set_user_roles(p_user_id uuid, p_roles text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not exists (select 1 from public.profiles
                  where id = auth.uid() and role = 'admin') then
    raise exception 'Only an admin may change roles';
  end if;

  if p_roles is null or array_length(p_roles, 1) is null then
    raise exception 'A user must hold at least one role';
  end if;

  foreach v_role in array p_roles loop
    if v_role not in ('admin','lead_fto','fto','orientee','employee') then
      raise exception 'Unknown role: %', v_role;
    end if;
  end loop;

  -- Replace wholesale so the caller sends the full desired set.
  delete from public.user_roles
   where user_id = p_user_id and role <> all(p_roles);

  insert into public.user_roles (user_id, role)
  select p_user_id, unnest(p_roles)
  on conflict do nothing;
end;
$$;

revoke all on function public.set_user_roles(uuid, text[]) from public;
grant execute on function public.set_user_roles(uuid, text[]) to authenticated;
