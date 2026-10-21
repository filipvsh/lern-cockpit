// Web Push: Verschlüsselung (RFC 8291), VAPID (RFC 8292), Erinnerungs-Plan · node --test tests/push.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { encrypt, vapidAuth, generateVapidKeys, b64u } from "../supabase/functions/push-reminder/webpush.mjs";

// RFC 8291, Anhang A
const V = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
};
test("Verschlüsselung entspricht dem Beispiel aus RFC 8291", async () => {
  const out = await encrypt(V.plaintext, V.uaPublic, V.auth, { salt: V.salt, asPrivate: V.asPrivate, asPublic: V.asPublic });
  assert.equal(b64u.enc(out), V.body);
});

/** Gegenprobe wie im Browser: mit dem privaten Schlüssel des Geräts entschlüsseln */
async function decrypt(body, uaPrivate, uaPublic, auth) {
  const s = crypto.subtle, te = new TextEncoder();
  const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const pub = b64u.dec(uaPublic);
  const priv = await s.importKey("jwk", { kty: "EC", crv: "P-256", x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33)), d: uaPrivate }, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const shared = new Uint8Array(await s.deriveBits({ name: "ECDH", public: await s.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []) }, priv, 256));
  const hmac = async (k, d) => new Uint8Array(await s.sign("HMAC", await s.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), d));
  const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; a.forEach(x => { o.set(x, i); i += x.length; }); return o; };
  const hkdf = async (sa, ikm, info, len) => (await hmac(await hmac(sa, ikm), cat(info, new Uint8Array([1])))).slice(0, len);
  const ikm = await hkdf(b64u.dec(auth), shared, cat(te.encode("WebPush: info\0"), pub, asPub), 32);
  const key = await s.importKey("raw", await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16), "AES-GCM", false, ["decrypt"]);
  const pt = new Uint8Array(await s.decrypt({ name: "AES-GCM", iv: await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12) }, key, ct));
  return new TextDecoder().decode(pt.slice(0, pt.lastIndexOf(2)));
}
test("Zufälliger Schlüssel: Gerät kann die Nachricht entschlüsseln", async () => {
  const msg = JSON.stringify({ title: "🔥 Deine Serie ist in Gefahr!", body: "Ä ö ü ß" });
  const out = await encrypt(msg, V.uaPublic, V.auth);
  assert.equal(await decrypt(out, V.uaPrivate, V.uaPublic, V.auth), msg);
});
test("VAPID: gültiges ES256-JWT für den Push-Dienst", async () => {
  const k = await generateVapidKeys();
  const h = await vapidAuth("https://fcm.googleapis.com/fcm/send/abc", "https://example.org", k.publicKey, k.privateKey, Date.UTC(2026, 9, 21));
  const [, jwt, pk] = h.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(pk, k.publicKey);
  const [hd, pl, sig] = jwt.split(".");
  const claims = JSON.parse(new TextDecoder().decode(b64u.dec(pl)));
  assert.equal(claims.aud, "https://fcm.googleapis.com"); assert.equal(claims.sub, "https://example.org");
  const pub = b64u.dec(k.publicKey);
  const key = await crypto.subtle.importKey("raw", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  assert.ok(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64u.dec(sig), new TextEncoder().encode(hd + "." + pl)), "Signatur gültig");
});

/* ---------- Erinnerungs-Plan ---------- */
import { plan, localNow } from "../supabase/functions/push-reminder/plan.mjs";
const at = (date, hm) => new Date(new Date(date + "T" + hm + ":00Z").getTime() - 2 * 3600e3);   // Oktober: MESZ = UTC+2
test("Uhrzeit in Berlin", () => {
  assert.deepEqual(localNow(at("2026-10-21", "18:00")), { date: "2026-10-21", hm: "18:00" });
});
test("Plan: Serie in Gefahr ab Erinnerungszeit, nicht doppelt, nicht nachts", () => {
  const settings = { lektion_xp: { "2026-10-20": 30, "2026-10-19": 25 }, erinnerung_uhrzeit: "18:00" };
  assert.deepEqual(plan({ settings, now: at("2026-10-21", "17:45") }).messages, [], "vor der Erinnerungszeit nichts");
  const p = plan({ settings, now: at("2026-10-21", "18:00") });
  assert.equal(p.messages.length, 1); assert.match(p.messages[0].title, /Serie ist in Gefahr/); assert.match(p.messages[0].body, /2 Tage/);
  assert.deepEqual(plan({ settings: Object.assign({}, settings, { push_log: p.log }), now: at("2026-10-21", "18:15") }).messages, [], "nicht zweimal");
  const late = plan({ settings: Object.assign({}, settings, { push_log: p.log }), now: at("2026-10-21", "21:00") });
  assert.match(late.messages[0].title, /Letzte Chance/);
  assert.deepEqual(plan({ settings, now: at("2026-10-21", "23:00") }).messages, [], "nachts Ruhe");
});
test("Plan: Ziel erreicht → keine Erinnerung; teilweise → „Fast geschafft“; aus → nichts", () => {
  const base = { erinnerung_uhrzeit: "17:00", xp_ziel: 30 };
  assert.deepEqual(plan({ settings: Object.assign({ lektion_xp: { "2026-10-21": 35 } }, base), now: at("2026-10-21", "18:00") }).messages, []);
  assert.match(plan({ settings: Object.assign({ lektion_xp: { "2026-10-21": 12 } }, base), now: at("2026-10-21", "18:00") }).messages[0].body, /18 XP/);
  assert.deepEqual(plan({ settings: Object.assign({ push_aus: true }, base), now: at("2026-10-21", "18:00") }).messages, []);
});
test("Plan: Klausur in 1/3/7 Tagen, die nächste zuerst", () => {
  const exams = [{ id: "a", fach: "Mathe", datum: "2026-10-28", punkte: null }, { id: "b", fach: "Französisch", datum: "2026-10-24", punkte: null }, { id: "c", fach: "Deutsch", datum: "2026-10-23", punkte: 12 }];
  const m = plan({ settings: { lektion_xp: { "2026-10-21": 40 } }, exams, now: at("2026-10-21", "18:30") }).messages;
  assert.equal(m.length, 1); assert.equal(m[0].title, "Französisch-Klausur in 3 Tagen"); assert.equal(m[0].url, "#/klausur/b");
});
test("Einzeldatei für den Supabase-Editor ist aktuell", async () => {
  const { bundle } = await import("../scripts/build-push.mjs");
  const { readFileSync } = await import("node:fs");
  assert.equal(readFileSync(new URL("../docs/push-reminder-einzeldatei.ts", import.meta.url), "utf8"), bundle(), "node scripts/build-push.mjs ausführen");
});
