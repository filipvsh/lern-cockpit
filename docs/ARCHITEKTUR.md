# Lern-Cockpit · Architektur der Lern-Engine

```
UI            index.html        Shell, Designsystem (CSS), Schulseiten (Aufgaben, Stundenplan, Noten, Infos)
              js/app.js         Anmeldung, Dashboard, Vokabeln, Trainer-Start, Router, Start
              js/views-learn.js Lernplan, KI, Fortschritt, Einstellungen
              js/trainer.js     Trainings-Session: Darstellung + Steuerung
Business      js/engine.js      reine Logik: Antwortprüfung, Spaced Repetition, Timer, Lernstand, Planer
State         js/store.js       geladene Lerndaten, Selektoren (memoisiert), Übernahme der Altdaten
Daten         js/api.js         Supabase REST + Auth, Token-Erneuerung, Offline-Puffer, Snapshot
KI            js/ai.js          Client der Edge Function
              supabase/functions/ai-tutor  Kontext laden (RLS) → Claude → strukturiertes JSON
Datenbank     supabase/migrations          Schema, RLS, Übernahme, Absicherung
```

Es gibt keinen Build-Schritt. Die Dateien sind klassische Skripte mit festgelegter
Ladereihenfolge. `engine.js` läuft unverändert im Browser und in Node (Tests).

## Datenmodell

| Begriff im Konzept     | Tabelle                    | Hinweis                                                     |
|------------------------|----------------------------|-------------------------------------------------------------|
| User                   | `auth.users` + `profiles`  | `profiles.daily_minutes` = Zeitbudget des Tagesplans        |
| Subject                | `subjects`                 | aus Stundenplan/Prüfungen angelegt                          |
| Exam                   | `klausuren` (bestehend)    | + `user_id`, `subject_id`, `description`                    |
| Topic                  | `topics`                   | `exam_id` optional, `priority` 1–3, `status`                |
| Subtopic               | `subtopics`                | `mastery_score` ist ein Cache, Quelle sind die Ereignisse    |
| Exercise               | `exercises`                | MC, Freitext, Übersetzung, Zuordnung, kurze Schreibaufgabe  |
| Vocabulary             | `vokabeln` (bestehend)     | `begriff` = term, `bedeutung` = translation, + SRS-Felder   |
| Vocabulary Collection  | `vocab_collections`        | Ausgangs- und Zielsprache                                   |
| LearningEvent          | `learning_events`          | jede bewertete Antwort, KI-Korrektur, Prüfungsergebnis      |
| TrainingSession        | `training_sessions`        | Vokabel-Sessions sind Modus `vocab` mit `collection_id` und `direction` |

Alle neuen Tabellen haben `user_id default auth.uid()` und RLS. Verknüpfungen
dürfen nur auf eigene Elternzeilen zeigen. Das ist in `tests/migration.test.mjs`
mit zwei Konten gegen echtes Postgres geprüft.

## Nachvollziehbare Regeln

**Antwortprüfung.** Groß-/Kleinschreibung, Leerzeichen, Satzzeichen und
typografische Apostrophe spielen keine Rolle. Als richtig zählen auch:
- Alternativen aus der Übersetzung (`,` `;` `/`) und aus dem Alternativen-Feld
- eine Antwort ohne optionalen Klammerinhalt
- englische Verben ohne „to“

„Fast richtig“ (zählt, mit Hinweis) sind:
- fehlender deutscher Artikel
- fehlende Akzente
- ein Tippfehler ab 5 Zeichen, zwei ab 10 Zeichen

Falsch bleiben ein falscher Artikel bzw. ein falsches Genus und ein anderes Wort.
Mit „Ich hatte recht“ korrigierst du eine Bewertung. Die Antwort wird dann als
Alternative gespeichert.

**Spaced Repetition: FSRS-6.** Free Spaced Repetition Scheduler, Version 6,
Standardparameter (`Engine.FSRS`). Er ist im srs-benchmark an ~727 Mio.
Wiederholungen aus ~10 000 Anki-Sammlungen getestet: Log-Loss 0,366 mit
Standardparametern gegenüber 0,616 für Anki-SM-2. Unsere Umsetzung wird gegen
die Referenz py-fsrs 6.3.2 geprüft (`tests/fsrs-reference.json`, 40 Lernverläufe,
alle Werte exakt gleich).
- Grundgrößen: Stabilität S (nach S Tagen 90 % Abrufwahrscheinlichkeit),
  Schwierigkeit D (1–10), Abrufwahrscheinlichkeit R = (1 + f·t/S)^−w20.
- Bewertung: falsch = Again, fast richtig (Akzent/Artikel/Tippfehler) = Hard,
  richtig = Good.
- Nächste Wiederholung: bei R = 90 %, also nach S Tagen, gerundet auf ganze
  Tage, verfügbar ab Tagesbeginn. Falsch: in 10 Minuten wieder fällig.
- Tage werden als Kalendertage gezählt (wie Anki). Bei Wiederholungen am
  selben Tag greift die FSRS-Kurzzeitformel.
- Speicherung ohne neue Migration: `interval_days` = S, `ease` = D + 10.
  Werte ab 10 kennzeichnen FSRS. Alte SM-2-Karten werden beim ersten Abruf
  übernommen: S ≈ bisheriges Intervall, D aus der Leichtigkeit.
- Stufen für die Anzeige: Neu · Lernen (S < 3 Tage oder zuletzt falsch) ·
  Kurzzeit (< 10) · Gefestigt (< 30) · Langzeit (≥ 30 Tage).

**Lernrunde (Successive Relearning).** Nach Rawson & Dunlosky 2011 und
Karpicke & Roediger 2008:
- Neue Wörter: erst ansehen und einmal abschreiben (Studienkarte), dann
  3 richtige Abrufe aus dem Kopf. Zwischen den Abrufen liegen 4 bzw. 8 andere
  Karten.
- Wiederholungen: 1 richtiger Abruf.
- Fehler: Lösung mit markierten Buchstaben, einmal richtig abtippen (zählt
  nicht als Abruf), nach 7 anderen Karten erneut aus dem Kopf. Die Runde endet
  erst, wenn es richtig war (Pashler u. a. 2005: Rückmeldung mit Lösung).
- Pro Runde höchstens 25 Wörter und 8 neue. Pro Tag höchstens 10 neue Wörter.
  Danach „Fertig für heute“. Zusatzrunden sind freiwillig und nehmen die Wörter
  mit der niedrigsten Abrufwahrscheinlichkeit.
- Nur der erste Abruf eines Wortes je Runde erzeugt ein Lernereignis und zählt
  in der Statistik. Wiederholungen in der Runde aktualisieren nur das
  Gedächtnismodell.
- Ab 3 Fehlschlägen schlägt die App eine Merkhilfe vor (Notizfeld).

**Lernstand eines Unterthemas (0–100).** Grundlage ist der gewichtete
Durchschnitt der letzten 12 Ergebnisse:
- Neuere Ergebnisse zählen mehr (Faktor 0,8 pro Schritt).
- Schwere Übungen zählen mehr.
- Gewicht nach Herkunft: Prüfungssimulation ×1,5, KI-Korrektur ×1,2,
  Selbsteinschätzung ×0,6.

Zwei Abschläge:
- Unter 4 Versuchen wird anteilig gedämpft.
- Ab 4 Tagen ohne Übung gibt es −2 % pro Tag, höchstens −30 %.

Jede Übung liefert ein Ereignis. Eine Übung abzuschließen heißt **nicht**, dass
das Thema erledigt ist.

**Prüfungsbereitschaft.** Gewichteter Durchschnitt aller Unterthemen der
Prüfung. Ungeübte Unterthemen zählen mit 0 %. Die Gewichtung folgt der
Themenpriorität; gekoppelte Vokabel-Sammlungen fließen mit ein. Ohne eine
einzige Übung zeigt die App keine Zahl, sondern einen Hinweis.

**Planer.**
```
Priorität = (Bedarf·0,6 + Fehler + Pause + fehlende Daten) × Dringlichkeit × Relevanz
```
- Dringlichkeit = 1 / (1 + Tage bis zur Prüfung / 7)
- Relevanz = Themenpriorität × Schwierigkeit
- Wer heute schon 10 Minuten am selben Unterthema geübt hat, bekommt ×0,4.

Der Tagesplan verteilt das Zeitbudget:
1. zuerst Vokabeln (fällig + bis zu 10 neue)
2. dann die wichtigsten Unterthemen (10 Minuten, kurz vor der Prüfung 15)
3. dann Fehlertraining

Der Plan wird einmal pro Tag erstellt, damit er sich nicht umsortiert.
Fortschritt und Begründungen bleiben live.

**Timer.** Nie herunterzählen, immer rechnen:
```
vergangen = jetzt − Start − Pausen
```
Die Session wird bei jeder Änderung in `localStorage` gespeichert und an
`training_sessions` gemeldet. Nach einem Reload läuft sie mit der richtigen
Zeit weiter. Im Hintergrund pausieren normale Sessions nach 10 Minuten
rückwirkend; der Prüfungsmodus läuft weiter wie in einer echten Prüfung.

**Vokabeltest (fester Termin).** Ein Vokabeltest ist eine Prüfung in
`klausuren` (Thema beginnt mit „Vokabeltest:“, `description = 'Vokabeltest'`)
mit genau einer Sammlung in `vokabel_lektionen`. Keine zusätzliche Migration.
- Bereitschaft = erwartete Trefferquote: FSRS-Abrufwahrscheinlichkeit am
  Testtag, gemittelt über alle Wörter (neue zählen 0). „Sitzt“ = mindestens
  90 % am Testtag und zuletzt nicht falsch.
- Neue Karten pro Tag = noch nicht abgefragte ÷ (Tage bis zum Test − 1):
  bis zum Vortag sind alle Wörter mindestens einmal dran.
- Täglich dazu alle fälligen Karten (falsche zuerst); falsche kommen nach
  10 Minuten erneut.
- Wiederholungsabstände von Testkarten enden spätestens am Vortag
  (frühestens morgen), damit keine Karte über den Testtermin „springt“.
- Vortag und Testtag: jede Karte, die an diesem Tag noch nicht dran war.
- Probetest: alle Karten zufällig, Zeitlimit, keine Rückmeldung bis zum Ende,
  Ergebnisse zählen normal für die Wiederholungsplanung.
- Der Test steht im Tagesplan immer oben; seine Sammlung wird aus dem
  allgemeinen Vokabel-Posten herausgenommen (keine Doppelplanung).

## Robustheit

- **Schreibreihenfolge.** Alle Schreibvorgänge laufen in einer Kette. Ein PATCH
  kann deshalb nie vor seinem INSERT ankommen.
- **Offline-Puffer.** Fehlgeschlagene Schreibvorgänge (Netz/5xx) kommen in
  einen Puffer und werden nachgereicht. Neue Zeilen haben vom Client erzeugte
  IDs, sodass Wiederholungen keine Duplikate erzeugen. Der Puffer wird nie unter
  einem anderen Konto gesendet.
- **Offline-Start.** Der letzte geladene Stand liegt als Snapshot im Browser.
  Ohne Verbindung startet die App damit und zeigt einen Hinweis statt einer
  leeren Seite.
- **KI-Ausfälle.**
  - KI-Eingaben werden als Entwurf gespeichert, bevor die Anfrage rausgeht.
    Erst dann sagt die Fehlermeldung „Deine Eingabe ist gespeichert“.
  - Ohne KI fällt der Trainer auf Musterlösung plus Selbsteinschätzung zurück.
