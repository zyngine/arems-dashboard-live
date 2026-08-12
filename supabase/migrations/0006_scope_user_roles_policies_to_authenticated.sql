-- DEFECT INTRODUCED BY 0001_user_roles.sql.
--
-- Its policies were written as `for select using (true)` and `for all using (...)`
-- with no TO clause. A policy with no TO clause applies to PUBLIC, which includes
-- the anon role. Verified against the live API: an unauthenticated caller could
-- GET /rest/v1/user_roles and read all 50 rows, learning which user ids hold
-- 'admin'. That is a targeting aid for credential attacks.
--
-- Every other table in this schema scopes its SELECT policy TO authenticated.
-- These two policies now match.
--
-- Lesson worth keeping: always write the TO clause explicitly. The default is
-- PUBLIC, not authenticated, and the difference is invisible in a passing test.

drop policy if exists "Anyone can view user roles" on public.user_roles;
create policy "Authenticated users can view user roles"
  on public.user_roles for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage user roles" on public.user_roles;
create policy "Admins can manage user roles"
  on public.user_roles for all
  to authenticated
  using (exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p
                       where p.id = auth.uid() and p.role = 'admin'));
