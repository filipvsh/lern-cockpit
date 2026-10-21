// Web Push ohne Bibliothek: VAPID (RFC 8292) + Verschlüsselung aes128gcm (RFC 8291).
// Läuft mit WebCrypto in Deno (Edge Function) und Node ≥ 18 (Tests).
const enc = new TextEncoder();
export const b64u = {
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
export async function generateVapidKeys() {
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = new Uint8Array(await subtle.exportKey("raw", kp.publicKey)); const j = await subtle.exportKey("jwk", kp.privateKey);
  return { publicKey: b64u.enc(pub), privateKey: j.d };
}

/** Inhalt für ein Abo verschlüsseln. opts.salt / opts.asPrivate / opts.asPublic nur für Tests (feste Werte) */
export async function encrypt(payload, p256dh, auth, opts = {}) {
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
export async function vapidAuth(endpoint, subject, publicKey, privateKey, now = Date.now()) {
  const pub = b64u.dec(publicKey);
  const key = await subtle.importKey("jwk", jwk(pub, b64u.dec(privateKey)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u.enc(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u.enc(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + body)));
  return "vapid t=" + head + "." + body + "." + b64u.enc(sig) + ", k=" + publicKey;
}

/** Eine Nachricht an ein Abo schicken. Ergebnis: {ok, status, gone} (gone = Abo ungültig → löschen) */
export async function sendPush(sub, message, vapid, fetchFn = fetch) {
  const body = await encrypt(JSON.stringify(message), sub.keys.p256dh, sub.keys.auth);
  const r = await fetchFn(sub.endpoint, { method: "POST", headers: { TTL: "43200", Urgency: "normal", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
    Authorization: await vapidAuth(sub.endpoint, vapid.subject, vapid.publicKey, vapid.privateKey) }, body });
  return { ok: r.ok, status: r.status, gone: r.status === 404 || r.status === 410 };
}
