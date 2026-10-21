// AUTOMATISCH ERZEUGT aus supabase/functions/push-reminder/* – nicht von Hand ändern (node scripts/build-push.mjs)
// Lern-Cockpit · Edge Function „push-reminder“ als eine Datei.
// @ts-nocheck

// ===== webpush.mjs =====
// Web Push ohne Bibliothek: VAPID (RFC 8292) + Verschlüsselung aes128gcm (RFC 8291).
// Läuft mit WebCrypto in Deno (Edge Function) und Node ≥ 18 (Tests).
const enc = new TextEncoder();
const b64u = {
  enc: buf => { let s = ""; new Uint8Array(buf).forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  dec: str => { const s = atob(String(str).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(str).length + 3) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); }
};
const concat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; a.forEach(x => { out.set(x, o); o += x.length; }); return out; };
const subtle = globalThis.crypto.subtle;

async function hmac(key, data) { const k = await subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return new Uint8Array(await subtle.sign("HMAC", k, data)); }
/** HKDF in zwei Schritten (RFC 5869), Länge ≤ 32 */
const hkdf = async (salt, ikm, info, len) => (await hmac(await hmac(salt, ikm), concat(info, new Uint8Array([1])))).slice(0, len);

/** öffentlicher Schlüssel (65 Byte, unkomprimiert) + privater (32 Byte) → JWK */
function jwk(pub, priv) {
  const j = { kty: "EC", crv: "P-256", x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)), ext: true };
  if (priv) j.d = b64u.enc(priv);
  return j;
}
/** neues VAPID-Schlüsselpaar (base64url) */
async function generateVapidKeys() {
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = new Uint8Array(await subtle.exportKey("raw", kp.publicKey)); const j = await subtle.exportKey("jwk", kp.privateKey);
  return { publicKey: b64u.enc(pub), privateKey: j.d };
}

/** Inhalt für ein Abo verschlüsseln. opts.salt / opts.asPrivate / opts.asPublic nur für Tests (feste Werte) */
async function encrypt(payload, p256dh, auth, opts = {}) {
  const uaPub = b64u.dec(p256dh), authSecret = b64u.dec(auth);
  const salt = opts.salt ? b64u.dec(opts.salt) : crypto.getRandomValues(new Uint8Array(16));
  let asPriv, asPub;
  if (opts.asPrivate) { asPub = b64u.dec(opts.asPublic); asPriv = await subtle.importKey("jwk", jwk(asPub, b64u.dec(opts.asPrivate)), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]); }
  else { const kp = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]); asPriv = kp.privateKey; asPub = new Uint8Array(await subtle.exportKey("raw", kp.publicKey)); }
  const uaKey = await subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: uaKey }, asPriv, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const data = concat(typeof payload === "string" ? enc.encode(payload) : payload, new Uint8Array([2]));   // 0x02 = letzter Datensatz
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, data));
  const rs = new Uint8Array([0, 0, 16, 0]);   // Datensatzgröße 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

/** Authorization-Header für den Push-Dienst (JWT, ES256) */
async function vapidAuth(endpoint, subject, publicKey, privateKey, now = Date.now()) {
  const pub = b64u.dec(publicKey);
  const key = await subtle.importKey("jwk", jwk(pub, b64u.dec(privateKey)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u.enc(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u.enc(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + body)));
  return "vapid t=" + head + "." + body + "." + b64u.enc(sig) + ", k=" + publicKey;
}

/** Eine Nachricht an ein Abo schicken. Ergebnis: {ok, status, gone} (gone = Abo ungültig → löschen) */
async function sendPush(sub, message, vapid, fetchFn = fetch) {
  const body = await encrypt(JSON.stringify(message), sub.keys.p256dh, sub.keys.auth);
  const r = await fetchFn(sub.endpoint, { method: "POST", headers: { TTL: "43200", Urgency: "normal", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
    Authorization: await vapidAuth(sub.endpoint, vapid.subject, vapid.publicKey, vapid.privateKey) }, body });
  return { ok: r.ok, status: r.status, gone: r.status === 404 || r.status === 410 };
}

// ===== plan.mjs =====
// Welche Erinnerungen sind jetzt fällig? Rein, ohne Netz – getestet in tests/push.test.mjs.
// Eingaben: Einstellungen (wie in der App), anstehende Klausuren, aktuelle Zeit.
// Regeln (Uhrzeit Europe/Berlin, je Tag und Art höchstens einmal, nie nach 22 Uhr):
//   lernen   ab der Erinnerungszeit, wenn das Tagesziel noch offen ist (Serie in Gefahr / Ziel offen)
//   letzte   21–22 Uhr, wenn heute noch nichts gemacht ist und eine Serie läuft
//   klausur  ab der Erinnerungszeit, wenn eine Klausur in 1, 3 oder 7 Tagen ist
const TZ = "Europe/Berlin";
function localNow(now, tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(x => [x.type, x.value]));
  return { date: p.year + "-" + p.month + "-" + p.day, hm: p.hour + ":" + p.minute };
}
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);
function streakOf(xp, today) { let n = 0, d = today; if (!xp[d]) d = addDays(d, -1); while (xp[d]) { n++; d = addDays(d, -1); } return n; }
const plural = (n, a, b) => n + " " + (n === 1 ? a : b);

function plan({ settings, exams, now }) {
  const s = settings || {}; const { date, hm } = localNow(now);
  if (s.push_aus) return { messages: [], log: null };
  const log = s.push_log && s.push_log.date === date ? { date, keys: [...s.push_log.keys] } : { date, keys: [] };
  const rt = /^\d\d:\d\d$/.test(s.erinnerung_uhrzeit || "") ? s.erinnerung_uhrzeit : "18:00";
  const xp = s.lektion_xp || {}; const today = +xp[date] || 0; const goal = +s.xp_ziel || 30;
  const streak = streakOf(xp, date); const risk = today === 0 && !!xp[addDays(date, -1)];
  const out = []; const send = (key, m) => { if (!log.keys.includes(key)) { out.push(Object.assign({ tag: "lc-" + key }, m)); log.keys.push(key); } };
  if (hm >= "22:00" || hm < "07:00") return { messages: [], log: null };
  if (hm >= rt && hm < "21:00" && today < goal) {
    if (risk) send("lernen", { title: "🔥 Deine Serie ist in Gefahr!", body: plural(streak, "Tag", "Tage") + " am Stück – eine Lektion (3 Min.) rettet sie.", url: "#/dashboard" });
    else if (!today) send("lernen", { title: "Zeit für heute 📚", body: "3 Minuten Lektion reichen – und deine Serie läuft.", url: "#/dashboard" });
    else send("lernen", { title: "Fast geschafft 💪", body: "Noch " + (goal - today) + " XP bis zu deinem Tagesziel.", url: "#/dashboard" });
  }
  if (hm >= "21:00" && risk) send("letzte", { title: "Letzte Chance für heute 🔥", body: "Noch bis Mitternacht – sonst ist deine Serie von " + plural(streak, "Tag", "Tagen") + " weg.", url: "#/dashboard" });
  if (hm >= rt) {
    const k = (exams || []).filter(e => e.datum && e.punkte == null).map(e => Object.assign({ d: daysBetween(date, e.datum) }, e)).filter(e => [1, 3, 7].includes(e.d)).sort((a, b) => a.d - b.d)[0];
    if (k) send("klausur", { title: (k.fach || "Klausur") + (k.description === "Vokabeltest" ? "-Vokabeltest " : "-Klausur ") + (k.d === 1 ? "morgen" : "in " + k.d + " Tagen"), body: k.d === 1 ? "Heute noch einmal alles wiederholen – du schaffst das!" : "Öffne den Klausur-Modus – alles für diese Klausur an einem Ort.", url: "#/klausur/" + k.id });
  }
  return { messages: out, log: out.length ? log : null };
}

// ===== index.ts =====
// Edge Function „push-reminder“: Push-Erinnerungen ans Handy, auch wenn die App zu ist.
// Aufruf alle 15 Minuten per pg_cron (siehe docs/PUSH.md) mit { mode: "run" },
// aus der App mit { mode: "test", endpoint } für eine Probe-Nachricht.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (Pflicht), VAPID_SUBJECT (optional).
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.
// Abos liegen in einstellungen.push_subs, das Protokoll in einstellungen.push_log.



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
