-- =====================================================================
-- Lern-Cockpit · Migration 003 · Lern-Engine
--
-- Was diese Migration tut
--   1. Neue Tabellen für das Lernsystem (Fächer, Themen, Unterthemen,
--      Übungen, Vokabel-Sammlungen, Lernereignisse, Trainings-Sessions,
--      Profile) – alle mit user_id und Row Level Security.
--   2. Bestehende Tabellen bekommen eine user_id-Spalte (noch ohne
--      Sperre, damit die Routinen weiterlaufen) und Vokabeln die Felder
--      für Spaced Repetition.
--   3. claim_legacy_data(): ordnet bestehende Zeilen ohne Besitzer dem
--      ersten registrierten Konto (= dir) zu. Die App ruft das nach dem
--      Login automatisch auf.
--
-- Mehrfach ausführbar (idempotent). Keine Daten werden gelöscht.
-- Danach: 004_lockdown_legacy.sql (siehe docs/SETUP.md).
-- =====================================================================

-- gen_random_uuid() ist seit Postgres 13 eingebaut.

-- ---------------------------------------------------------------------
-- Besitzer der Installation: das zuerst registrierte Konto
-- ---------------------------------------------------------------------
create or replace function public.app_owner()
returns uuid
language sql stable security definer
set search_path = public, auth
as $$
  select id from auth.users order by created_at asc, id asc limit 1
$$;
revoke all on function public.app_owner() from public, anon;
grant execute on function public.app_owner() to authenticated;

-- ---------------------------------------------------------------------
-- Profile
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text,
  email         text,
  daily_minutes integer not null default 30 check (daily_minutes between 5 and 240),
  created_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Fächer
-- ---------------------------------------------------------------------
create table if not exists public.subjects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null check (length(name) between 1 and 80),
  color         text,
  icon          text,
  language_code text,                         -- z. B. 'fr', 'en' für Sprachfächer
  created_at    timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------
-- Bestehende Tabellen: Besitzer-Spalte (Sperre folgt in 004)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['hausaufgaben','klausuren','vokabeln','neuigkeiten','noten','lernlog','einstellungen','termine','stundenplan_aenderungen']
  loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I add column if not exists user_id uuid references auth.users(id) on delete cascade', t);
      execute format('create index if not exists %I on public.%I (user_id)', t||'_user_idx', t);
    end if;
  end loop;
end $$;

-- Prüfungen = bestehende Tabelle "klausuren"
alter table public.klausuren add column if not exists subject_id uuid references public.subjects(id) on delete set null;
alter table public.klausuren add column if not exists description text;
alter table public.klausuren add column if not exists created_at timestamptz default now();
alter table public.klausuren add column if not exists topics_migrated boolean not null default false;

-- ---------------------------------------------------------------------
-- Vokabel-Sammlungen
-- ---------------------------------------------------------------------
create table if not exists public.vocab_collections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id      uuid references public.subjects(id) on delete set null,
  name            text not null check (length(name) between 1 and 80),
  description     text,
  source_language text not null default 'fr',     -- Sprache des Begriffs
  target_language text not null default 'de',     -- Sprache der Übersetzung
  created_at      timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists vocab_collections_user_idx on public.vocab_collections (user_id);

-- Vokabeln = bestehende Tabelle "vokabeln" (begriff = term, bedeutung = translation)
alter table public.vokabeln add column if not exists subject_id       uuid references public.subjects(id) on delete set null;
alter table public.vokabeln add column if not exists collection_id    uuid references public.vocab_collections(id) on delete cascade;
alter table public.vokabeln add column if not exists source_language  text;
alter table public.vokabeln add column if not exists target_language  text;
alter table public.vokabeln add column if not exists alternatives     text[] not null default '{}';
alter table public.vokabeln add column if not exists example_sentence text;
alter table public.vokabeln add column if not exists notes            text;
alter table public.vokabeln add column if not exists difficulty       smallint not null default 2 check (difficulty between 1 and 3);
alter table public.vokabeln add column if not exists mastery          smallint not null default 0 check (mastery between 0 and 100);
alter table public.vokabeln add column if not exists interval_days    numeric(7,2) not null default 0;
alter table public.vokabeln add column if not exists ease             numeric(4,2) not null default 2.5;
alter table public.vokabeln add column if not exists reps             integer not null default 0;
alter table public.vokabeln add column if not exists lapses           integer not null default 0;
alter table public.vokabeln add column if not exists next_review_at   timestamptz;
alter table public.vokabeln add column if not exists last_reviewed_at timestamptz;
alter table public.vokabeln add column if not exists last_result      text check (last_result in ('correct','almost','wrong'));
alter table public.vokabeln add column if not exists correct_count    integer not null default 0;
alter table public.vokabeln add column if not exists incorrect_count  integer not null default 0;
alter table public.vokabeln add column if not exists created_at       timestamptz default now();
create index if not exists vokabeln_due_idx        on public.vokabeln (user_id, next_review_at);
create index if not exists vokabeln_collection_idx on public.vokabeln (collection_id);

-- Bisherige Level (0–5) einmalig in Intervalle übersetzen. Betroffen sind
-- nur Karten, die noch nie im neuen System abgefragt wurden.
update public.vokabeln
set interval_days  = (array[0,1,2,4,7,14,30])[least(greatest(coalesce(level,0),0),6)+1],
    reps           = least(greatest(coalesce(level,0),0),6),
    next_review_at = coalesce(next_review_at, case when next is not null then (next::date)::timestamptz end)
where last_reviewed_at is null and reps = 0 and coalesce(level,0) > 0;

-- ---------------------------------------------------------------------
-- Themen → Unterthemen → Übungen
-- (exam_id übernimmt den Typ von klausuren.id, egal ob uuid oder bigint)
-- ---------------------------------------------------------------------
create table if not exists public.topics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id  uuid references public.subjects(id) on delete set null,
  title       text not null check (length(title) between 1 and 160),
  description text,
  priority    smallint not null default 2 check (priority between 1 and 3),
  status      text not null default 'active' check (status in ('active','paused','done')),
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.subtopics (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic_id      uuid not null references public.topics(id) on delete cascade,
  title         text not null check (length(title) between 1 and 160),
  description   text,
  difficulty    smallint not null default 2 check (difficulty between 1 and 3),
  mastery_score smallint check (mastery_score between 0 and 100),   -- Cache, berechnet aus learning_events
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.exercises (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subtopic_id     uuid not null references public.subtopics(id) on delete cascade,
  type            text not null check (type in ('multiple_choice','free_text','translation','matching','short_writing')),
  difficulty      smallint not null default 2 check (difficulty between 1 and 3),
  question        text not null check (length(question) between 1 and 8000),
  options         jsonb,          -- multiple_choice: ["A","B",…] · matching: [["links","rechts"],…]
  correct_index   smallint,       -- multiple_choice
  expected_answer text,
  solution        text,
  source          text not null default 'user' check (source in ('user','ai')),
  created_at      timestamptz not null default now()
);

create table if not exists public.learning_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject     text,
  subject_id  uuid references public.subjects(id) on delete set null,
  topic_id    uuid references public.topics(id) on delete set null,
  subtopic_id uuid references public.subtopics(id) on delete set null,
  exercise_id uuid references public.exercises(id) on delete set null,
  session_id  uuid,
  type        text not null check (type in ('vocabulary_wrong','vocabulary_correct','exercise_wrong','exercise_correct','ai_feedback','exam_result','self_assessment')),
  result      numeric(4,3) check (result between 0 and 1),
  difficulty  smallint check (difficulty between 1 and 3),
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.training_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mode           text not null check (mode in ('vocab','errors','mixed','exam','topic','free')),
  status         text not null default 'active' check (status in ('idle','active','paused','completed','abandoned')),
  label          text,
  subject        text,
  subject_id     uuid references public.subjects(id) on delete set null,
  topic_id       uuid references public.topics(id) on delete set null,
  subtopic_id    uuid references public.subtopics(id) on delete set null,
  collection_id  uuid references public.vocab_collections(id) on delete set null,
  direction      text check (direction in ('forward','reverse')),
  started_at     timestamptz not null default now(),
  paused_at      timestamptz,
  completed_at   timestamptz,
  time_limit_s   integer check (time_limit_s is null or time_limit_s between 60 and 14400),
  active_seconds integer not null default 0,
  question_count integer not null default 0,
  current_index  integer not null default 0,
  correct_count  integer not null default 0,
  wrong_count    integer not null default 0,
  score          numeric(4,3) check (score between 0 and 1),
  state          jsonb,          -- Snapshot zum Wiederherstellen nach einem Reload
  updated_at     timestamptz not null default now()
);

-- Spalten, deren Typ vom Typ der bestehenden IDs abhängt
do $$
declare kt text; vt text;
begin
  select format_type(atttypid, atttypmod) into kt from pg_attribute where attrelid = 'public.klausuren'::regclass and attname = 'id';
  select format_type(atttypid, atttypmod) into vt from pg_attribute where attrelid = 'public.vokabeln'::regclass and attname = 'id';
  execute format('alter table public.topics            add column if not exists exam_id %s references public.klausuren(id) on delete cascade', kt);
  execute format('alter table public.learning_events   add column if not exists exam_id %s references public.klausuren(id) on delete set null', kt);
  execute format('alter table public.learning_events   add column if not exists vocab_id %s references public.vokabeln(id) on delete set null', vt);
  execute format('alter table public.training_sessions add column if not exists exam_id %s references public.klausuren(id) on delete set null', kt);
end $$;

create index if not exists topics_user_idx        on public.topics (user_id);
create index if not exists topics_exam_idx        on public.topics (exam_id);
create index if not exists subtopics_topic_idx    on public.subtopics (topic_id);
create index if not exists exercises_subtopic_idx on public.exercises (subtopic_id);
create index if not exists events_user_time_idx   on public.learning_events (user_id, created_at desc);
create index if not exists events_subtopic_idx    on public.learning_events (subtopic_id, created_at desc);
create index if not exists events_vocab_idx       on public.learning_events (vocab_id);
create index if not exists sessions_user_idx      on public.training_sessions (user_id, started_at desc);
create index if not exists sessions_status_idx    on public.training_sessions (user_id, status);

-- ---------------------------------------------------------------------
-- Row Level Security für alle neuen Tabellen
-- Ein Nutzer sieht und ändert ausschließlich eigene Zeilen. Verknüpfungen
-- dürfen nur auf eigene Elternzeilen zeigen.
-- ---------------------------------------------------------------------
create or replace function public.owns_exam(eid anyelement)
returns boolean language sql stable security definer set search_path = public as $$
  select eid is null or exists (select 1 from public.klausuren k where k.id = eid and k.user_id = auth.uid())
$$;

alter table public.profiles          enable row level security;
alter table public.subjects          enable row level security;
alter table public.vocab_collections enable row level security;
alter table public.topics            enable row level security;
alter table public.subtopics         enable row level security;
alter table public.exercises         enable row level security;
alter table public.learning_events   enable row level security;
alter table public.training_sessions enable row level security;

drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists subjects_own on public.subjects;
create policy subjects_own on public.subjects for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists collections_own on public.vocab_collections;
create policy collections_own on public.vocab_collections for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and (subject_id is null or exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = auth.uid())));

drop policy if exists topics_own on public.topics;
create policy topics_own on public.topics for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_exam(exam_id)
    and (subject_id is null or exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = auth.uid())));

drop policy if exists subtopics_own on public.subtopics;
create policy subtopics_own on public.subtopics for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.topics t where t.id = topic_id and t.user_id = auth.uid()));

drop policy if exists exercises_own on public.exercises;
create policy exercises_own on public.exercises for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.subtopics s where s.id = subtopic_id and s.user_id = auth.uid()));

drop policy if exists events_own on public.learning_events;
create policy events_own on public.learning_events for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_exam(exam_id)
    and (subtopic_id is null or exists (select 1 from public.subtopics s where s.id = subtopic_id and s.user_id = auth.uid())));

drop policy if exists sessions_own on public.training_sessions;
create policy sessions_own on public.training_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_exam(exam_id));

-- Anonymer Zugriff auf neue Tabellen: keiner
revoke all on public.profiles, public.subjects, public.vocab_collections, public.topics, public.subtopics,
              public.exercises, public.learning_events, public.training_sessions from anon;
grant select, insert, update, delete on public.profiles, public.subjects, public.vocab_collections, public.topics,
              public.subtopics, public.exercises, public.learning_events, public.training_sessions to authenticated;

-- ---------------------------------------------------------------------
-- Bestehende Daten übernehmen
-- Nur das zuerst registrierte Konto darf das; betroffen sind nur Zeilen
-- ohne Besitzer. Gibt die Anzahl übernommener Zeilen je Tabelle zurück.
-- ---------------------------------------------------------------------
create or replace function public.claim_legacy_data()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  t text;
  n integer;
  result jsonb := '{}'::jsonb;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if me <> public.app_owner() then
    return jsonb_build_object('skipped', 'not_owner');
  end if;
  foreach t in array array['hausaufgaben','klausuren','vokabeln','neuigkeiten','noten','lernlog','einstellungen','termine','stundenplan_aenderungen']
  loop
    if to_regclass('public.'||t) is not null then
      execute format('update public.%I set user_id = $1 where user_id is null', t) using me;
      get diagnostics n = row_count;
      if n > 0 then result := result || jsonb_build_object(t, n); end if;
    end if;
  end loop;
  insert into public.profiles (id, email)
    select id, email from auth.users where id = me
  on conflict (id) do nothing;
  return result;
end $$;
revoke all on function public.claim_legacy_data() from public, anon;
grant execute on function public.claim_legacy_data() to authenticated;

-- Schema-Version für die App
create or replace function public.lern_engine_version()
returns integer language sql immutable as $$ select 3 $$;
grant execute on function public.lern_engine_version() to anon, authenticated;
