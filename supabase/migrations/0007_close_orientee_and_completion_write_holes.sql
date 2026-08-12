-- C1: anon could tamper with unlinked orientee records.
--
-- "Users can link themselves to orientee" was FOR UPDATE with roles={public} and no
-- WITH CHECK, so USING was reused. The USING has a `user_id IS NULL` arm that is true
-- for an unauthenticated caller, and anon holds the table UPDATE grant. Result: an
-- unauthenticated PATCH could rewrite every column of the 8 non-archived orientees
-- that have no user_id -- status, hours_completed, lead_fto_id, dates.
--
-- The app does not use this path: linking goes through link_orientee_by_email(),
-- which is SECURITY DEFINER. So the policy can be narrowed to its stated purpose.

drop policy if exists "Users can link themselves to orientee" on public.orientees;
create policy "Users can link themselves to orientee"
  on public.orientees for update
  to authenticated
  using (user_id is null)
  with check (user_id = auth.uid());

-- C2: any authenticated user could forge or backdate any completion record.
--
-- INSERT had WITH CHECK true and UPDATE had USING true with no WITH CHECK, so a user
-- could POST a completion naming someone else's user_id, or PATCH an existing row to
-- backdate completed_at. Phase 1 promotes this table to the organisation's training
-- record of record with a CSV export intended for inspections -- an audit artifact
-- built on a table anyone can write is evidence of nothing.

drop policy if exists "Users can insert training completions" on public.training_completions;
create policy "Users record their own completions"
  on public.training_completions for insert
  to authenticated
  with check (user_id = auth.uid());

-- No client code updates this table (verified: database.js only inserts and selects),
-- so restricting UPDATE to admins breaks nothing today.
drop policy if exists "Users can update training completions" on public.training_completions;
create policy "Admins can update training completions"
  on public.training_completions for update
  to authenticated
  using (exists (select 1 from public.user_roles r
                  where r.user_id = auth.uid() and r.role = 'admin'))
  with check (exists (select 1 from public.user_roles r
                       where r.user_id = auth.uid() and r.role = 'admin'));

-- I6: an admin could remove their own admin role in one click and lock themselves
-- out, with no way back -- set_user_roles and the user_roles RLS policy would both
-- then reject them. With no staging environment, the last-admin case needs direct
-- database access to recover. Guard in the RPC where the UI cannot bypass it.
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
    -- `v_role not in (...)` yields NULL, not TRUE, for a NULL element, so test null first.
    if v_role is null or v_role not in ('admin','lead_fto','fto','orientee','employee') then
      raise exception 'Unknown role: %', coalesce(v_role, '<null>');
    end if;
  end loop;

  if p_user_id = auth.uid() and not ('admin' = any(p_roles)) then
    raise exception 'You cannot remove your own admin role. Ask another admin to do it.';
  end if;

  if not ('admin' = any(p_roles))
     and not exists (select 1 from public.user_roles
                      where role = 'admin' and user_id <> p_user_id) then
    raise exception 'At least one admin must remain';
  end if;

  delete from public.user_roles
   where user_id = p_user_id and role <> all(p_roles);

  insert into public.user_roles (user_id, role)
  select p_user_id, unnest(p_roles)
  on conflict do nothing;
end;
$$;

revoke all on function public.set_user_roles(uuid, text[]) from public;
grant execute on function public.set_user_roles(uuid, text[]) to authenticated;
