-- training_completions was keyed to orientee_id, so nobody outside the FTO process
-- could record a completion. Add user_id alongside it.
--
-- orientee_id is NOT dropped. orientees.user_id is nullable (14 of 28 orientees are
-- unlinked, created via the temp_name path before the person registered), so
-- orientee_id remains the only identity some future rows will have at write time.

alter table public.training_completions
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;

update public.training_completions tc
   set user_id = o.user_id
  from public.orientees o
 where o.id = tc.orientee_id
   and tc.user_id is null
   and o.user_id is not null;

create index if not exists training_completions_user_id_idx
  on public.training_completions(user_id);

-- One completion per person per material.
create unique index if not exists training_completions_user_material_uniq
  on public.training_completions(user_id, material_id)
  where user_id is not null;
