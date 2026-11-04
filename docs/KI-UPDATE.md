# KI-Funktion aktualisieren (Checkliste per Foto, Rechenweg-Check)

Die neuen Funktionen **„Checkliste per Foto/PDF“** und **„Rechenweg prüfen“** brauchen die
neue Version der Edge Function `ai-tutor`. Ohne Update funktioniert alles andere weiter –
die App sagt dann „Die KI-Funktion ist noch die alte Version“ bzw. „nicht erreichbar“.
„Punkte selbst eintippen“ geht immer, auch ohne KI.

Dauer: ca. 5 Minuten, alles im Browser.

## 1. Code ersetzen

1. Öffne <https://supabase.com/dashboard> → dein Projekt (`tafksekafwihvrwxxzdh`).
2. Links **Edge Functions** → Funktion **`ai-tutor`** antippen.
   - Gibt es sie noch nicht: **Deploy a new function → Via Editor**, Name genau `ai-tutor`.
3. Reiter **Code**: den kompletten Inhalt löschen und den Inhalt der Datei
   [`docs/ai-tutor-einzeldatei.ts`](ai-tutor-einzeldatei.ts) hineinkopieren.
   (Auf GitHub: Datei öffnen → Knopf „Copy raw file“.)
4. **Deploy** drücken.

## 2. Secrets prüfen

Links **Edge Functions → Secrets** (oder Project Settings → Edge Functions):

| Name | Wert |
|---|---|
| `ANTHROPIC_API_KEY` | dein Schlüssel von console.anthropic.com (`sk-ant-…`) |
| `ALLOWED_ORIGIN` | `https://filipvsh.github.io` |

Wichtig: Steht bei `ALLOWED_ORIGIN` noch die alte Netlify-Adresse, ist das mit der neuen
Version kein Problem mehr (GitHub Pages ist immer erlaubt) – aber trag am besten die neue
Adresse ein.

## 3. Testen

App öffnen → **Einstellungen → KI → Verbindung testen**. Es muss „KI ist erreichbar“ kommen.
Dann: Fächer → ein Fach mit Klausur → Klausur-Modus → **Checkliste** → Foto wählen.

## Kosten

Jede Checkliste aus einem Foto ist eine größere KI-Anfrage (ein paar Cent), ein
Rechenweg-Check eine kleine. Es gilt weiter die Grenze von 40 Anfragen pro 10 Minuten.
