// Edge Function „push-reminder“: Push-Erinnerungen ans Handy, auch wenn die App zu ist.
// Aufruf alle 15 Minuten per pg_cron (siehe docs/PUSH.md) mit { mode: "run" },
// aus der App mit { mode: "test", endpoint } für eine Probe-Nachricht.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (Pflicht), VAPID_SUBJECT (optional).
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.
// Abos liegen in einstellungen.push_subs, das Protokoll in einstellungen.push_log.
import { sendPush } from "./webpush.mjs";
import { plan } from "./plan.mjs";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const KEYS = ["push_subs", "push_log", "push_aus", "lektion_xp", "xp_ziel", "erinnerung_uhrzeit"];

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const env = (k: string) => Deno.env.get(k) || "";
  const vapid = { publicKey: env("VAPID_PUBLIC_KEY"), privateKey: env("VAPID_PRIVATE_KEY"), subject: env("VAPID_SUBJECT") || "https://precious-tarsier-d3ff5d.netlify.app" };
  if (!vapid.publicKey || !vapid.privateKey) return json(500, { code: "not_configured", error: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY fehlen (Supabase → Edge Functions → Secrets)." });
  const url = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY");
  const db = (path: string, init: RequestInit = {}) => fetch(url + "/rest/v1/" + path, { ...init, headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", ...(init.headers || {}) } });
  const body = await req.json().catch(() => ({}));

  // Einstellungen je Besitzer laden (in der Regel nur Filip)
  const rows: { key: string; value: unknown; user_id: string | null }[] = await (await db("einstellungen?select=key,value,user_id&key=in.(" + KEYS.join(",") + ")")).json();
  if (!Array.isArray(rows)) return json(500, { code: "unavailable", error: "Einstellungen nicht lesbar" });
  const users = new Map<string, Record<string, any>>();
  rows.forEach(r => { const u = r.user_id || "-"; if (!users.has(u)) users.set(u, {}); users.get(u)![r.key] = r.value; });
  const save = (k: string, value: unknown, user: string) => db("einstellungen?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(Object.assign({ key: k, value, updated: new Date().toISOString() }, user !== "-" ? { user_id: user } : {})) });

  // Probe-Nachricht an genau ein Gerät
  if (body.mode === "test") {
    for (const s of users.values()) {
      const sub = (s.push_subs || []).find((x: any) => x.endpoint === body.endpoint);
      if (sub) { const r = await sendPush(sub, { title: "Erinnerungen sind an 🔔", body: "So sieht deine Erinnerung aus. Bis später!", url: "#/dashboard", tag: "lc-test" }, vapid); return json(r.ok ? 200 : 502, { ok: r.ok, status: r.status, code: r.ok ? undefined : "unavailable" }); }
    }
    return json(404, { code: "bad_request", error: "Dieses Gerät ist nicht angemeldet." });
  }

  // Regelmäßiger Lauf: fällige Erinnerungen an alle Geräte
  const exams = await (await db("klausuren?select=id,fach,thema,datum,punkte,description&punkte=is.null")).json().catch(() => []);
  const report: unknown[] = [];
  for (const [user, s] of users) {
    const subs = s.push_subs || []; if (!subs.length) continue;
    const p = plan({ settings: s, exams: Array.isArray(exams) ? exams : [], now: new Date() });
    if (!p.messages.length) continue;
    const gone = new Set<string>();
    for (const m of p.messages) for (const sub of subs) { const r = await sendPush(sub, m, vapid).catch(() => ({ ok: false, gone: false, status: 0 })); if (r.gone) gone.add(sub.endpoint); report.push({ tag: m.tag, status: r.status }); }
    await save("push_log", p.log, user);
    if (gone.size) await save("push_subs", subs.filter((x: any) => !gone.has(x.endpoint)), user);   // abgemeldete Geräte entfernen
  }
  return json(200, { ok: true, sent: report });
});
