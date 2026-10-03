// Prüft die SQL-Migrationen gegen echtes Postgres (PGlite) mit nachgebildeter
// Supabase-Umgebung: Rollen anon/authenticated, auth.users, auth.uid().
// Ausführen: node tests/migration.test.mjs   (benötigt @electric-sql/pglite)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const dir = new URL("../supabase/migrations/", import.meta.url);
const m003 = readFileSync(new URL("003_learning_engine.sql", dir), "utf8");
const m004 = readFileSync(new URL("004_lockdown_legacy.sql", dir), "utf8");
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";

const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
-- bestehende Tabellen (vereinfachter Altbestand)
create table public.klausuren(id uuid primary key default gen_random_uuid(), fach text, thema text, datum date, themen jsonb default '[]', vokabel_lektionen jsonb default '[]', punkte int);
create table public.vokabeln(id bigint generated always as identity primary key, begriff text, bedeutung text, sprache text, level int default 0, next date);
create table public.hausaufgaben(id uuid primary key default gen_random_uuid(), aufgabe text, klausur_id uuid);
create table public.lernlog(id bigint generated always as identity primary key, datum date, art text, anzahl int, minuten int, ref text);
create table public.einstellungen(key text primary key, value jsonb);
insert into public.klausuren(fach, thema, datum) values ('Englisch','Short Story Writing','2026-10-10');
insert into public.vokabeln(begriff,bedeutung,sprache,level,next) values ('bonjour','guten Tag','Unité 1',3,'2026-10-05'),('la gare','der Bahnhof','Unité 1',0,null);
insert into public.hausaufgaben(aufgabe) values ('S. 42');
`);

let n = 0; const ok = m => { n++; console.log("  ✓ " + m); };
const as = async (uid, sql, params) => {
  await db.exec("reset role;");
  if (uid === "anon") await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false);");
  else if (uid) await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
  else await db.exec("select set_config('request.jwt.claim.sub','',false);");
  try { return await db.query(sql, params); } finally { await db.exec("reset role;"); }
};
const fails = async (fn, label) => { let err = null; try { await fn(); } catch (e) { err = e; } assert.ok(err, label + " hätte fehlschlagen müssen"); ok(label); };

console.log("Migration 003");
await db.exec(m003); ok("läuft durch");
await db.exec(m003); ok("ist wiederholbar (idempotent)");
const types = await db.query(`select table_name, column_name, data_type from information_schema.columns where (table_name, column_name) in (('topics','exam_id'),('learning_events','vocab_id'))`);
assert.deepEqual(Object.fromEntries(types.rows.map(r => [r.table_name, r.data_type])), { topics: "uuid", learning_events: "bigint" }); ok("Fremdschlüssel übernehmen den Typ der bestehenden IDs (uuid / bigint)");
const v = await db.query(`select begriff, interval_days::float, reps, next_review_at::date::text as d from public.vokabeln order by id`);
assert.equal(v.rows[0].interval_days, 4); assert.equal(v.rows[0].reps, 3); assert.equal(v.rows[0].d, "2026-10-05");
assert.equal(v.rows[1].interval_days, 0); ok("Altes Level 3 → Intervall 4 Tage, Fälligkeit übernommen; neue Karten bleiben neu");

await db.exec(`insert into auth.users(id,email,created_at) values ('${A}','filip@example.org', now() - interval '1 day'), ('${B}','fremd@example.org', now())`);
const prof = await db.query("select count(*)::int c from public.profiles"); assert.equal(prof.rows[0].c, 2); ok("Profil wird bei Registrierung angelegt");

console.log("Besitz & Übernahme");
const cB = await as(B, "select public.claim_legacy_data() r"); assert.equal(cB.rows[0].r.skipped, "not_owner"); ok("Fremdes Konto kann Altdaten nicht übernehmen");
const cA = await as(A, "select public.claim_legacy_data() r"); assert.equal(cA.rows[0].r.klausuren, 1); assert.equal(cA.rows[0].r.vokabeln, 2); ok("Erstes Konto übernimmt Altdaten");
const cA2 = await as(A, "select public.claim_legacy_data() r"); assert.deepEqual(cA2.rows[0].r, {}); ok("Übernahme ist wiederholbar ohne Effekt");
await fails(() => as("anon", "select public.claim_legacy_data()"), "Anonym: Übernahme verweigert");

console.log("RLS auf neuen Tabellen");
const exam = (await db.query("select id from public.klausuren limit 1")).rows[0].id;
const t = await as(A, "insert into public.topics(title, exam_id) values ('Short Story Writing', $1) returning id, user_id", [exam]);
assert.equal(t.rows[0].user_id, A); ok("user_id wird automatisch gesetzt");
const topic = t.rows[0].id;
const st = await as(A, "insert into public.subtopics(topic_id, title) values ($1,'Narrative Perspective') returning id", [topic]);
const sub = st.rows[0].id;
await as(A, "insert into public.learning_events(type, result, subtopic_id, exam_id) values ('exercise_wrong', 0, $1, $2)", [sub, exam]);
assert.equal((await as(B, "select count(*)::int c from public.topics")).rows[0].c, 0); ok("Fremdes Konto sieht keine Themen");
assert.equal((await as(B, "select count(*)::int c from public.learning_events")).rows[0].c, 0); ok("Fremdes Konto sieht keine Lernereignisse");
await fails(() => as(B, "insert into public.subtopics(topic_id, title) values ($1,'Hack')", [topic]), "Fremdes Konto kann nicht in fremdes Thema schreiben");
await fails(() => as(B, "insert into public.topics(title, exam_id) values ('x', $1)", [exam]), "Fremdes Konto kann Thema nicht an fremde Prüfung hängen");
await fails(() => as(B, `insert into public.topics(title, user_id) values ('x', '${A}')`), "user_id kann nicht gefälscht werden");
const upd = await as(B, "update public.subtopics set title='x' returning id"); assert.equal(upd.rows.length, 0); ok("Fremdes Konto kann nichts ändern");
const del = await as(B, "delete from public.learning_events returning id"); assert.equal(del.rows.length, 0); ok("Fremdes Konto kann nichts löschen");
await fails(() => as("anon", "select * from public.learning_events"), "Anonym: kein Zugriff auf neue Tabellen");
await as(A, "delete from public.topics where id=$1", [topic]);
assert.equal((await db.query("select count(*)::int c from public.subtopics")).rows[0].c, 0); ok("Löschen eines Themas entfernt Unterthemen (cascade)");
assert.equal((await db.query("select count(*)::int c from public.learning_events where subtopic_id is null")).rows[0].c, 1); ok("Lernereignisse bleiben erhalten (Verknüpfung wird geleert)");

console.log("Migration 004 (Absicherung Altbestand)");
await db.exec(m004); await db.exec(m004); ok("läuft durch und ist wiederholbar");
await fails(() => as("anon", "select * from public.klausuren"), "Anonym: kein Zugriff mehr auf Klausuren");
assert.equal((await as(B, "select count(*)::int c from public.vokabeln")).rows[0].c, 0); ok("Fremdes Konto sieht keine Vokabeln");
assert.equal((await as(A, "select count(*)::int c from public.vokabeln")).rows[0].c, 2); ok("Besitzer sieht seine Vokabeln");
await as(null, "insert into public.hausaufgaben(aufgabe) values ('von Routine')");
const own = await db.query("select user_id from public.hausaufgaben where aufgabe='von Routine'"); assert.equal(own.rows[0].user_id, A); ok("Routine (service_role, ohne Nutzer) → Zeile gehört automatisch dem Besitzer");
await fails(() => as(B, "insert into public.vokabeln(begriff, bedeutung, user_id) values ('x','y',$1)", [A]), "Fremdes Konto kann keine Vokabeln für andere anlegen");
console.log(`\n${n} Prüfungen bestanden.`);
