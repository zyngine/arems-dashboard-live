-- Two SECURITY DEFINER functions write profiles.role directly. They must write
-- user_roles instead, or roles silently diverge from the new source of truth.

-- Signup: create the profile, then record the role in user_roles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'phone',
    'employee'
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'employee')
  on conflict do nothing;

  return new;
end;
$$;

-- Linking an orientee ADDS the orientee role rather than replacing the user's roles,
-- so an FTO who also goes through orientation does not lose their FTO access.
-- It also backfills user_id onto that orientee's historical completions.
create or replace function public.link_orientee_by_email(p_user_id uuid, p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orientee_id uuid;
begin
  select id into v_orientee_id
  from orientees
  where lower(temp_email) = lower(p_email)
    and user_id is null
  limit 1;

  if v_orientee_id is null then
    return json_build_object('linked', false, 'reason', 'not_found');
  end if;

  update orientees set user_id = p_user_id where id = v_orientee_id;

  insert into public.user_roles (user_id, role)
  values (p_user_id, 'orientee')
  on conflict do nothing;

  -- Historical completions recorded against the orientee now belong to the user.
  update public.training_completions
     set user_id = p_user_id
   where orientee_id = v_orientee_id
     and user_id is null;

  -- Carry cert level and shift across if the profile has none yet.
  update public.profiles p
     set cert_level = coalesce(p.cert_level, o.cert_level),
         shift      = coalesce(p.shift, o.shift)
    from orientees o
   where o.id = v_orientee_id and p.id = p_user_id;

  return json_build_object('linked', true, 'orientee_id', v_orientee_id);
exception when others then
  return json_build_object('linked', false, 'reason', 'error', 'message', sqlerrm);
end;
$$;
