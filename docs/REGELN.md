# Regelbuch – gilt immer, bei jeder Arbeit am Cockpit und im Claude-Projekt „Schule“

Dieses Regelbuch liegt in `docs/REGELN.md`. Eine Kurzfassung steht im Projekt-Dokument „READ ME“.
Wer am Cockpit arbeitet oder für Filip lernt, liest zuerst dieses Dokument.

## 1. Cockpit-Bezug (immer)

- Cockpit live: https://filipvsh.github.io/lern-cockpit/#/dashboard (GitHub Pages). Daten: Supabase. **Netlify ist alt und wird nicht mehr genutzt.**
- Repo: `filipvsh/lern-cockpit` (öffentlich!). Deploy: Push auf `main` → GitHub Pages.
- Im Projekt „Schule“ gilt: Jede Lernhilfe, jeder Plan, jede Klausur hat einen Platz im Cockpit. Erst dort nachsehen
  (Klausurtermine, Lernplan, Noten, Material), dann antworten. Neue Lerninhalte gehören ins Cockpit, nicht nur in den Chat.
- Das Repo ist öffentlich: **keine** Klausurtexte, Scans, privaten Daten, Schlüssel oder Noten-Details einchecken.
  Private Inhalte (Analysen, Notizen) laufen über die Einstellungen in der Datenbank (siehe 5.), Dateien über „Material“.
- Claude hat keinen direkten Zugriff auf die Datenbank. Wege: (a) Code-Änderung + einmaliges **Content-Pack**
  (`js/content-packs.js`, nur INSERT/PATCH), (b) JSON zum Einfügen in der App (Wiederholung), (c) SQL für Filip zum Ausführen.

## 2. Pflicht-Ablauf vor JEDEM Lernplan

1. **Checkliste anfordern.** Ohne Checkliste der Lehrkraft (Foto, PDF, TaskCards-Board, WebUntis-Aushang, Probeklausur) kein Lernplan.
   Fehlt sie: genau eine kurze Frage („Fach, Datum, Checkliste?“) und warten.
2. **Sobald die Checkliste im Ordner „Schule“ liegt, wird ohne weitere Rückfrage automatisch der komplette Lernplan gebaut** (Punkt 3).
3. Termin eintragen (Klausur-Seite), Lernkurs in `LERNKURSE()` registrieren, Videos in `VIDEO_SETS`.
4. Lernplan startet sofort, Vorabend = Crashkurs, mindestens ein Puffertag, Wiederholungstage nach 1, 3 und 7 Tagen.

## 3. Bausteine des Lernplans (Katalog – Mix ist Pflicht, mindestens 5 verschiedene Arten je Kapitel)

| Baustein | Beschreibung |
|---|---|
| Checkliste zum Abhaken | Punkte der Lehrer-Checkliste, mit Selbsteinschätzung (Ampel); Abhaken erst nach Übung |
| Erklärung kurz | Lernziel „Du kannst …“, Merkkasten, Tabelle, Fachbegriffe |
| Grafiken | Mathe: Graphen, Skizzen, Schrittfolgen als SVG; Erdkunde/Physik: beschriftete Skizzen; Flussdiagramme |
| Beispiele zum Aufdecken | Erst selbst auf Papier, dann Lösung Schritt für Schritt |
| Interaktives Labor | Regler → Graph/Skizze live (wo es passt) |
| Übungsgeneratoren | Zufallszahlen, Eintippen statt Multiple Choice, Lösungsweg bei Fehlern, Leicht/Normal/Schwer |
| Mini-Games | Memory (Begriff ↔ Definition), Zuordnen, Reihenfolge sortieren, Lückentext, Blitz (60 s), Wahr/Falsch-Duell, Fehler-Detektiv (Fehler im Lösungsweg finden) |
| Vokabeln und Begriffe | Spaced Repetition (FSRS), Eintippen, Richtung umschaltbar; Fachbegriffe als `word`-Aufgaben |
| Videos | 2–4 pro Kapitel, deutsch, IDs per Websuche verifiziert, abhakbar. Nie erfundene Links |
| Schreib-/Heftaufgaben | ✍️ Aufgaben aus Heft/Buch der Lehrkraft; Operatoren-Training (nennen, erläutern, beurteilen) |
| Erklär-Aufgabe | „Erklär es in 3 Sätzen“ (Feynman), danach Musterantwort zum Vergleichen |
| Merkblatt | alles Wichtige auf einer druckbaren Seite |
| Probe-Klausur | in der App, ohne Hilfe, mit Note, plus Blitz |
| Fehlerheft | falsche Antworten kommen automatisch wieder |
| Crashkurs | Vorabend: nur das Wichtigste und alle bisherigen Fehler |
| Tagesplan | Tag für Tag, Blöcke à 25–30 Min, mit Sprung-Knöpfen zu den Aufgaben |

Fächer-Schwerpunkte: **Mathe/Physik** = Rechnen + Grafiken + Fehler-Detektiv · **Sprachen** = Vokabeln + Grammatik-Drill + Schreiben ·
**Gesellschaft (Erdkunde, SoWi, Geschichte)** = Begriffe eintippen + Material-Analyse + Operatoren + Fließdiagramme.
Technik und Aufbau eines Lernkurses: `CLAUDE.md`, Abschnitt „Klausur-Standard“.

## 4. Nach der Arbeit: Reiter „Wiederholung“

1. Filip lädt die Arbeit unter **Wiederholung → Klausur hochladen** hoch (Titel beginnt mit „Klausur“) und schickt sie im Projekt „Schule“.
2. Claude analysiert: pro Fehler Aufgabe, Thema, was passiert ist, wie es richtig geht, Merksatz, Fehlerart
   (Flüchtigkeit · Wissenslücke · Verständnis · Zeit · Operator verfehlt). Dazu Erklärungen und 2–3 verifizierte Videos je Thema.
3. **Immer dazu: eine Musterlösung (1+)** – die komplette Arbeit so, wie sie nach dem Erwartungshorizont volle Punktzahl bekäme (jede Teilaufgabe, ausformuliert, mit Ansätzen/Zitaten/Zeilen). Feld `muster` im JSON.
4. Claude gibt die Analyse als **JSON** (Format unten). Am schnellsten trägt Claude es selbst ein (über Filips Chrome im offenen Cockpit-Tab → setSetting). Sonst fügt Filip es unter **Wiederholung → Analyse einfügen** ein.
5. Lern-Modus: Fehler einzeln, erst selbst lösen, aufdecken, „Verstanden“ oder „Nochmal“.
6. Note wird sofort in den Noten-Reiter eingetragen (siehe 6.).

```json
{
  "fach": "Mathe", "titel": "Klausur Nr. 2 – Potenzfunktionen", "datum": "2026-11-20", "punkte": 4, "note": "4-",
  "fazit": "2–3 Sätze: Woran lag es, was zuerst üben.",
  "fehler": [
    { "id": "f1", "aufgabe": "Aufgabe 3b", "thema": "Ableitung", "was": "Was passiert ist.", "richtig": "So geht es richtig, Schritt für Schritt.", "tipp": "Merksatz." }
  ],
  "muster": [
    { "aufgabe": "Aufgabe 1", "text": "Komplette 1+-Lösung dieser Teilaufgabe, Zeilenumbrüche mit \\n." }
  ],
  "themen": [
    { "titel": "Ableitungsregeln", "text": "Kurze Erklärung.", "videos": [{ "t": "Titel (Kanal)", "id": "YOUTUBE_ID" }], "links": [{ "t": "Nachlesen", "u": "https://…" }] }
  ]
}
```

## 5. Daten und Schreibwege

- Einstellungen (`setting()`/`setSetting()`): Schlüssel `wiederholung` = `{ entries: [...] }`. Keine neuen Tabellen; falls doch nötig: SQL an Filip.
- Nur INSERT und PATCH, kein DELETE.
- Material (PDF/Foto): Reiter „Material“, Tabelle `dokumente`, Speicher „material“.

## 6. Noten

- Punkte 0–15. 1+ = 15 · 1 = 14 · 1- = 13 · 2+ = 12 · 2 = 11 · 2- = 10 · 3+ = 9 · 3 = 8 · 3- = 7 · 4+ = 6 · 4 = 5 · 4- = 4 · 5+ = 3 · 5 = 2 · 5- = 1 · 6 = 0.
- Nennt Filip eine Note, kommt sie sofort in den Noten-Reiter (schriftlich = Art „klausur“, mündlich = „somi“), mit Datum und Quartal.
  Unsichere Noten bekommen den Zusatz „bitte prüfen“.
- Stand Nov 2026 (EF.1): Französisch 2 · Deutsch 3 · Englisch 3 (unsicher) · Mathe 4- (16 Sechsen im Kurs). Mündliche Noten stehen noch aus.

## 7. Aussehen

- Übersichtlich, wenig Text, klare Kacheln. Handy und MacBook gleich gut.
- Logo oben links: `js/logos.js`, 50 Motive im Punkt-Raster-Stil, wechselt täglich, Tipp = nächstes. Neue Motive nur dort ergänzen.

## 8. Umgang mit Filip

- Deutsch, locker, direkt, kurz. Begründungen mit Belegen, nicht moralisierend.
- Nur fragen, was die Planung ändert. Keine täglichen Abfragen.
- Nach jedem Update: „Unten auf der Startseite muss Version N stehen“. Version in `index.html` und `sw.js` erhöhen, neue JS-Dateien in `index.html` **und** `sw.js` eintragen.
