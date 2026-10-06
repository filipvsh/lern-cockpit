# Lern-Cockpit · Einrichtung der Lern-Engine (Phase 2)

Die App bleibt eine statische Seite ohne Build-Schritt. Neu sind die Lern-Engine,
die Anmeldung und eine KI-Funktion auf Supabase. Die Einrichtung dauert etwa
15 Minuten und erfolgt einmalig. Bis Schritt 1 erledigt ist, laufen Aufgaben,
Stundenplan, Noten und Infos wie bisher; die Lernbereiche zeigen einen
Einrichtungshinweis.

## 1. Datenbank erweitern (Pflicht)

1. Supabase öffnen → Projekt `tafksekafwihvrwxxzdh` → **SQL Editor** → **New query**.
2. Den Inhalt von `supabase/migrations/003_learning_engine.sql` einfügen → **Run**.

Die Migration löscht nichts, kann mehrfach ausgeführt werden und lässt die
bestehenden Tabellen vorerst offen, damit deine Routinen weiterlaufen.

## 2. App veröffentlichen

Alle Dateien deployen, nicht nur `index.html`:

```
index.html  sw.js  manifest.webmanifest  icon-192.png  icon-512.png  js/
```

## 3. Konto anlegen

1. **Authentication → URL Configuration → Site URL** auf
   `https://precious-tarsier-d3ff5d.netlify.app` setzen. Dann führen die
   Bestätigungs- und Passwort-Links zurück in die App.
2. App öffnen → **Konto erstellen**. Ist die E-Mail-Bestätigung aktiv, kommt
   zuerst ein Link per Mail.
3. Beim ersten Login werden deine bestehenden Daten automatisch deinem Konto
   zugeordnet. Das darf nur das zuerst registrierte Konto.
   Außerdem übernimmt die App die Altdaten ins neue Modell:
   - Vokabel-Lektionen werden zu Sammlungen.
   - Klausur-Themenlisten werden zu Thema und Unterthemen.
   - Alte Level werden zu Wiederholungsintervallen.
4. Danach **neue Registrierungen abschalten**:
   *Authentication → Sign In / Providers → Email → „Allow new users to sign up“*
   ausschalten. Fremde Konten könnten dank RLS ohnehin nichts von dir sehen,
   aber so entstehen gar keine.

## 4. KI einrichten (optional, empfohlen)

Ohne diesen Schritt funktioniert alles außer den KI-Aktionen. Die App sagt dann
klar „Die KI-Funktion ist noch nicht eingerichtet“.

```bash
# einmalig: Supabase CLI installieren und verbinden
supabase login
supabase link --project-ref tafksekafwihvrwxxzdh

# Schlüssel nur als Secret auf dem Server – niemals in die App
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALLOWED_ORIGIN=https://precious-tarsier-d3ff5d.netlify.app

supabase functions deploy ai-tutor
```

Danach in der App unter **Einstellungen → KI → Verbindung testen** prüfen.

Die Funktion prüft das Login-Token, lädt den Lernkontext mit deinen Rechten
(RLS) und begrenzt auf 40 Anfragen pro 10 Minuten. Modell:
`claude-opus-5-5`; bei einer Sicherheitsablehnung springt automatisch das von
Anthropic empfohlene Ersatzmodell ein (`fallbacks: "default"`).

## 5. Bestehende Tabellen absichern (wichtig)

Bis zu diesem Schritt sind die **alten** Tabellen weiterhin mit dem öffentlichen
anon-Schlüssel les- und schreibbar. Das betrifft Hausaufgaben, Klausuren,
Vokabeln, Noten, Termine, Neuigkeiten, Lernlog, Einstellungen und
Stundenplan-Änderungen. Die neuen Lern-Tabellen sind bereits geschützt.

1. Deine Routinen (Morgen-Check 6:02, Tages-Review 17:00, Aushang-Erfassung)
   auf den **service_role**-Schlüssel umstellen. Den findest du unter
   *Project Settings → API*. Er umgeht RLS und gehört nur in die Routinen,
   nie ins Frontend.
2. `supabase/migrations/004_lockdown_legacy.sql` im SQL Editor ausführen.

Danach sieht und ändert jedes Konto ausschließlich eigene Zeilen. Einträge, die
Routinen ohne `user_id` schreiben, ordnet ein Trigger automatisch dir zu.

## Tests

```bash
npm install          # nur für die Datenbank-Tests (PGlite)
npm test             # Lern-Engine (Unit) + Migrationen/RLS gegen echtes Postgres
npm run test:e2e     # Ende-zu-Ende im Browser (Playwright/Chromium) gegen ein Test-Supabase im Speicher
deno test --node-modules-dir=auto supabase/functions/ai-tutor/handler.test.ts
```

## Ohne Anmeldung (Migration 005)

`supabase/migrations/005_ohne_anmeldung.sql` im SQL Editor ausführen. Danach
zeigt die App keine Login-Seite mehr: Alle Zugriffe laufen mit dem
anon-Schlüssel, neue Zeilen gehören automatisch dem Besitzer der Installation.

Achtung: Der anon-Schlüssel steht im Quelltext der Seite. Jeder, der ihn
kennt, kann danach alle Daten lesen und ändern.

Rückgängig machen:
1. `004_lockdown_legacy.sql` erneut ausführen.
2. Die Policies `*_open` löschen.
3. `lern_engine_version` wieder auf 4 setzen.
