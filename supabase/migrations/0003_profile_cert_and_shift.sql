-- cert_level and shift move onto profiles so they describe every employee, not just
-- orientees. shift is added here rather than in a later migration because Phase 2's
-- group assignment targets shift, and shift currently exists only on orientees -- an
-- employee who never went through the FTO process has no shift anywhere.

alter table public.profiles
  add column if not exists cert_level text
    check (cert_level is null or cert_level in ('EMT','AEMT','Paramedic'));

alter table public.profiles
  add column if not exists shift text;

-- Seed both from the orientee record where the person has one.
update public.profiles p
   set cert_level = o.cert_level
  from public.orientees o
 where o.user_id = p.id
   and p.cert_level is null
   and o.cert_level is not null;

update public.profiles p
   set shift = o.shift
  from public.orientees o
 where o.user_id = p.id
   and p.shift is null
   and o.shift is not null;

-- No REVOKE needed. 0002b replaced the table-level UPDATE grant with a column list,
-- and a column-level grant does not extend to columns added afterwards. cert_level
-- and shift are therefore un-writable by `authenticated` the moment they exist.
-- (This is why 0002b's approach is better than a per-column revoke: it fails closed.)

create or replace function public.set_user_cert_level(p_user_id uuid, p_cert_level text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles
                  where id = auth.uid() and role = 'admin') then
    raise exception 'Only an admin may change a certification level';
  end if;

  if p_cert_level is not null
     and p_cert_level not in ('EMT','AEMT','Paramedic') then
    raise exception 'Unknown certification level: %', p_cert_level;
  end if;

  update public.profiles set cert_level = p_cert_level where id = p_user_id;
end;
$$;

revoke all on function public.set_user_cert_level(uuid, text) from public;
grant execute on function public.set_user_cert_level(uuid, text) to authenticated;
