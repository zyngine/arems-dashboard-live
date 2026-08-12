-- Remove the interim hotfix from 2026-08-12. It blocks the sync trigger below.
-- 0002_lock_role_column.sql replaces it with a column-privilege revoke, which
-- cannot be bypassed and does not interfere with SECURITY DEFINER functions.
drop trigger if exists profiles_guard_role on public.profiles;
drop function if exists public.prevent_role_change();

-- user_roles becomes the source of truth for what a person is allowed to do.
-- profiles.role is retained as a derived "primary role" so existing code keeps working.

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role    text not null check (role in ('admin','lead_fto','fto','orientee','employee')),
  primary key (user_id, role)
);

create index if not exists user_roles_user_id_idx on public.user_roles(user_id);

-- Backfill: every existing scalar role becomes one row.
insert into public.user_roles (user_id, role)
select id, role from public.profiles where role is not null
on conflict do nothing;

-- Keep profiles.role in sync as the highest-privilege role held.
create or replace function public.sync_primary_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(new.user_id, old.user_id);
  v_primary text;
begin
  select r.role into v_primary
  from public.user_roles r
  where r.user_id = v_user_id
  order by array_position(
    array['admin','lead_fto','fto','orientee','employee'], r.role
  )
  limit 1;

  -- Never null out profiles.role: the column has a CHECK constraint and the app
  -- reads it unguarded. A user with no roles falls back to the least-privileged one.
  update public.profiles
     set role = coalesce(v_primary, 'employee')
   where id = v_user_id;

  return null;
end;
$$;

drop trigger if exists user_roles_sync_primary on public.user_roles;
create trigger user_roles_sync_primary
  after insert or update or delete on public.user_roles
  for each row execute function public.sync_primary_role();

-- RLS: everyone may read roles (the UI shows them); only admins may write.
alter table public.user_roles enable row level security;

drop policy if exists "Anyone can view user roles" on public.user_roles;
create policy "Anyone can view user roles"
  on public.user_roles for select using (true);

drop policy if exists "Admins can manage user roles" on public.user_roles;
create policy "Admins can manage user roles"
  on public.user_roles for all
  using (exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p
                       where p.id = auth.uid() and p.role = 'admin'));
