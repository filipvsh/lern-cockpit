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

**Spaced Repetition.** Neu → 1 Tag → 3 Tage → danach Intervall × Leichtigkeit
(1,3–3,0).
- Richtig: Leichtigkeit +0,05.
- Fast richtig: kleinerer Schritt, Leichtigkeit −0,15.
- Falsch: Intervall 0, in 10 Minuten wieder fällig, Leichtigkeit −0,2.

Lernstand einer Karte aus dem Intervall: 1 Tag = 20 %, 7 Tage = 60 % („sicher“),
30 Tage = 90 %, ab 60 Tagen 100 %.

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
