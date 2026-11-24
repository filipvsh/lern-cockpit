# Lern-Cockpit – Hinweise für Claude

**Zuerst `docs/REGELN.md` lesen** (Regelbuch: Cockpit-Bezug, Checkliste vor jedem Lernplan, Lernplan-Bausteine, Wiederholung nach Klausuren, Noten). Das Regelbuch gilt immer.

Lern-SPA von Filip (EF, Gesamtschule Hattingen). Vanilla JS, kein Build-Schritt, Supabase-Backend (nur anon key).
Antworten an Filip auf Deutsch, kurz, mit Hinweis „unten auf der Startseite muss Version N stehen“.

## Klausur-Standard – für JEDE Klausur einmal bauen

Filip lernt am MacBook und am Handy. Eine Liste mit Aufgaben reicht nicht. Jede Klausur bekommt einen
**Lernkurs** wie Physik Kinematik (`js/physik-kurs.js` + `js/views-kurs.js`, Route `#/kurs/<id>`):

1. **Kapitel** (5–8), je Kapitel:
   - Lernziel („Du kannst …“) und die Punkte der Lehrer-Checkliste, die es abdeckt
   - Erklärung in kurzen Abschnitten mit **Formel-Kasten** und **Tabellen**
   - **Diagramme/Graphen** als SVG (`PK.svg`), nicht nur Text
   - **Beispiele Schritt für Schritt** zum Aufdecken (erst selbst auf Papier rechnen)
   - wo möglich ein **interaktives Labor** (Regler → Graphen live)
   - **typische Fehler** in der Klausur
   - „✍️ Ins Heft / aufs iPad“ (Heft-Aufgaben der Lehrkraft)
   - **YouTube-Videos** (2–4, deutsch, IDs per Websuche verifiziert, abhakbar)
   - Übungs-Button mit passenden Aufgaben-Generatoren
2. **Merkblatt**: alle Formeln, Diagramme, Regeln und Fehler auf einer druckbaren Seite (Drucken/PDF).
3. **Übungen**: Generatoren mit Zufallszahlen, **mit Diagrammen** (`fig`), Eintippen statt Multiple Choice,
   Lösungsweg bei Fehlern, Fehlerheft. Modi Leicht/Normal/Schwer.
4. **Probe-Klausur in der App** mit Note + **Blitz** (60 s).
5. **Lernplan** Tag für Tag bis zum Klausurtag, Checkliste der Lehrkraft mit Selbsteinschätzung,
   Lösungen der echten Probeklausur (eingeklappt).
6. Verknüpft mit der Klausur-Seite (`kmTiles`): Kacheln „Lernkurs“, „Merkblatt“, „Probe-Klausur“.

Quellen: Checkliste/Material der Lehrkraft (Foto, PDF, TaskCards-Board), sonst Lehrplan EF NRW.
Vorlage für Lernfächer (nicht Rechnen): `js/erdkunde.js` – Kapitel mit `terms` (Fachbegriffe, werden
**eingetippt**, Kind `word`), `quiz`, Skizzen (`svg`), Generatoren pro Kapitel, `plan` ab sofort bis zur Klausur
(Aufgaben mit `ch`/`unit`/`begriffe`/`exam`/`crash` werden zu Sprung-Knöpfen). **Früh anfangen**: Plan startet,
sobald der Termin bekannt ist; Vorabend = Crashkurs.
Neuen Kurs in `LERNKURSE()` (views-kurs.js) eintragen (Felder: id, fach, qf, exam/blitz-Links, unit(), all,
termKey(), examKeys, blitzKeys, testsKey, crSheet …). Klausur-Kacheln, Empfehlung, Fehlerheft, Probe-Klausur
(`#/mathe/test?f=<qf>`) und Crashkurs funktionieren dann automatisch. Videos zusätzlich in `VIDEO_SETS` (videos.js).

## Wiederholung, Noten, Logos

- Reiter **Wiederholung** (`js/views-wiederholung.js`, Route `#/wiederholung`): Klausur-Archiv über Material, Fehleranalyse (Format in `docs/REGELN.md`), Lern-Modus. Daten in Einstellung `wiederholung`.
- Noten: Punkte 0–15; einmalige Einträge über Content-Packs (`klausurnoten-1124`).
- Logo oben links: `js/logos.js` (50 Motive, täglich wechselnd).

## Technik

- Neue js-Datei: in `index.html` (Reihenfolge beachten) **und** in `sw.js` SHELL eintragen.
- `APP_VERSION` in index.html == `CACHE="lc-vN"` in sw.js (Test prüft das) – bei jedem Update erhöhen.
- Neue Route: `V.<name>` + Bind-Funktion in der `bindPage`-Map in app.js, ggf. `OWN_HEADER`.
  Router kennt nur eine Unterebene (`ROUTE.sub`), mehr über `ROUTE.query`.
- Einstellungen über `setting()`/`setSetting()` (Tabelle einstellungen) – keine neuen Tabellen anlegen;
  falls doch nötig: SQL an Filip geben. Nur INSERT und PATCH, kein DELETE.
- Content-Packs (`js/content-packs.js`) laufen einmal; neue IDs auch in `tests/mock-backend.mjs` PACK_IDS.
- Tests: `npm test` (Unit + Migration), `node tests/e2e.mjs [Filter]` (Playwright, ~15 min),
  `node tests/audit.mjs <ordner>` (Handy-Screenshots).
- Nie den privaten VAPID-Key committen.
