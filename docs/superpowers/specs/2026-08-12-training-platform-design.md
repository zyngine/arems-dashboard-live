# AREMS Training Platform — Design

**Date:** 2026-08-12
**Status:** Approved for planning
**Scope:** Expand the AREMS FTO dashboard into an organization-wide training platform.

---

## 1. Problem

The dashboard today serves two populations: FTOs and orientees. Everyone else at the agency
is locked out of training by a structural fact, not a UI gap:

```js
// src/lib/database.js:216
markTrainingComplete(orienteeId, materialId)
```

`training_completions` is keyed to `orientee_id`. A paramedic who is not an orientee has no row
that can record they finished anything. The `employee` role is not even present in the Training
nav item (`src/components/Dashboard.js:53`).

Separately, `cert_level` (EMT / AEMT / Paramedic) exists only on the `orientees` table. Staff who
are not orientees have no certification level recorded anywhere in the system.

The agency runs a third-party LMS that cannot be modified. This platform **supplements** that LMS —
it never replaces it.

## 2. Goals

1. Any employee can be assigned training, complete it, and have that completion recorded.
2. Admins can build a test and attach it to training content.
3. Admins can open a class and see a roster: who completed it and when.
4. Completion can produce a certificate.
5. Training can be assigned to groups, not just individuals.
6. Content can require a signed acknowledgment.
7. Rosters export to CSV.
8. An uploaded slide deck is presented one slide at a time, and the employee must click
   through all of it before the test unlocks.
9. The whole thing works well on a phone.

## 3. Non-goals

Explicitly out of scope, because the LMS already does them:

- Video hosting or streaming
- SCORM / xAPI / AICC packages
- Seat-time or watch-percentage tracking
- Migrating existing LMS course content
- Replacing the LMS as system of record for its own courses

Also out of scope: server-side `.pptx` → PDF conversion. Decks are uploaded as PDF, exported
from PowerPoint. Reasoning in §8.1.

Also out of scope for now: converting the FTO orientation process itself into a course
(considered and deferred — see §12).

## 4. Identity model

Two independent axes.

| Axis | Cardinality | Values |
|---|---|---|
| `cert_level` | one per person | `EMT`, `AEMT`, `Paramedic`, or null |
| roles | many per person | `admin`, `lead_fto`, `fto`, `orientee`, `employee` |

"EMT / FTO" is `cert_level: 'EMT'` + roles `['fto', 'employee']`.

`cert_level` is single-valued because EMS certifications ladder — a Paramedic does not
separately hold EMT. No new roles are introduced: "preceptor" is the existing `fto` role and
"new hire" is the existing `orientee` role.

### 4.1 Schema

```sql
alter table profiles add column cert_level text
  check (cert_level in ('EMT','AEMT','Paramedic'));

create table user_roles (
  user_id uuid references profiles(id) on delete cascade,
  role    text not null
          check (role in ('admin','lead_fto','fto','orientee','employee')),
  primary key (user_id, role)
);
```

### 4.2 Migration strategy for `profiles.role`

`role` is compared as a scalar in 25 places in `Dashboard.js` (`role === 'admin'` ×10,
`role === 'orientee'` ×8, `lead_fto` ×4, `fto` ×4, `employee` ×2).

`profiles.role` is **retained** and redefined as a *derived primary role* — the
highest-privilege role the user holds, by this precedence:

```
admin > lead_fto > fto > orientee > employee
```

It is maintained by a trigger on `user_roles` and used only for display and for legacy call
sites. New code uses `hasRole(profile, 'fto')` from `src/lib/roles.js`. Existing comparison
sites migrate to `hasRole()` incrementally, not in one cutover.

Backfill: every existing `profiles.role` value becomes one `user_roles` row.

## 5. Re-basing training on users

`training_completions` moves from orientee-scoped to user-scoped.

```sql
alter table training_completions add column user_id uuid references profiles(id);
```

**Edge case that forbids a simple rename:** `orientees.user_id` is nullable. The `temp_name`
path (`src/lib/database.js:81`, `:148`) exists so an orientee can be created before they
register an account. Those rows have no user to point at.

Migration:

1. Add `user_id` nullable.
2. Backfill `user_id` from `orientees.user_id` where it is non-null.
3. Leave `orientee_id` in place on legacy rows. Do not drop it.
4. New writes always set `user_id`. `orientee_id` is written only when the completion
   occurred inside an FTO context.
5. `link_orientee_by_email` (the existing RPC) additionally backfills `user_id` on that
   orientee's historical completion rows at link time.

No data is lost and no row is orphaned.

## 6. Courses

A **course** is the assignable unit: 1..n content items, plus an optional test, plus an
optional attestation. Everything the agency cares about — due dates, CEU hours, rosters,
certificates, recurrence — attaches to a course rather than to a bare link.

```sql
create table courses (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  cert_levels   text[],            -- which tiers this applies to; null = all
  ceu_hours     numeric(5,2),
  ceu_category  text check (ceu_category in ('National','Local','Individual')),
  recurrence    text not null default 'none'
                check (recurrence in ('none','annual','biennial')),
  is_published  boolean not null default false,
  enforce_sequence boolean not null default true,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);

create table course_items (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references courses(id) on delete cascade,
  position         int  not null,
  kind             text not null check (kind in ('material','attestation','deck','quiz')),
  material_id      uuid references training_materials(id),
  attestation_text text,
  deck_url         text,           -- Supabase Storage path to the PDF
  deck_page_count  int,
  quiz_id          uuid,           -- FK added in Phase 3
  unique (course_id, position),
  check (kind <> 'deck' or (deck_url is not null and deck_page_count > 0))
);
```

Existing `training_materials` rows are preserved as-is and become content items. Any material
not referenced by a course is presented as a single-item course so the Training Library keeps
working from day one.

CEU categories follow the NREMT NCCP split: National, Local, Individual.

## 7. Assignment

```sql
create table course_assignments (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses(id) on delete cascade,
  audience_type text not null
                check (audience_type in ('everyone','role','cert_level','shift','individual')),
  audience_value text,             -- 'fto' | 'Paramedic' | 'A Shift' | <user_id>; null for 'everyone'
  due_at        timestamptz,
  assigned_by   uuid references profiles(id),
  created_at    timestamptz not null default now()
);

create table enrollments (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  assignment_id uuid references course_assignments(id) on delete set null,
  status        text not null default 'assigned'
                check (status in ('assigned','in_progress','complete')),
  assigned_at   timestamptz not null default now(),
  due_at        timestamptz,
  completed_at  timestamptz,
  unique (course_id, user_id)
);

create table item_progress (
  id                     uuid primary key default gen_random_uuid(),
  enrollment_id          uuid not null references enrollments(id) on delete cascade,
  course_item_id         uuid not null references course_items(id) on delete cascade,
  completed_at           timestamptz,
  attestation_signature  text,
  attestation_signed_at  timestamptz,
  pages_viewed           int[] not null default '{}',   -- deck items only
  unique (enrollment_id, course_item_id)
);
```

### 7.1 Materialized, not live

Creating an assignment **expands the audience into concrete `enrollments` rows**. Rosters are
not recomputed from current profile state.

This is deliberate. If "all Paramedics" were resolved live, promoting an EMT to Paramedic in
December would retroactively add them to a class that closed in March, and someone who left
the agency would vanish from a roster you may need for an inspection. A roster must be a
record of what happened.

A **Re-sync** action on each assignment adds newly-matching users (new hires) without
disturbing existing rows. It never removes enrollments.

Multiple assignments may target one course — "all Paramedics" plus three named individuals.
The `unique (course_id, user_id)` constraint means overlapping audiences produce one
enrollment, not duplicates.

### 7.2 Overdue and recurrence

**Overdue is derived, never stored.** An enrollment is overdue when
`status <> 'complete' and due_at < now()`. Storing it would require a scheduled job to keep a
column truthful, and a column that lies when the job fails is worse than no column. Deriving it
is a cheap predicate in both SQL and the UI, and it cannot drift.

On a course with `recurrence` set, completing an enrollment schedules the next one at
`completed_at + interval`. Recurrence math lives in a pure, tested function — off-by-one-year
errors here are invisible until an audit.

## 8. Slide decks

An admin uploads a slide deck and the employee clicks through it one slide at a time before
the course will let them reach the test.

### 8.1 Format: PDF

Decks are uploaded as **PDF**, exported from PowerPoint (`File → Export → PDF`). The browser
renders them page by page with `pdf.js`.

Accepting `.pptx` directly was considered and rejected. A `.pptx` is a zip of XML, and
rendering one faithfully requires either an external conversion API or a self-hosted
LibreOffice container — Supabase Edge Functions run Deno and cannot do it natively. That is a
paid dependency, a new API key, a queue, and a new class of upload failure, bought in exchange
for removing one click from the admin's workflow. PDF costs nothing, renders offline, and has
perfect fidelity because PowerPoint itself did the rendering.

Consequence to accept: the admin must export before uploading. If that friction ever becomes a
real complaint, `.pptx` auto-conversion can be layered on top without changing anything below —
the PDF renderer is needed either way.

The PDF is stored in Supabase Storage. `deck_page_count` is read from the document at upload
time and stored, so progress can be evaluated without loading the file.

### 8.2 Progression

- One slide per screen. Forward, back, and a progress indicator.
- On mobile: swipe, with large touch targets.
- `item_progress.pages_viewed` accumulates each page number actually displayed.
- The deck item completes when `pages_viewed` covers every page — **not** when the last page is
  reached. Otherwise jumping straight to the final slide would mark the deck done.
- Progress is written as the employee advances, so closing the browser mid-deck loses nothing.

### 8.3 Sequential gating

When `courses.enforce_sequence` is true (the default), a course item cannot be started until
every item before it is complete.

**This is enforced in the database, not in the UI.** A disabled "Start test" button stops
nobody — the quiz rows are one client call away. So `start_quiz_attempt` verifies that all
preceding `course_items` for that enrollment are complete and refuses otherwise. The disabled
button is a courtesy; the function is the control.

This is the same principle as §9.1: any rule that matters is enforced where the client cannot
reach it.

## 9. Tests

```sql
create table quizzes (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references courses(id) on delete cascade,
  title               text not null,
  passing_score       int  not null default 80,   -- percent
  max_attempts        int  not null default 3,    -- 0 = unlimited
  time_limit_minutes  int,                        -- null = untimed
  randomize_questions boolean not null default false,
  randomize_options   boolean not null default false,
  show_answers_after  text not null default 'pass'
                      check (show_answers_after in ('never','pass','always'))
);

create table questions (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references quizzes(id) on delete cascade,
  position    int  not null,
  kind        text not null
              check (kind in ('single','multi','true_false','short_answer')),
  prompt      text not null,
  points      int  not null default 1,
  explanation text,
  accepted_answers text[],          -- short_answer only; see §9.1
  check (kind <> 'short_answer' or accepted_answers is not null)
);

create table question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  position    int  not null,
  text        text not null,
  is_correct  boolean not null default false
);

create table quiz_attempts (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references quizzes(id) on delete cascade,
  enrollment_id  uuid references enrollments(id) on delete cascade,
  user_id        uuid not null references profiles(id) on delete cascade,
  attempt_number int  not null,
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  score          numeric(5,2),
  passed         boolean,
  unique (quiz_id, user_id, attempt_number)
);

create table attempt_answers (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references quiz_attempts(id) on delete cascade,
  question_id         uuid not null references questions(id) on delete cascade,
  selected_option_ids uuid[],
  text_answer         text,
  points_awarded      numeric(5,2)
);
```

### 9.1 Answers must never reach the client ungraded

Supabase returns whatever RLS permits. If `question_options.is_correct` is readable by the
person taking the test, they can read the answer key out of devtools or the network tab.

Therefore:

- RLS on `question_options` exposes `is_correct` **only** to `admin`.
- Test-takers read questions and options through a view that omits `is_correct`.
- Grading happens in a `security definer` Postgres function, `submit_quiz_attempt(attempt_id, answers jsonb)`,
  which writes `attempt_answers`, computes `score`, sets `passed`, and returns only the
  outcome. No grading logic runs in the browser.
- `show_answers_after` is enforced inside that function, not by hiding UI.

Short-answer questions are graded by exact, case-insensitive, whitespace-trimmed match against
`questions.accepted_answers`. Anything requiring judgment is out of scope; use a
`multi`/`single` question instead.

A quiz belongs to exactly one course, and a `course_items` row of kind `quiz` may only
reference a quiz whose `course_id` matches that item's course. Enforced by a composite foreign
key on `(quiz_id, course_id)` so the two paths cannot disagree.

### 9.2 Attempt rules

Failing consumes an attempt and permits a retake while `attempt_number < max_attempts`. Failure
does **not** force re-consuming the content. When attempts are exhausted, the enrollment stays
incomplete and is surfaced to admins on the roster.

## 10. Certificates

```sql
create table certificates (
  id                     uuid primary key default gen_random_uuid(),
  enrollment_id          uuid not null unique references enrollments(id) on delete cascade,
  user_id                uuid not null references profiles(id),
  course_id              uuid not null references courses(id),
  certificate_number     text not null unique,     -- 'AREMS-2026-000123'
  issued_at              timestamptz not null default now(),
  expires_at             timestamptz,
  ceu_hours              numeric(5,2),
  ceu_category           text,
  recipient_name_snapshot text not null,
  course_title_snapshot   text not null,
  cert_level_snapshot     text
);
```

The `_snapshot` columns are the substance of this table. Renaming a course in 2027 must not
alter a certificate issued in 2026. A certificate is an immutable record of an event, not a
live view of current data.

Issued automatically when an enrollment reaches `complete`. `expires_at` is derived from the
course `recurrence`; `none` means null.

`certificate_number` is `'AREMS-' || <issue year> || '-' || lpad(nextval('certificate_seq'), 6, '0')`,
generated by a Postgres sequence inside the issuing function. A sequence rather than a
`count(*)`-based scheme, because two people completing a course in the same instant must not
race for the same number — and the `unique` constraint would turn that race into a failed
completion.

**Rendering:** a print-optimized HTML view plus `window.print()`. Zero new dependencies, and it
works on a phone. Includes agency logo, recipient, course, issue date, CEU hours and category,
certificate number, and a signature block.

**Verification:** a public, unauthenticated route `/verify/<certificate_number>` renders
issue date, course title, recipient name, and validity. It exposes nothing else about the
person. This lets an inspector or another agency confirm a certificate without an account.

## 11. Cross-cutting

### 11.1 Roster and CSV export

The roster view for a course lists every enrollment with name, cert level, roles, assigned
date, completion date, quiz score, attempts used, and certificate number. Filterable by
status, cert level, role, and shift.

Export is generated client-side — no dependency. The CSV writer handles the cases that break
naive implementations: embedded commas, embedded double quotes, newlines inside fields, and a
leading `=`/`+`/`-`/`@` (spreadsheet formula injection).

### 11.2 Mobile

Current layout is a fixed `250px` sidebar with inline pixel styling and no breakpoints
anywhere in the codebase.

- `useMediaQuery` hook in `src/components/ui/`.
- Below 768px: sidebar becomes a drawer, plus a bottom tab bar for primary navigation.
- All new training views are built responsive from their first commit.
- Test-taking is designed mobile-first: one question per screen, large touch targets,
  progress indicator, and answers persisted per question so a dropped connection or a
  backgrounded browser does not lose an in-progress attempt.
- Deck viewing is mobile-first for the same reason: one slide per screen, swipe to advance,
  pinch to zoom, and page progress written as it happens. A crew member reading a protocol
  deck in the bay is the expected case, not the exception.
- Existing views are made responsive only where the work already requires touching them.

### 11.3 File layout

```
src/lib/roles.js                    hasRole, primaryRole, canAssign
src/lib/csv.js                      CSV escaping and download
src/lib/training/courses.js
src/lib/training/assignments.js     audience resolution, re-sync, recurrence
src/lib/training/quizzes.js
src/lib/training/certificates.js
src/components/ui/                  useMediaQuery, responsive primitives
src/components/training/CourseList.jsx
src/components/training/CourseDetail.jsx
src/components/training/CourseEditor.jsx
src/components/training/DeckPlayer.jsx
src/components/training/QuizBuilder.jsx
src/components/training/QuizPlayer.jsx
src/components/training/RosterView.jsx
src/components/training/CertificateView.jsx
```

`Dashboard.js` is 115 KB with every view inlined. New surfaces go in their own files. Existing
code is extracted only where the work already requires modifying it. No speculative refactor.

### 11.4 Error handling

The codebase currently uses `alert()` for errors and `console.log` for diagnostics. New code:

- Database helpers keep the existing `{ data, error }` return convention for consistency.
- Views render inline error state rather than `alert()`.
- Quiz submission failure preserves the attempt locally and offers retry — a lost submission
  after a completed test is the worst failure mode in this system.
- Assignment expansion is transactional: a partially expanded audience must not be possible.

### 11.5 Testing

`package.json` has no `test` script. `react-scripts` bundles Jest, so adding one is a
single line.

Coverage targets the pure logic where mistakes are expensive and silent:

| Area | Why |
|---|---|
| Quiz grading | Wrong score = wrong certification record |
| Audience → enrollment resolution | Wrong roster = compliance gap |
| Recurrence date math | Off-by-one-year errors are invisible until audit |
| `hasRole` / `primaryRole` | Governs access to everything |
| CSV escaping | Silent data corruption in exports |
| Certificate numbering | Uniqueness and format stability |
| Deck completion (`pages_viewed` → complete) | A gap here lets someone skip required content |
| Sequential gating predicate | Same — it is the lock on the test |

UI is not unit-tested.

### 11.6 Dependencies

The project currently depends only on React, ReactDOM, `@supabase/supabase-js`, and
`react-scripts`. This design adds exactly one runtime dependency:

- **`pdfjs-dist`** — renders deck PDFs page by page in the browser.

Everything else (CSV export, certificate rendering, responsive layout) is built without new
packages. No new hosted service, API key, or recurring cost is introduced.

### 11.7 Security note (pre-existing, out of scope for these phases)

`src/lib/database.js:364` contains a hardcoded Resend API key in a public repository. It is
tracked separately: the key must be revoked and email sending moved into a Supabase Edge
Function. Client-side code cannot hold a secret, so an environment variable is not a fix.

## 12. Deferred

Converting FTO orientation into a course type — making the 96-hour process, skill check-offs,
and evaluations all courses — is the correct eventual shape. It is deferred because it rewrites
software the FTOs depend on today to gain elegance nobody asked for. Nothing in this design
blocks it.

Also deferred, in rough priority order should they be wanted later: credential and license
expiration tracking with 90/60/30-day reminders, in-person class attendance rosters, a
reusable question bank shared across tests, and remediation flows that re-require content
after a failed attempt.

## 13. Phases

Each phase is independently useful and shippable.

| Phase | Delivers | Rationale |
|---|---|---|
| **1** | `cert_level` on profiles, multi-role via `user_roles`, `hasRole()`, `training_completions` re-based to `user_id`, Training visible to `employee`, completion report + CSV export | Nothing else can work until a non-orientee can complete something |
| **2** | Courses, course items, slide decks (PDF upload + click-through player), group assignment, enrollments, roster view, attestation/acknowledgment, responsive shell | Assignment and roster both require `enrollments`, so they land with courses — not before. Decks are a course item kind, so they belong here too |
| **3** | Test builder, mobile test player, server-side grading, sequential gating enforcement | Largest subsystem; needs a stable course model beneath it. Gating lands here because the thing being gated is the test |
| **4** | Certificates, CEU hours, public verification page | Only meaningful once a test can be passed |

Group assignment, the per-class roster, and courses are one unit of work. They were originally
scoped into Phase 1, which was wrong — a roster is a list of enrollments, and there are no
enrollments until a course exists to enrol in. Phase 1 still ships a useful admin view: who
completed which existing training material and when, exportable to CSV.

Each phase gets its own implementation plan.
