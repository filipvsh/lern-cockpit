# Push-Erinnerungen einrichten (einmalig, ca. 10 Minuten)

Damit Erinnerungen auch kommen, wenn die App **geschlossen** ist, braucht es drei Dinge:

1. die Server-Funktion `push-reminder` in Supabase,
2. zwei geheime Schlüssel (VAPID) in Supabase,
3. einen Zeitplan, der die Funktion alle 15 Minuten aufruft.

Danach schaltest du die Erinnerungen in der App unter **Mehr → Einstellungen → Push-Erinnerungen** ein.

## Was du bekommst

| Wann | Nachricht |
|---|---|
| ab deiner Erinnerungszeit (Standard 18:00), wenn das Tagesziel offen ist | „🔥 Deine Serie ist in Gefahr!“ / „Zeit für heute 📚“ / „Fast geschafft 💪 – noch 12 XP“ |
| 21–22 Uhr, wenn heute noch nichts gemacht ist und eine Serie läuft | „Letzte Chance für heute 🔥“ |
| 7, 3 und 1 Tag vor einer Klausur | „Französisch-Klausur in 3 Tagen“ → öffnet den Klausur-Modus |

Je Tag und Art höchstens eine Nachricht, nie zwischen 22 und 7 Uhr.

## 1. Funktion anlegen

Supabase → Projekt `tafksekafwihvrwxxzdh` → **Edge Functions** → **Deploy a new function** → **Via Editor**

- Name: `push-reminder`
- Den kompletten Inhalt von [`docs/push-reminder-einzeldatei.ts`](push-reminder-einzeldatei.ts) einfügen (ersetzt den Beispielcode).
- **Deploy function**.

(Mit der Supabase-Kommandozeile geht es auch: `supabase functions deploy push-reminder` aus dem Projektordner.)

## 2. Schlüssel hinterlegen

Supabase → **Edge Functions** → **Secrets** → **Add new secret**:

| Name | Wert |
|---|---|
| `VAPID_PUBLIC_KEY` | `BGaHMIcRxYFempJIKVN333Keyy_ls30XZfsTzKULPRwZFFxvx0K32lUBQQcIOfDtGBO4qACgkveMXyTr_YFWNmg` |
| `VAPID_PRIVATE_KEY` | *(steht im Chat, nicht im Repository – geheim halten)* |

Der öffentliche Schlüssel steht auch in `js/push.js` – beide müssen zusammenpassen.
Neues Schlüsselpaar nötig? `node --input-type=module -e "import('./supabase/functions/push-reminder/webpush.mjs').then(m=>m.generateVapidKeys()).then(console.log)"` –
dann den öffentlichen Schlüssel in `js/push.js` **und** beide Secrets ersetzen (alle Geräte müssen sich danach neu anmelden).

## 3. Zeitplan starten

Supabase → **SQL Editor** → **New query** → Inhalt von
[`supabase/migrations/007_push_erinnerungen.sql`](../supabase/migrations/007_push_erinnerungen.sql) einfügen → **Run**.

## 4. In der App einschalten

- **Android / Computer:** App öffnen → Mehr → Einstellungen → **Push-Erinnerungen einschalten** → Benachrichtigungen erlauben. Es kommt sofort eine Probe-Nachricht.
- **iPhone:** Push geht nur, wenn das Cockpit auf dem Home-Bildschirm liegt (iOS 16.4 oder neuer):
  Safari → Teilen → **Zum Home-Bildschirm** → das Cockpit **von dort** öffnen → dann wie oben einschalten.

Jedes Gerät meldet sich einzeln an. Abgemeldete Geräte entfernt die Funktion automatisch.

## Prüfen & Fehler

- Kommt keine Probe-Nachricht: In der App steht, woran es liegt (Funktion fehlt, Schlüssel fehlen, Benachrichtigungen blockiert).
- Läuft der Zeitplan? SQL Editor: `select * from cron.job_run_details order by start_time desc limit 5;`
- Ausschalten: in der App **Ausschalten** (nur dieses Gerät) oder `select cron.unschedule('lern-cockpit-push');` (alle).
