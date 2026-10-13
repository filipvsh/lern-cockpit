-- =====================================================================
-- Lern-Cockpit · Migration 006 · Material (PDFs, Bilder, Zeichenblätter)
--
-- Legt den Dateispeicher „material“ (Supabase Storage) und die Tabelle
-- „dokumente“ an. Wie seit 005 ohne Anmeldung nutzbar.
-- Voraussetzung: 005 ist gelaufen. Mehrfach ausführbar.
-- =====================================================================

-- Dateispeicher: öffentlich lesbar (Link genügt), max. 25 MB, nur PDF und Bilder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('material', 'material', true, 26214400, array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists material_open on storage.objects;
create policy material_open on storage.objects for all to anon, authenticated
  using (bucket_id = 'material') with check (bucket_id = 'material');

-- Verzeichnis der Dateien
create table if not exists public.dokumente (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default public.current_owner() references auth.users(id) on delete cascade,
  title       text not null,
  fach        text,
  exam_ref    text,                       -- id der Prüfung (als Text, unabhängig vom Typ von klausuren.id)
  kind        text not null default 'pdf' check (kind in ('pdf', 'bild', 'skizze')),
  path        text not null,
  size        integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists dokumente_user_idx on public.dokumente (user_id, created_at desc);
alter table public.dokumente enable row level security;

drop policy if exists dokumente_open on public.dokumente;
create policy dokumente_open on public.dokumente for all to anon using (true) with check (true);
drop policy if exists dokumente_own on public.dokumente;
create policy dokumente_own on public.dokumente for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.dokumente to anon, authenticated;

-- Version 6 = Material verfügbar
create or replace function public.lern_engine_version()
returns integer language sql immutable as $$ select 6 $$;
grant execute on function public.lern_engine_version() to anon, authenticated;
