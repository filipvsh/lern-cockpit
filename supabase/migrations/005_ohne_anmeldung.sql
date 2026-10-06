-- =====================================================================
-- Lern-Cockpit · Migration 005 · Ohne Anmeldung
--
-- Danach braucht die App keine Anmeldung mehr: Jeder, der die Seite
-- öffnet, kann alles lesen und ändern. Neue Zeilen gehören automatisch
-- dem Besitzer der Installation (dem zuerst registrierten Konto).
--
-- ACHTUNG: Der anon-Schlüssel steht im Quelltext der Seite. Nach dieser
-- Migration kann JEDER mit diesem Schlüssel deine Daten lesen und ändern –
-- auch ohne die Seite. Rückgängig: 004_lockdown_legacy.sql erneut ausführen
-- und die Policies "*_open" löschen (siehe docs/SETUP.md).
--
-- Voraussetzung: 003 ist gelaufen. 004 ist egal. Mehrfach ausführbar.
-- =====================================================================

-- Besitzer neuer Zeilen: angemeldeter Nutzer, sonst Besitzer der Installation
create or replace function public.current_owner()
returns uuid
language sql stable security definer
set search_path = public, auth
as $$
  select coalesce(auth.uid(), public.app_owner())
$$;
grant execute on function public.current_owner() to anon, authenticated;

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

-- Neue Tabellen: offen für anon, user_id automatisch
do $$
declare t text;
begin
  foreach t in array array['subjects','vocab_collections','topics','subtopics','exercises','learning_events','training_sessions']
  loop
    execute format('alter table public.%I alter column user_id set default public.current_owner()', t);
    execute format('drop policy if exists %I on public.%I', t||'_open', t);
    execute format('create policy %I on public.%I for all to anon using (true) with check (true)', t||'_open', t);
    execute format('grant select, insert, update, delete on public.%I to anon', t);
  end loop;
end $$;

drop policy if exists profiles_open on public.profiles;
create policy profiles_open on public.profiles for all to anon using (true) with check (true);
grant select, update on public.profiles to anon;

-- Bestehende Tabellen: offen für anon, Besitzer per Trigger
do $$
declare t text;
begin
  foreach t in array array['hausaufgaben','klausuren','vokabeln','neuigkeiten','noten','lernlog','einstellungen','termine','stundenplan_aenderungen']
  loop
    if to_regclass('public.'||t) is not null then
      execute format('update public.%I set user_id = public.app_owner() where user_id is null', t);
      execute format('drop trigger if exists set_owner on public.%I', t);
      execute format('create trigger set_owner before insert on public.%I for each row execute function public.set_owner()', t);
      execute format('drop policy if exists %I on public.%I', t||'_open', t);
      execute format('create policy %I on public.%I for all to anon using (true) with check (true)', t||'_open', t);
      execute format('grant select, insert, update, delete on public.%I to anon', t);
    end if;
  end loop;
end $$;

-- Sequenzen (bigint-IDs der Alt-Tabellen) für anon nutzbar
grant usage, select on all sequences in schema public to anon;

-- Version 5 = „ohne Anmeldung“: die App zeigt keine Login-Seite mehr
create or replace function public.lern_engine_version()
returns integer language sql immutable as $$ select 5 $$;
grant execute on function public.lern_engine_version() to anon, authenticated;
