-- =====================================================================
-- Lern-Cockpit · Migration 004 · Bestehende Tabellen absichern
--
-- ERST AUSFÜHREN, WENN
--   • 003 gelaufen ist,
--   • du dich in der App angemeldet hast (dabei werden deine bestehenden
--     Daten automatisch deinem Konto zugeordnet), und
--   • deine Routinen (Morgen-Check, 17-Uhr-Review, Aushang-Erfassung) den
--     service_role-Schlüssel statt des anon-Schlüssels verwenden.
--     Der service_role-Schlüssel umgeht RLS und gehört NIE ins Frontend.
--
-- Danach gilt für alle Tabellen: nur der angemeldete Besitzer sieht und
-- ändert seine Zeilen. Zeilen, die Routinen ohne user_id anlegen, werden
-- per Trigger automatisch dem Besitzer der Installation zugeordnet.
-- =====================================================================

create or replace function public.set_owner()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := coalesce(auth.uid(), public.app_owner());
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['hausaufgaben','klausuren','vokabeln','neuigkeiten','noten','lernlog','einstellungen','termine','stundenplan_aenderungen']
  loop
    if to_regclass('public.'||t) is not null then
      -- verbleibende Zeilen ohne Besitzer übernehmen
      execute format('update public.%I set user_id = public.app_owner() where user_id is null', t);
      execute format('drop trigger if exists set_owner on public.%I', t);
      execute format('create trigger set_owner before insert on public.%I for each row execute function public.set_owner()', t);
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t||'_own', t);
      execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t||'_own', t);
      execute format('revoke all on public.%I from anon', t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    end if;
  end loop;
end $$;

-- Prüfungen dürfen nur auf eigene Fächer zeigen
drop policy if exists klausuren_own on public.klausuren;
create policy klausuren_own on public.klausuren for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and (subject_id is null or exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = auth.uid())));

-- Vokabeln dürfen nur in eigene Sammlungen
drop policy if exists vokabeln_own on public.vokabeln;
create policy vokabeln_own on public.vokabeln for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and (collection_id is null or exists (select 1 from public.vocab_collections c where c.id = collection_id and c.user_id = auth.uid())));

create or replace function public.lern_engine_version()
returns integer language sql immutable as $$ select 4 $$;
