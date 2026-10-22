# Hosting: GitHub Pages (kostenlos, ohne Deploy-Kontingent)

Netlify pausiert im kostenlosen Tarif die Veröffentlichung, sobald das Monatskontingent
(„credits“) aufgebraucht ist. Das Repository ist öffentlich – GitHub Pages veröffentlicht
jede Änderung auf `main` kostenlos und ohne Limit.

## Einmal einschalten (1 Minute)
GitHub → `filipvsh/lern-cockpit` → **Settings** → **Pages** →
*Build and deployment* · Source: **Deploy from a branch** · Branch: **main** · Ordner: **/ (root)** → **Save**.

Nach 1–2 Minuten ist die App unter **https://filipvsh.github.io/lern-cockpit/** erreichbar.
Jeder Merge auf `main` geht danach automatisch live (Status unter *Actions → pages build and deployment*).

## Was gleich bleibt / was du einmal neu machst
- Alle Daten liegen in Supabase – Vokabeln, Lernstand, Noten, Klausuren sind sofort da.
- Auf dem Handy die neue Adresse **zum Home-Bildschirm hinzufügen** (die alte App-Kachel löschen).
- Push-Erinnerungen in den Einstellungen **einmal neu einschalten** (sie gelten pro Adresse).
- Bestwerte der Spiele liegen nur im Browser und starten neu.

`.nojekyll` im Wurzelordner sorgt dafür, dass GitHub die Dateien unverändert ausliefert.
