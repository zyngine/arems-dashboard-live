# Training Platform Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make training work for every employee, not just orientees — by giving people a certification level, letting them hold several roles at once, and re-basing training completions onto users.

**Architecture:** `user_roles` becomes the source of truth for roles; `profiles.role` is retained as a trigger-maintained derived "primary role", so the 25 existing scalar comparisons all stay correct via a single changed line rather than 25 edits. `training_completions` gains `user_id` alongside the existing `orientee_id`. A new admin completion report reads across all users and exports to CSV.

**Tech Stack:** React 18 (CRA / react-scripts 5), Supabase (Postgres 17, RLS), Jest via react-scripts, no new runtime dependencies.

---

## Context for the implementer

You have no context on this codebase. Read this section before Task 1.

**What the app is.** An orientation and field-training tracker for Adams Regional EMS. Roughly 50 users. Field Training Officers (FTOs) evaluate new hires ("orientees") through a 96-hour process.

**Live production database.** Project ref `ulqfizdadljbozyzxrdx`. It currently holds 50 profiles, 28 orientees, 115 training completions, 20 training materials. **Every migration in this plan runs against live data with real users.** There is no staging environment.

**No migration tooling exists.** There is no `supabase/` directory and no Supabase CLI setup. Schema changes have historically been typed by hand into the Supabase dashboard SQL editor. This plan introduces `supabase/migrations/` as a committed record. Apply each migration by pasting it into the **Supabase dashboard → SQL Editor**, then commit the file. (If you have the Supabase MCP server connected, `apply_migration` works too and additionally records it in Supabase's own migration history.)

**Current role model.** `profiles.role` is a single `text` column with a CHECK constraint allowing `admin`, `lead_fto`, `fto`, `orientee`, `employee`. Current distribution: orientee 16, lead_fto 15, employee 8, fto 6, admin 5.

**Style conventions in this codebase — follow them, do not "improve" them:**
- All styling is inline JS objects. There is no CSS framework and no stylesheet beyond a 270-byte `index.css`.
- A palette object `C` and a `card` style object are defined at the top of `Dashboard.js`. Reuse them; Task 15 moves them to `src/components/theme.js`.
- Database helpers in `src/lib/database.js` all return `{ data, error }`. Keep that shape.
- Components are function components with hooks. No class components.
- The codebase uses 2-space indent and single quotes.

**Verified facts you can rely on (already checked against the live DB — do not re-verify):**
- All 115 existing `training_completions` rows have an orientee with a non-null `user_id`, so the backfill is complete and leaves no orphans.
- 14 of 28 orientees have `user_id IS NULL` (created via the `temp_name` path before the person registered). Future completions must handle this.
- `profiles` has **no** `shift` column. `shift` exists only on `orientees`, with 4 distinct values.
- No triggers exist on `public.profiles`.
- `handle_new_user()` and `link_orientee_by_email()` are both `SECURITY DEFINER`, so column-level privilege changes do not break them.

---

## Security defect being fixed in this phase

This was found while planning, and it is live right now.

The RLS policy `"Users can update own profile"` on `public.profiles` is defined as:

```
cmd:        UPDATE
USING:      (auth.uid() = id)
WITH CHECK: (null)
```

In PostgreSQL, when an UPDATE policy omits `WITH CHECK`, **the `USING` expression is reused as `WITH CHECK`**. The resulting check is only `auth.uid() = id`, which a user still satisfies after changing any other column — including `role`. There is no trigger guarding the column.

**Consequence: any of the 50 authenticated users can set their own `role` to `'admin'` with a single client-side call, and the app's sidebar and admin screens gate purely on that value.**

**Status: an interim hotfix is already live.** On 2026-08-12 a `BEFORE UPDATE` trigger `profiles_guard_role` was applied to the production database, rejecting role changes by non-admins. The hole is closed today.

That hotfix is temporary and Task 4 drops it, because it blocks the `sync_primary_role` trigger. Task 5 replaces it with a column-privilege revoke, which is stronger — a `REVOKE UPDATE (role)` cannot be bypassed by any client-side call, whereas a trigger only rejects what it thinks to check.

**Apply Tasks 4 and 5 back to back.** Between them the hole is briefly reopened.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0001_user_roles.sql` | Create `user_roles`, backfill, sync trigger, RLS |
| `supabase/migrations/0002_lock_role_column.sql` | Revoke `role`/`cert_level` writes, add `set_user_roles` RPC |
| `supabase/migrations/0003_profile_cert_and_shift.sql` | Add `cert_level` and `shift` to `profiles` |
| `supabase/migrations/0004_completions_user_id.sql` | Add `training_completions.user_id`, backfill, index |
| `supabase/migrations/0005_update_definer_functions.sql` | Teach signup and orientee-linking about `user_roles` |
| `src/lib/roles.js` | `hasRole`, `hasAnyRole`, `primaryRole`, role/cert constants |
| `src/lib/roles.test.js` | Tests for the above |
| `src/lib/csv.js` | `escapeCell`, `toCSV`, `downloadCSV` |
| `src/lib/csv.test.js` | Tests for the above |
| `src/lib/database.js` | Modify: load roles, user-scoped completions, completion report |
| `src/components/theme.js` | Shared palette and card style, extracted from `Dashboard.js` |
| `src/components/CompletionReport.jsx` | New admin view: who completed what, when + CSV export |
| `src/components/Dashboard.js` | Modify: derived display role, employee access, role editor, theme import |
| `package.json` | Add `test` script |

`Dashboard.js` is 115 KB with every view inlined. Do not restructure it. Touch only the lines these tasks name, and put the new report in its own file.

---

## Task 1: Add test infrastructure

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the test script**

`react-scripts` already bundles Jest and jsdom, so this needs no new dependency. In `package.json`, change the `scripts` block to:

```json
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  },
```

- [ ] **Step 2: Verify Jest runs**

Run: `npm test -- --watchAll=false --passWithNoTests`
Expected: exits 0, prints `No tests found, exiting with code 0`.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add test script"
```

---

## Task 2: Role helpers

**Files:**
- Create: `src/lib/roles.js`
- Test: `src/lib/roles.test.js`

`hasRole` must accept **both** shapes: a profile carrying a `roles` array (new) and a profile carrying only the legacy scalar `role`. That dual support is what lets `Dashboard.js` migrate incrementally instead of in one cutover.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/roles.test.js`:

```js
import { hasRole, hasAnyRole, primaryRole, ROLE_PRECEDENCE, ROLE_LABELS, CERT_LEVELS } from './roles';

describe('hasRole', () => {
  it('reads the roles array when present', () => {
    expect(hasRole({ roles: ['fto', 'employee'] }, 'fto')).toBe(true);
    expect(hasRole({ roles: ['fto', 'employee'] }, 'admin')).toBe(false);
  });

  it('falls back to the legacy scalar role', () => {
    expect(hasRole({ role: 'admin' }, 'admin')).toBe(true);
    expect(hasRole({ role: 'admin' }, 'fto')).toBe(false);
  });

  it('prefers the roles array over the scalar when both exist', () => {
    expect(hasRole({ role: 'employee', roles: ['admin'] }, 'admin')).toBe(true);
  });

  it('treats an empty roles array as authoritative, not missing', () => {
    expect(hasRole({ role: 'admin', roles: [] }, 'admin')).toBe(false);
  });

  it('is safe on null and undefined', () => {
    expect(hasRole(null, 'admin')).toBe(false);
    expect(hasRole(undefined, 'admin')).toBe(false);
    expect(hasRole({}, 'admin')).toBe(false);
  });
});

describe('hasAnyRole', () => {
  it('is true when any role matches', () => {
    expect(hasAnyRole({ roles: ['employee'] }, ['admin', 'employee'])).toBe(true);
  });

  it('is false when none match', () => {
    expect(hasAnyRole({ roles: ['employee'] }, ['admin', 'fto'])).toBe(false);
  });

  it('is false for an empty candidate list', () => {
    expect(hasAnyRole({ roles: ['admin'] }, [])).toBe(false);
  });
});

describe('primaryRole', () => {
  it('returns the highest-precedence role held', () => {
    expect(primaryRole(['employee', 'admin', 'fto'])).toBe('admin');
    expect(primaryRole(['employee', 'fto'])).toBe('fto');
    expect(primaryRole(['employee'])).toBe('employee');
  });

  it('ranks lead_fto above fto', () => {
    expect(primaryRole(['fto', 'lead_fto'])).toBe('lead_fto');
  });

  it('returns null for empty or missing input', () => {
    expect(primaryRole([])).toBeNull();
    expect(primaryRole(null)).toBeNull();
    expect(primaryRole(undefined)).toBeNull();
  });

  it('ignores unknown roles', () => {
    expect(primaryRole(['wizard'])).toBeNull();
    expect(primaryRole(['wizard', 'fto'])).toBe('fto');
  });
});

describe('constants', () => {
  it('orders precedence from most to least privileged', () => {
    expect(ROLE_PRECEDENCE).toEqual(['admin', 'lead_fto', 'fto', 'orientee', 'employee']);
  });

  it('labels every role in the precedence list', () => {
    ROLE_PRECEDENCE.forEach(r => expect(typeof ROLE_LABELS[r]).toBe('string'));
  });

  it('lists the three EMS certification levels in ladder order', () => {
    expect(CERT_LEVELS).toEqual(['EMT', 'AEMT', 'Paramedic']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --watchAll=false src/lib/roles.test.js`
Expected: FAIL — `Cannot find module './roles'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/roles.js`:

```js
// Roles a user can hold. Ordered most-privileged first; primaryRole() depends on this order.
export const ROLE_PRECEDENCE = ['admin', 'lead_fto', 'fto', 'orientee', 'employee'];

export const ROLE_LABELS = {
  admin: 'Admin',
  lead_fto: 'Lead FTO',
  fto: 'FTO',
  orientee: 'Orientee',
  employee: 'Employee',
};

// EMS certifications ladder, so a person holds exactly one of these.
export const CERT_LEVELS = ['EMT', 'AEMT', 'Paramedic'];

// Accepts a profile with either a `roles` array (current) or a scalar `role` (legacy).
// The array wins when present, including when it is empty — an empty array means
// "this user genuinely holds no roles", not "the array is missing".
export const hasRole = (profile, role) => {
  if (!profile) return false;
  if (Array.isArray(profile.roles)) return profile.roles.includes(role);
  return profile.role === role;
};

export const hasAnyRole = (profile, roles) => (roles || []).some(r => hasRole(profile, r));

// The highest-privilege role held, used for display and for legacy scalar comparisons.
export const primaryRole = (roles) => {
  if (!Array.isArray(roles) || roles.length === 0) return null;
  return ROLE_PRECEDENCE.find(r => roles.includes(r)) || null;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --watchAll=false src/lib/roles.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roles.js src/lib/roles.test.js
git commit -m "feat: add role helpers supporting multi-role profiles"
```

---

## Task 3: CSV export helpers

**Files:**
- Create: `src/lib/csv.js`
- Test: `src/lib/csv.test.js`

A cell beginning `=`, `+`, `-`, or `@` is interpreted as a formula by Excel and Google Sheets. A name like `-Smith` or a crafted value becomes executable content in the recipient's spreadsheet. Prefix those with an apostrophe.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/csv.test.js`:

```js
import { escapeCell, toCSV } from './csv';

describe('escapeCell', () => {
  it('passes plain values through', () => {
    expect(escapeCell('Smith')).toBe('Smith');
    expect(escapeCell(42)).toBe('42');
  });

  it('renders null and undefined as empty', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });

  it('quotes values containing a comma', () => {
    expect(escapeCell('Smith, John')).toBe('"Smith, John"');
  });

  it('doubles embedded quotes and wraps', () => {
    expect(escapeCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('quotes values containing newlines', () => {
    expect(escapeCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCell('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('neutralizes spreadsheet formula injection', () => {
    expect(escapeCell('=1+1')).toBe("'=1+1");
    expect(escapeCell('+1')).toBe("'+1");
    expect(escapeCell('-1')).toBe("'-1");
    expect(escapeCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('quotes a neutralized value that also contains a comma', () => {
    expect(escapeCell('=A1,B1')).toBe('"\'=A1,B1"');
  });

  it('leaves a hyphen mid-string alone', () => {
    expect(escapeCell('Anne-Marie')).toBe('Anne-Marie');
  });
});

describe('toCSV', () => {
  const columns = [
    { label: 'Name', value: r => r.name },
    { label: 'Hours', value: r => r.hours },
  ];

  it('writes a header row followed by data rows', () => {
    const csv = toCSV([{ name: 'Ann', hours: 8 }, { name: 'Bo', hours: 12 }], columns);
    expect(csv).toBe('Name,Hours\r\nAnn,8\r\nBo,12');
  });

  it('writes just the header when there are no rows', () => {
    expect(toCSV([], columns)).toBe('Name,Hours');
  });

  it('escapes values inside rows', () => {
    const csv = toCSV([{ name: 'Smith, John', hours: 8 }], columns);
    expect(csv).toBe('Name,Hours\r\n"Smith, John",8');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --watchAll=false src/lib/csv.test.js`
Expected: FAIL — `Cannot find module './csv'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/csv.js`:

```js
// Excel and Sheets execute a cell that starts with any of these.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const NEEDS_QUOTING = /[",\n\r]/;

export const escapeCell = (value) => {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (FORMULA_PREFIX.test(s)) s = "'" + s;
  if (NEEDS_QUOTING.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
};

// columns: [{ label, value: row => cell }]
export const toCSV = (rows, columns) => {
  const header = columns.map(c => escapeCell(c.label)).join(',');
  const body = (rows || []).map(r => columns.map(c => escapeCell(c.value(r))).join(','));
  return [header, ...body].join('\r\n');
};

export const downloadCSV = (filename, csv) => {
  // The BOM makes Excel read the file as UTF-8 rather than the local codepage.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --watchAll=false src/lib/csv.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.js src/lib/csv.test.js
git commit -m "feat: add CSV export helpers with formula-injection guard"
```

---

## Task 4: Migration — `user_roles` table

**Files:**
- Create: `supabase/migrations/0001_user_roles.sql`

**An interim hotfix is already applied to the live database and this migration must remove it.** A trigger named `profiles_guard_role` (function `public.prevent_role_change`) was applied on 2026-08-12 to block role self-escalation until Task 5 lands. It rejects any UPDATE that changes `profiles.role` when `auth.uid()` is not an admin.

That guard is incompatible with the `sync_primary_role` trigger this task adds. `sync_primary_role` updates `profiles.role` in response to `user_roles` changes, and it runs in whatever session triggered it — so when a newly-registered orientee calls `link_orientee_by_email`, the sync would fire with `auth.uid()` set to the orientee, the guard would reject it, and account linking would break.

Dropping it reopens the escalation hole until Task 5 revokes the column. **Apply Tasks 4 and 5 back to back in one sitting.** Do not stop between them.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_user_roles.sql`:

```sql
-- Remove the interim hotfix from 2026-08-12. It blocks the sync trigger below.
-- Task 5 (0002_lock_role_column.sql) replaces it with a column-privilege revoke,
-- which cannot be bypassed and does not interfere with SECURITY DEFINER functions.
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
```

- [ ] **Step 2: Apply it**

Paste the file into **Supabase dashboard → SQL Editor → Run**.
Expected: `Success. No rows returned.`

- [ ] **Step 3: Verify the backfill**

Run this in the SQL Editor:

```sql
select
  (select count(*) from public.profiles)   as profiles,
  (select count(*) from public.user_roles) as roles;
```

Expected: both columns return `50`. If `roles` is lower, a profile had a null role — stop and investigate before continuing.

- [ ] **Step 4: Verify the sync trigger works**

```sql
select role from public.profiles where id =
  (select user_id from public.user_roles where role = 'employee' limit 1);
```

Expected: `employee`. The trigger has not fired yet for this row, so this is just confirming the pre-existing value is consistent with the backfill.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_user_roles.sql
git commit -m "feat(db): add user_roles table with backfill and primary-role sync"
```

---

## Task 5: Migration — close the privilege-escalation hole

**Files:**
- Create: `supabase/migrations/0002_lock_role_column.sql`

**Apply this immediately after Task 4 and deploy the two together.** Between them, `user_roles` exists but nothing yet stops direct writes to `profiles.role`; after this migration, the admin role dropdown in the UI will fail until Task 14 switches it to the new RPC. Both gaps are short-lived and neither is worse than the hole being closed.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0002_lock_role_column.sql`:

```sql
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

-- NOTE: `revoke update (role) ...` does NOT work here. `authenticated` and `anon`
-- hold TABLE-level UPDATE on profiles, and Postgres will not let a column-level
-- REVOKE carve an exception out of a table-level grant -- the statement succeeds
-- and changes nothing. Drop the table grant and re-grant the allowed columns.
revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

grant update (full_name, email, phone, avatar_url, queue_position, updated_at)
  on public.profiles to authenticated;

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
```

- [ ] **Step 2: Apply it**

Paste into **Supabase dashboard → SQL Editor → Run**.
Expected: `Success. No rows returned.`

- [ ] **Step 3: Verify the column is no longer writable**

```sql
select
  has_column_privilege('authenticated','public.profiles','role','UPDATE')           as role_writable,
  has_column_privilege('authenticated','public.profiles','avatar_url','UPDATE')     as avatar_writable,
  has_column_privilege('authenticated','public.profiles','queue_position','UPDATE') as queue_writable;
```

Expected: `role_writable = false`, and both `avatar_writable` and `queue_writable` **true**. If either of the latter two is false, profile photo upload and the FTO rotation queue will start failing with a permission error — the grant list is too narrow.

- [ ] **Step 4: Verify the RPC rejects a non-admin caller**

In the SQL Editor, `auth.uid()` is null, so the admin check must fail:

```sql
select public.set_user_roles(
  (select id from public.profiles limit 1), array['admin']
);
```

Expected: `ERROR: Only an admin may change roles`. Seeing this error is the test passing.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_lock_role_column.sql
git commit -m "fix(security): block role self-escalation via profiles.role

The UPDATE policy on profiles omitted WITH CHECK, so Postgres reused USING
(auth.uid() = id) for it. That let any authenticated user set their own role
to admin. Revoke UPDATE on the column and route role changes through an
admin-checked security-definer RPC."
```

---

## Task 6: Migration — `cert_level` and `shift` on profiles

**Files:**
- Create: `supabase/migrations/0003_profile_cert_and_shift.sql`

`shift` is added here because the spec's group-assignment audiences (Phase 2) include shift, and `shift` currently exists only on `orientees` — an employee who is not an orientee has no shift. Adding it alongside `cert_level` avoids a second migration over the same table.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_profile_cert_and_shift.sql`:

```sql
alter table public.profiles
  add column if not exists cert_level text
    check (cert_level is null or cert_level in ('EMT','AEMT','Paramedic'));

alter table public.profiles
  add column if not exists shift text;

-- Seed cert_level and shift from the orientee record where the person has one.
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

-- Admin-managed, same reasoning as role.
revoke update (cert_level) on public.profiles from authenticated;
revoke update (cert_level) on public.profiles from anon;

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
```

- [ ] **Step 2: Apply it**

Paste into **Supabase dashboard → SQL Editor → Run**.
Expected: `Success. No rows returned.`

- [ ] **Step 3: Verify the seed**

```sql
select count(*) from public.profiles where cert_level is not null;
```

Expected: `14`. That is the number of orientees with a linked `user_id` (28 orientees, 14 unlinked). If you get 0, the join found nothing — stop and investigate.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_profile_cert_and_shift.sql
git commit -m "feat(db): add cert_level and shift to profiles"
```

---

## Task 7: Migration — user-scoped training completions

**Files:**
- Create: `supabase/migrations/0004_completions_user_id.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0004_completions_user_id.sql`:

```sql
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
```

- [ ] **Step 2: Apply it**

Paste into **Supabase dashboard → SQL Editor → Run**.
Expected: `Success. No rows returned.`

If the unique index fails with a duplicate-key error, there are pre-existing duplicate completions. Find them with the query below, delete the older row of each pair, then re-run the index statement:

```sql
select user_id, material_id, count(*)
from public.training_completions
where user_id is not null
group by user_id, material_id having count(*) > 1;
```

- [ ] **Step 3: Verify the backfill left nothing behind**

```sql
select
  count(*) filter (where user_id is null) as unbackfilled,
  count(*)                                as total
from public.training_completions;
```

Expected: `unbackfilled = 0`, `total = 115`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_completions_user_id.sql
git commit -m "feat(db): re-base training completions onto user_id"
```

---

## Task 8: Migration — teach the definer functions about `user_roles`

**Files:**
- Create: `supabase/migrations/0005_update_definer_functions.sql`

Two existing `SECURITY DEFINER` functions write `profiles.role` directly. They must write `user_roles` instead, or roles will silently diverge from the new source of truth. `link_orientee_by_email` currently *overwrites* the role; it must **add** the orientee role rather than clobber whatever else the person is.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0005_update_definer_functions.sql`:

```sql
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
```

- [ ] **Step 2: Apply it**

Paste into **Supabase dashboard → SQL Editor → Run**.
Expected: `Success. No rows returned.`

- [ ] **Step 3: Verify both functions still exist and compile**

```sql
select proname from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('handle_new_user', 'link_orientee_by_email');
```

Expected: 2 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_update_definer_functions.sql
git commit -m "feat(db): route signup and orientee linking through user_roles"
```

---

## Task 9: Load roles with the profile

**Files:**
- Modify: `src/lib/database.js:3-16` (`getUserProfile`, `getAllProfiles`, `updateProfile`)

- [ ] **Step 1: Replace the three profile functions**

In `src/lib/database.js`, replace lines 3–16 (the `getUserProfile`, `getAllProfiles`, and `updateProfile` definitions) with:

```js
// Flattens the joined user_roles rows into a plain array so callers can use
// hasRole(profile, 'fto') without knowing the join shape.
const withRoles = (row) => {
  if (!row) return row;
  const { user_roles, ...rest } = row;
  return { ...rest, roles: (user_roles || []).map(r => r.role) };
};

export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, user_roles(role)')
    .eq('id', userId)
    .single();
  return { data: withRoles(data), error };
};

export const getAllProfiles = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, user_roles(role)')
    .order('full_name');
  return { data: (data || []).map(withRoles), error };
};

export const updateProfile = async (userId, updates) => {
  // role and cert_level are not writable on this table; use setUserRoles /
  // setUserCertLevel. Strip them so a stray caller gets a no-op, not a 403.
  const { role, cert_level, roles, user_roles, ...safe } = updates;
  const { data, error } = await supabase
    .from('profiles')
    .update(safe)
    .eq('id', userId)
    .select('*, user_roles(role)')
    .single();
  return { data: withRoles(data), error };
};

export const setUserRoles = async (userId, roles) => {
  const { error } = await supabase.rpc('set_user_roles', {
    p_user_id: userId,
    p_roles: roles,
  });
  return { error };
};

export const setUserCertLevel = async (userId, certLevel) => {
  const { error } = await supabase.rpc('set_user_cert_level', {
    p_user_id: userId,
    p_cert_level: certLevel,
  });
  return { error };
};
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: `Compiled successfully.` (Warnings about unused vars are acceptable; errors are not.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/database.js
git commit -m "feat: load user_roles with profiles and add role-setting RPCs"
```

---

## Task 10: User-scoped training completions

**Files:**
- Modify: `src/lib/database.js:211-219` (`getTrainingCompletions`, `markTrainingComplete`)

- [ ] **Step 1: Replace both functions**

In `src/lib/database.js`, replace the `getTrainingCompletions` and `markTrainingComplete` definitions with:

```js
export const getTrainingCompletions = async (userId) => {
  const { data, error } = await supabase
    .from('training_completions')
    .select('*')
    .eq('user_id', userId);
  return { data, error };
};

// orienteeId is optional and only set when the completion happened inside the FTO
// process. Completions for ordinary employees carry user_id alone.
export const markTrainingComplete = async (userId, materialId, orienteeId = null) => {
  const { data, error } = await supabase
    .from('training_completions')
    .insert([{
      user_id: userId,
      material_id: materialId,
      orientee_id: orienteeId,
      completed_at: new Date().toISOString(),
    }])
    .select()
    .single();
  return { data, error };
};
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 3: Commit**

```bash
git add src/lib/database.js
git commit -m "feat: record training completions against users"
```

---

## Task 11: Completion report query

**Files:**
- Modify: `src/lib/database.js` (append near the other training functions)

- [ ] **Step 1: Add the query**

Append to `src/lib/database.js`, after `markTrainingComplete`:

```js
// Every completion across the organisation, newest first, for the admin report.
export const getCompletionReport = async () => {
  const { data, error } = await supabase
    .from('training_completions')
    .select(`
      id,
      completed_at,
      material:training_materials(id, title, type),
      user:profiles!training_completions_user_id_fkey(id, full_name, email, role, cert_level, shift)
    `)
    .not('user_id', 'is', null)
    .order('completed_at', { ascending: false });
  return { data, error };
};
```

- [ ] **Step 2: Verify the foreign-key hint resolves**

The embedded select uses the constraint name `training_completions_user_id_fkey`. Postgrest needs it to exist. Confirm in the Supabase SQL Editor:

```sql
select conname from pg_constraint
where conrelid = 'public.training_completions'::regclass
  and contype = 'f';
```

Expected: the list includes `training_completions_user_id_fkey`. If the name differs, use the actual name in the select string.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
git add src/lib/database.js
git commit -m "feat: add organisation-wide training completion report query"
```

---

## Task 12: Derive the display role from `user_roles`

**Files:**
- Modify: `src/components/Dashboard.js:1-5` (imports), `src/components/Dashboard.js:1322`

The 25 existing `role === '...'` comparisons are **deliberately left alone**. Redefining the single `role` variable to come from the roles array makes all 25 correct at once, with one line changed instead of 25. `hasRole` exists and is tested, but is not needed in `Dashboard.js` until Phase 2 introduces checks that a single primary role cannot express.

- [ ] **Step 1: Add the import**

At `src/components/Dashboard.js:5`, after `import FTOQueueView from './FTOQueueView';`, add:

```js
import { primaryRole, ROLE_PRECEDENCE, ROLE_LABELS, CERT_LEVELS } from '../lib/roles';
```

Import only these four. Adding `hasRole`/`hasAnyRole` here produces an unused-variable warning in the CRA build.

- [ ] **Step 2: Derive `role` from the roles array**

At `src/components/Dashboard.js:1322`, replace:

```js
  const role = profile?.role || 'orientee';
```

with:

```js
  const role = primaryRole(profile?.roles) || profile?.role || 'employee';
```

Two changes in one line. The array becomes authoritative, and the fallback moves from `'orientee'` to `'employee'` — if the profile fails to load, the user should land on the least-privileged role, not one that grants orientee views.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `Compiled successfully.` with no `no-unused-vars` warning for the roles import.

- [ ] **Step 4: Commit**

```bash
git add src/components/Dashboard.js
git commit -m "refactor: derive display role from user_roles, default to least privilege"
```

---

## Task 13: Give employees access to training

**Files:**
- Modify: `src/components/Dashboard.js:53` (sidebar), `src/components/Dashboard.js:661-698` (`TrainingView`)

- [ ] **Step 1: Add `employee` to the Training nav item**

At `src/components/Dashboard.js:53`, change:

```js
    { id: 'training', label: 'Training', icon: Icons.GraduationCap, roles: ['admin', 'fto', 'lead_fto', 'orientee'] },
```

to:

```js
    { id: 'training', label: 'Training', icon: Icons.GraduationCap, roles: ['admin', 'fto', 'lead_fto', 'orientee', 'employee'] },
```

- [ ] **Step 2: Let anyone mark training complete**

In `TrainingView`, the completion button is currently gated on `role === 'orientee' && orienteeId && !done`. Replace the two lines rendering the button and the completed badge with:

```js
              {!done && <button onClick={() => showConfirm('Complete Training', 'Are you sure you want to mark "' + m.title + '" as completed?', () => onComplete(m.id))} style={{ padding: '10px 16px', borderRadius: '10px', background: C.success, color: 'white', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Mark Complete</button>}
              {done && <span style={{ padding: '10px 16px', borderRadius: '10px', background: C.success + '12', color: C.success, fontSize: '13px', fontWeight: '600' }}>✓ Completed</span>}
```

- [ ] **Step 3: Update the completion handler to use the user**

Find `handleCompleteTraining` in `src/components/Dashboard.js` and replace it with:

```js
  const handleCompleteTraining = async (materialId) => {
    const { error } = await db.markTrainingComplete(user.id, materialId, myOrientee?.id || null);
    if (error) { alert('Error: ' + error.message); return; }
    const { data: mc } = await db.getTrainingCompletions(user.id);
    setCompletions(mc || []);
    setConfirmDialog(null);
  };
```

- [ ] **Step 4: Update the initial completions load**

At `src/components/Dashboard.js:1173-1181`, the completions load sits *inside* an orientee-only branch, so a non-orientee never loads them and every card would render as incomplete. Replace this block:

```js
      if (pr.data?.role === 'orientee') {
        const { data: mo } = await db.getOrienteeByUserId(user.id);
        setMyOrientee(mo);
        if (mo) {
          const { data: mt } = await db.getTasksByOrientee(mo.id);
          const { data: mc } = await db.getTrainingCompletions(mo.id);
          setMyTasks(mt || []);
          setCompletions(mc || []);
        }
      }
```

with:

```js
      // Completions are per-user now, so every role loads them, not just orientees.
      const { data: mc } = await db.getTrainingCompletions(user.id);
      setCompletions(mc || []);

      if (pr.data?.role === 'orientee') {
        const { data: mo } = await db.getOrienteeByUserId(user.id);
        setMyOrientee(mo);
        if (mo) {
          const { data: mt } = await db.getTasksByOrientee(mo.id);
          setMyTasks(mt || []);
        }
      }
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 6: Manually verify as an employee**

Run: `npm start`, log in as a user whose only role is `employee`.
Expected: "Training" appears in the sidebar; opening it lists materials; "Mark Complete" records and the card flips to "✓ Completed"; reloading the page keeps it completed.

- [ ] **Step 7: Commit**

```bash
git add src/components/Dashboard.js
git commit -m "feat: let every employee view and complete training"
```

---

## Task 14: Multi-role and cert-level admin editor

**Files:**
- Modify: `src/components/Dashboard.js:1049` (the role `<select>` in the admin user list)
- Modify: `src/components/Dashboard.js` (`handleUpdateRole`)

The single `<select>` at line 1049 writes `profiles.role` directly, which Task 5 revoked. It must become a multi-select over `user_roles` plus a separate cert-level control.

- [ ] **Step 1: Replace the role select with role checkboxes and a cert dropdown**

Replace the `<select value={p.role} ...>` element at `src/components/Dashboard.js:1049` with:

```jsx
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ROLE_PRECEDENCE.map(r => {
                  const on = (p.roles || [p.role]).includes(r);
                  return (
                    <button
                      key={r}
                      disabled={saving}
                      onClick={() => onUpdateRoles(p.id, on
                        ? (p.roles || [p.role]).filter(x => x !== r)
                        : [...(p.roles || [p.role]), r])}
                      style={{
                        padding: '6px 11px', borderRadius: '999px', fontSize: '12px', fontWeight: '600',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        border: '1px solid ' + (on ? C.primary : C.g[200]),
                        background: on ? C.primary : 'white',
                        color: on ? 'white' : C.g[500],
                      }}
                    >{ROLE_LABELS[r]}</button>
                  );
                })}
              </div>
              <select
                value={p.cert_level || ''}
                disabled={saving}
                onChange={e => onUpdateCertLevel(p.id, e.target.value || null)}
                style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid ' + C.g[200], fontSize: '13px', background: 'white', fontWeight: '500', color: C.g[700] }}
              >
                <option value="">No cert level</option>
                {CERT_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
```

- [ ] **Step 2: Thread the two new handlers to `AdminView`**

At `src/components/Dashboard.js:1030`, change the `AdminView` signature from:

```js
const AdminView = ({ orientees, profiles, onAdjustHours, onUpdateRole, onDeleteOrientee, onEditOrientee, saving, showConfirm }) => (
```

to:

```js
const AdminView = ({ orientees, profiles, onAdjustHours, onUpdateRoles, onUpdateCertLevel, onDeleteOrientee, onEditOrientee, saving, showConfirm }) => (
```

Then at `src/components/Dashboard.js:1342`, change the prop passed at the render site from:

```js
onUpdateRole={handleUpdateRole}
```

to:

```js
onUpdateRoles={handleUpdateRoles} onUpdateCertLevel={handleUpdateCertLevel}
```

- [ ] **Step 3: Replace the handler**

Replace `handleUpdateRole` in `src/components/Dashboard.js` with:

```js
  const handleUpdateRoles = async (userId, roles) => {
    if (roles.length === 0) { alert('A user must have at least one role.'); return; }
    setSaving(true);
    const { error } = await db.setUserRoles(userId, roles);
    if (error) alert('Failed to update roles: ' + error.message);
    await load(true);
    setSaving(false);
  };

  const handleUpdateCertLevel = async (userId, certLevel) => {
    setSaving(true);
    const { error } = await db.setUserCertLevel(userId, certLevel);
    if (error) alert('Failed to update certification level: ' + error.message);
    await load(true);
    setSaving(false);
  };
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 5: Manually verify**

Run `npm start`, log in as an admin, open the Admin view.
Expected: each user shows role pills and a cert dropdown; toggling a pill persists after reload; giving someone both `fto` and `employee` keeps both lit; removing the last role shows the alert and changes nothing.

Then log in as a non-admin and confirm in the browser console that self-promotion fails:

```js
await window.supabase?.from('profiles').update({ role: 'admin' }).eq('id', '<your-id>')
```

Expected: the row is unchanged. (If `window.supabase` is undefined, skip — the column privilege is already proven by Task 5 Step 3.)

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.js
git commit -m "feat: multi-role and cert-level editing in admin view"
```

---

## Task 15: Completion report view with CSV export

**Files:**
- Create: `src/components/theme.js`
- Create: `src/components/CompletionReport.jsx`
- Modify: `src/components/Dashboard.js:7-8` (theme import), plus nav item + route + component import

- [ ] **Step 1: Extract the shared theme**

The palette `C` and the `card` style live at `src/components/Dashboard.js:7-8`. Phase 2 adds six more components that need them, so extract now rather than copying the values into each one.

Create `src/components/theme.js` by moving those two lines verbatim:

```js
export const C = { primary: '#1e40af', primaryDark: '#1a365d', accent: '#eab308', success: '#16a34a', warning: '#ea580c', danger: '#dc2626', g: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' } };
export const card = { background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: '18px', boxShadow: '0 2px 16px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.5)' };
```

Then in `src/components/Dashboard.js`, delete lines 7 and 8 (the `const C = ...` and `const card = ...` declarations) and add this import alongside the others at the top:

```js
import { C, card } from './theme';
```

- [ ] **Step 2: Verify nothing broke**

Run: `npm run build`
Expected: `Compiled successfully.` The values are identical, so the UI must be pixel-identical. If the build reports `C is not defined`, a declaration was deleted without the import being added.

- [ ] **Step 3: Commit the extraction separately**

Keeping this commit separate from the new feature makes it obvious the change is a pure move.

```bash
git add src/components/theme.js src/components/Dashboard.js
git commit -m "refactor: extract shared theme from Dashboard"
```

- [ ] **Step 4: Create the component**

Create `src/components/CompletionReport.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import * as db from '../lib/database';
import { toCSV, downloadCSV } from '../lib/csv';
import { Icons } from './Icons';
import { C, card } from './theme';

const COLUMNS = [
  { label: 'Name',       value: r => r.user?.full_name || '' },
  { label: 'Email',      value: r => r.user?.email || '' },
  { label: 'Cert Level', value: r => r.user?.cert_level || '' },
  { label: 'Shift',      value: r => r.user?.shift || '' },
  { label: 'Training',   value: r => r.material?.title || '' },
  { label: 'Type',       value: r => r.material?.type || '' },
  { label: 'Completed',  value: r => r.completed_at ? new Date(r.completed_at).toLocaleString() : '' },
];

const CompletionReport = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [material, setMaterial] = useState('all');

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await db.getCompletionReport();
      if (!active) return;
      if (error) setError(error.message); else setRows(data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const materials = [...new Set(rows.map(r => r.material?.title).filter(Boolean))].sort();

  let display = rows;
  if (material !== 'all') display = display.filter(r => r.material?.title === material);
  if (search.trim()) {
    const s = search.toLowerCase();
    display = display.filter(r =>
      (r.user?.full_name || '').toLowerCase().includes(s) ||
      (r.user?.email || '').toLowerCase().includes(s) ||
      (r.material?.title || '').toLowerCase().includes(s));
  }

  const onExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`arems-training-completions-${stamp}.csv`, toCSV(display, COLUMNS));
  };

  return (
    <div style={{ padding: '26px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', color: C.g[900], margin: 0 }}>Training Completions</h1>
        <button onClick={onExport} disabled={display.length === 0}
          style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '600', background: C.primary, color: 'white', cursor: display.length === 0 ? 'not-allowed' : 'pointer', opacity: display.length === 0 ? 0.5 : 1 }}>
          Export CSV ({display.length})
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, or training"
          style={{ flex: '1 1 240px', padding: '11px 14px', borderRadius: '12px', border: '1px solid ' + C.g[200], fontSize: '14px' }} />
        <select value={material} onChange={e => setMaterial(e.target.value)}
          style={{ padding: '11px 14px', borderRadius: '12px', border: '1px solid ' + C.g[200], fontSize: '14px', background: 'white' }}>
          <option value="all">All training</option>
          {materials.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={{ ...card, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center' }}>
            <Icons.Loader size={34} color={C.primary} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#dc2626' }}>Could not load completions: {error}</div>
        ) : display.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: C.g[500] }}>No completions found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.g[50] }}>
                {COLUMNS.map(c => (
                  <th key={c.label} style={{ padding: '14px 18px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: C.g[500], textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {display.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid ' + C.g[50] }}>
                  {COLUMNS.map(c => (
                    <td key={c.label} style={{ padding: '14px 18px', fontSize: '14px', color: C.g[700], whiteSpace: 'nowrap' }}>{c.value(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CompletionReport;
```

- [ ] **Step 5: Import it in `Dashboard.js`**

After the `import FTOQueueView from './FTOQueueView';` line, add:

```js
import CompletionReport from './CompletionReport';
```

- [ ] **Step 6: Add the nav item**

In the `Sidebar` `items` array in `src/components/Dashboard.js`, add this entry immediately after the `training` entry:

```js
    { id: 'completions', label: 'Completions', icon: Icons.ClipboardCheck, roles: ['admin'] },
```

- [ ] **Step 7: Add the route**

In the main `Dashboard` return block, alongside the other `{view === '...' && ...}` lines, add:

```jsx
        {view === 'completions' && <CompletionReport />}
```

- [ ] **Step 8: Verify the build**

Run: `npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 9: Manually verify**

Run `npm start`, log in as an admin, open **Completions**.
Expected: 115 rows on first load; search and the training filter narrow the list; "Export CSV" downloads a file whose row count matches the button; opening it in Excel shows correct columns with no formula warnings.

- [ ] **Step 10: Commit**

```bash
git add src/components/CompletionReport.jsx src/components/Dashboard.js
git commit -m "feat: add admin training completion report with CSV export"
```

---

## Task 16: End-to-end verification

**Files:** none — this is a manual pass.

Do not skip. Several of these exercise paths the unit tests cannot reach.

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --watchAll=false`
Expected: all suites pass, 26 tests.

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 3: Verify each role still sees the right navigation**

Log in as each of admin, lead_fto, fto, orientee, employee.
Expected: sidebars match the `roles` arrays in the `items` list; nobody sees a view they should not; the FTO Queue still loads for FTOs.

- [ ] **Step 4: Verify a dual-role user**

Give one test user both `fto` and `employee`, then log in as them.
Expected: they see the FTO views *and* Training; `primaryRole` resolves them to `fto` for display.

- [ ] **Step 5: Verify existing FTO functionality is untouched**

As an FTO, create an evaluation for an orientee.
Expected: it saves, hours increment on the orientee, and the evaluation email still sends.

- [ ] **Step 6: Verify the completion counts reconcile**

In the Supabase SQL Editor:

```sql
select count(*) from public.training_completions where user_id is not null;
```

Expected: matches the row count shown in the Completions view before filtering.

- [ ] **Step 7: Commit any fixes and push the branch**

```bash
git push -u origin feature/training-platform
```

---

## Definition of done

- [ ] All 16 tasks complete, every checkbox ticked
- [ ] `npm test -- --watchAll=false` passes
- [ ] `npm run build` compiles
- [ ] An `employee`-only user can view and complete training
- [ ] A user can hold two roles simultaneously and gets the union of both
- [ ] `has_column_privilege('authenticated','public.profiles','role','UPDATE')` returns `false`
- [ ] The admin Completions view lists all 115 historical completions and exports them
- [ ] No existing FTO or orientee workflow has regressed
