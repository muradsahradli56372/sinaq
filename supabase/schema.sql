-- =====================================================================
--  Elmira Fətəliyeva – Rəqəm Sistemləri Onlayn Sınaq
--  Run this whole file once in Supabase → SQL Editor → New query.
--  Safe to re-run: tables use "if not exists", functions use "or replace".
-- =====================================================================


-- ---------- Tables ----------------------------------------------------

create table if not exists public.students (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null check (char_length(full_name) between 2 and 120),
  class            text not null check (char_length(class) between 1 and 20),
  school           text check (school is null or char_length(school) <= 160),
  started_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  duration_seconds int
);

create table if not exists public.questions (
  id             serial primary key,
  position       int  not null unique,          -- order in the exam (1..25)
  text           text not null,
  image_url      text,
  option_a       text not null,
  option_b       text not null,
  option_c       text not null,
  option_d       text not null,
  option_e       text not null,
  correct_option text not null check (correct_option in ('A','B','C','D','E')),
  explanation    text
);

create table if not exists public.answers (
  id              bigserial primary key,
  student_id      uuid not null references public.students(id) on delete cascade,
  question_id     int  not null references public.questions(id) on delete cascade,
  selected_option text check (selected_option in ('A','B','C','D','E')), -- null = left blank
  is_correct      boolean not null default false,
  unique (student_id, question_id)
);

create index if not exists answers_question_idx on public.answers(question_id);

create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);
insert into public.settings (key, value) values ('show_explanations', 'false'::jsonb)
on conflict (key) do nothing;

-- Teachers allowed to open /admin (add your email below, see README)
create table if not exists public.admins (
  email text primary key
);

-- ---------- Admin check -----------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Row Level Security ---------------------------------------
-- Students (anonymous visitors) get NO direct table access.
-- They only use the functions further down.

alter table public.students  enable row level security;
alter table public.questions enable row level security;
alter table public.answers   enable row level security;
alter table public.settings  enable row level security;
alter table public.admins    enable row level security;

drop policy if exists "admin full access" on public.students;
drop policy if exists "admin full access" on public.questions;
drop policy if exists "admin full access" on public.answers;
drop policy if exists "admin full access" on public.settings;
drop policy if exists "admin read"        on public.admins;

create policy "admin full access" on public.students  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin full access" on public.questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin full access" on public.answers   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin full access" on public.settings  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read"        on public.admins    for select to authenticated using (public.is_admin());

revoke all on public.students, public.questions, public.answers, public.settings, public.admins from anon;

-- Logged-in users may touch the tables; the policies above then limit it to admins only.
grant select, insert, update, delete on public.students, public.questions, public.answers, public.settings to authenticated;
grant select on public.admins to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- Views for the dashboard (admin only via RLS) --------------

create or replace view public.student_results
with (security_invoker = true) as
select
  s.id, s.full_name, s.class, s.school, s.started_at, s.submitted_at, s.duration_seconds,
  coalesce(count(a.id) filter (where a.is_correct), 0)::int as correct_count,
  coalesce(count(a.id) filter (where a.selected_option is not null and not a.is_correct), 0)::int as wrong_count,
  coalesce(count(a.id) filter (where a.selected_option is null), 0)::int as blank_count,
  (select count(*) from public.questions)::int as total_questions
from public.students s
left join public.answers a on a.student_id = s.id
group by s.id;

create or replace view public.question_stats
with (security_invoker = true) as
select
  q.id, q.position, q.text,
  count(a.id)::int as attempts,
  count(a.id) filter (where a.is_correct)::int as correct
from public.questions q
left join public.answers a on a.question_id = q.id
group by q.id;

revoke all on public.student_results, public.question_stats from anon;
grant select on public.student_results, public.question_stats to authenticated;

-- ---------- Functions used by students (anonymous) --------------------

-- Questions WITHOUT correct answers or explanations.
create or replace function public.get_exam_questions()
returns table (
  id int, "position" int, "text" text, image_url text,
  option_a text, option_b text, option_c text, option_d text, option_e text
)
language sql stable security definer
set search_path = public
as $$
  select q.id, q.position, q.text, q.image_url,
         q.option_a, q.option_b, q.option_c, q.option_d, q.option_e
  from public.questions q
  order by q.position;
$$;

-- Registers a student and returns its id.
create or replace function public.start_exam(p_full_name text, p_class text, p_school text default null)
returns table (student_id uuid, student_started_at timestamptz)
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_started timestamptz;
begin
  if p_full_name is null or char_length(btrim(p_full_name)) < 2 then
    raise exception 'invalid_name';
  end if;
  if p_class is null or char_length(btrim(p_class)) < 1 then
    raise exception 'invalid_class';
  end if;

  insert into public.students (full_name, class, school)
  values (btrim(p_full_name), btrim(p_class), nullif(btrim(coalesce(p_school, '')), ''))
  returning id, started_at into v_id, v_started;

  return query select v_id, v_started;
end;
$$;

-- Grades on the server. Can be called only once per student.
-- p_answers example: {"1":"A","2":"C"}  (question id → chosen letter)
create or replace function public.submit_exam(p_student_id uuid, p_answers jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_student public.students%rowtype;
  v_elapsed int;
begin
  select * into v_student from public.students where id = p_student_id for update;
  if not found then
    raise exception 'student_not_found';
  end if;
  if v_student.submitted_at is not null then
    raise exception 'already_submitted';
  end if;

  insert into public.answers (student_id, question_id, selected_option, is_correct)
  select p_student_id, q.id, s.opt, coalesce(s.opt = q.correct_option, false)
  from public.questions q
  cross join lateral (
    select case
      when upper(p_answers ->> q.id::text) in ('A','B','C','D','E')
      then upper(p_answers ->> q.id::text)
    end as opt
  ) s;

  -- 1800 seconds = 30 minutes (keep in sync with EXAM_MINUTES in src/lib/types.ts)
  v_elapsed := least(greatest(extract(epoch from (now() - v_student.started_at))::int, 0), 1800);

  update public.students
     set submitted_at = now(), duration_seconds = v_elapsed
   where id = p_student_id;
end;
$$;

create or replace function public.get_public_settings()
returns table (show_explanations boolean)
language sql stable security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::boolean from public.settings where key = 'show_explanations'), false);
$$;

-- Returns explanations only if the teacher enabled them AND the student already submitted.
create or replace function public.get_explanations(p_student_id uuid)
returns table (
  question_id int, "position" int, "text" text,
  option_a text, option_b text, option_c text, option_d text, option_e text,
  selected_option text, correct_option text, explanation text
)
language plpgsql stable security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not coalesce((select (value #>> '{}')::boolean from public.settings where key = 'show_explanations'), false) then
    return;
  end if;

  return query
  select q.id, q.position, q.text,
         q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
         a.selected_option, q.correct_option, q.explanation
  from public.questions q
  join public.answers  a on a.question_id = q.id and a.student_id = p_student_id
  join public.students s on s.id = p_student_id and s.submitted_at is not null
  order by q.position;
end;
$$;

revoke all on function public.get_exam_questions()                 from public;
revoke all on function public.start_exam(text, text, text)         from public;
revoke all on function public.submit_exam(uuid, jsonb)             from public;
revoke all on function public.get_public_settings()                from public;
revoke all on function public.get_explanations(uuid)               from public;
revoke all on function public.is_admin()                           from public;

grant execute on function public.get_exam_questions()              to anon, authenticated;
grant execute on function public.start_exam(text, text, text)      to anon, authenticated;
grant execute on function public.submit_exam(uuid, jsonb)          to anon, authenticated;
grant execute on function public.get_public_settings()             to anon, authenticated;
grant execute on function public.get_explanations(uuid)            to anon, authenticated;
grant execute on function public.is_admin()                        to anon, authenticated;
