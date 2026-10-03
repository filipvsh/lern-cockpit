/* =====================================================================
   LERN-COCKPIT · DATENSCHICHT
   Supabase-Zugriff ohne SDK (REST + Auth-API), damit die App ohne
   Build-Schritt läuft.

     Auth      Anmeldung, Registrierung, Token-Erneuerung, Passwort-Reset
     REST      Anfragen mit dem Token des Nutzers (→ Row Level Security)
     Outbox    Schreibvorgänge, die offline fehlschlagen, werden lokal
               gespeichert und automatisch nachgereicht
     Snapshot  letzter geladener Datenstand für den Offline-Start
     Functions Aufruf der KI-Edge-Function mit klaren Fehlerarten

   Der anon-Schlüssel im Frontend ist öffentlich und unbedenklich – der
   Schutz der Daten kommt ausschließlich aus RLS (siehe supabase/).
   Geheime Schlüssel (service_role, Anthropic) gehören nie hierher.
   ===================================================================== */
(function (root) {
  "use strict";
  let URL_ = "", KEY = "";
  const LS_AUTH = "lc_auth", LS_OUTBOX = "lc_outbox", LS_FAILED = "lc_outbox_failed", LS_SNAP = "lc_snapshot_v3";
  const ls = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const listeners = {};
  const emit = (ev, data) => (listeners[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
  const on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };

  class ApiError extends Error {
    constructor(message, o) { super(message); Object.assign(this, { status: 0, code: "", network: false, retryable: false }, o || {}); }
  }

  /* ---------------- Auth ---------------- */
  let session = ls.get(LS_AUTH, null);
  let refreshing = null;
  const nowS = () => Math.floor(Date.now() / 1000);
  function setSession(s) {
    session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || (nowS() + (s.expires_in || 3600)), user: s.user ? { id: s.user.id, email: s.user.email, name: (s.user.user_metadata || {}).name || "" } : (session && session.user) } : null;
    if (session) ls.set(LS_AUTH, session); else ls.del(LS_AUTH);
    emit("auth", session);
  }
  async function authCall(path, body, method) {
    let r;
    try {
      r = await fetch(URL_ + "/auth/v1/" + path, { method: method || "POST", headers: { apikey: KEY, "Content-Type": "application/json", ...(session && method === "PUT" ? { Authorization: "Bearer " + session.access_token } : {}) }, body: JSON.stringify(body || {}) });
    } catch (e) { throw new ApiError("Keine Verbindung zum Server.", { network: true, retryable: true }); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(authMessage(j, r.status), { status: r.status, code: j.error_code || j.code || j.error || "" });
    return j;
  }
  function authMessage(j, status) {
    const code = j.error_code || j.code || "";
    const msg = (j.msg || j.error_description || j.message || "").toLowerCase();
    if (code === "invalid_credentials" || /invalid login/.test(msg)) return "E-Mail oder Passwort stimmt nicht.";
    if (code === "email_not_confirmed" || /not confirmed/.test(msg)) return "Bitte bestätige zuerst deine E-Mail-Adresse (Link im Postfach).";
    if (code === "user_already_exists" || /already registered/.test(msg)) return "Für diese E-Mail gibt es schon ein Konto. Melde dich an.";
    if (code === "weak_password" || /password should be/.test(msg)) return "Das Passwort ist zu kurz (mindestens 8 Zeichen).";
    if (code === "signup_disabled" || /signups not allowed/.test(msg)) return "Neue Registrierungen sind deaktiviert.";
    if (status === 429) return "Zu viele Versuche. Bitte warte kurz.";
    return "Anmeldung fehlgeschlagen (" + (j.msg || j.message || status) + ").";
  }
  async function signIn(email, password) { const j = await authCall("token?grant_type=password", { email, password }); setSession(j); return session; }
  async function signUp(email, password, name) {
    const j = await authCall("signup", { email, password, data: { name: name || "" } });
    if (j.access_token) { setSession(j); return { session, confirm: false }; }
    return { session: null, confirm: true };     // E-Mail-Bestätigung aktiv
  }
  async function recover(email) { await authCall("recover", { email, redirect_to: location.origin + location.pathname }); }
  async function updatePassword(password) { await ensureFresh(); await authCall("user", { password }, "PUT"); }
  async function signOut() {
    try { await chain; } catch (e) {}                 // laufende Schreibvorgänge noch mit gültigem Token abschließen
    const t = session && session.access_token;
    setSession(null); ls.del(LS_SNAP);
    if (t) { try { await fetch(URL_ + "/auth/v1/logout", { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + t } }); } catch (e) {} }
  }
  async function refresh() {
    if (!session || !session.refresh_token) throw new ApiError("Nicht angemeldet.", { status: 401, code: "no_session" });
    if (!refreshing) refreshing = authCall("token?grant_type=refresh_token", { refresh_token: session.refresh_token })
      .then(j => { setSession(j); return session; })
      .catch(e => { if (!e.network) setSession(null); throw e; })
      .finally(() => { refreshing = null; });
    return refreshing;
  }
  async function ensureFresh() { if (session && session.expires_at - 60 < nowS()) { try { await refresh(); } catch (e) { if (!e.network) throw e; } } }
  /** Links aus E-Mails (Bestätigung, Passwort-Reset) liefern Tokens im Hash */
  function handleRedirect() {
    const h = location.hash || "";
    if (!/access_token=/.test(h) && !/error_description=/.test(h)) return null;
    const p = new URLSearchParams(h.replace(/^#\/?/, ""));
    if (p.get("error_description")) { history.replaceState(null, "", location.pathname + "#/dashboard"); return { error: p.get("error_description") }; }
    const s = { access_token: p.get("access_token"), refresh_token: p.get("refresh_token"), expires_in: +p.get("expires_in") || 3600 };
    try { const payload = JSON.parse(atob(s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); s.user = { id: payload.sub, email: payload.email, user_metadata: payload.user_metadata || {} }; } catch (e) {}
    setSession(s);
    history.replaceState(null, "", location.pathname + "#/dashboard");
    return { type: p.get("type") || "signin" };
  }

  /* ---------------- REST ---------------- */
  function headers(extra) { return Object.assign({ apikey: KEY, Authorization: "Bearer " + (session ? session.access_token : KEY), "Content-Type": "application/json" }, extra || {}); }
  async function request(method, path, o) {
    o = o || {};
    await ensureFresh();
    let r;
    try {
      r = await fetch(URL_ + path, { method, headers: headers(Object.assign({}, o.prefer ? { Prefer: o.prefer } : {}, o.range ? { Range: o.range } : {})), body: o.body != null ? JSON.stringify(o.body) : undefined });
    } catch (e) { throw new ApiError("Keine Verbindung zum Server.", { network: true, retryable: true }); }
    if (r.status === 401 && session && !o._retried) {
      try { await refresh(); return request(method, path, Object.assign({}, o, { _retried: true })); } catch (e) { if (e.network) throw e; }
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new ApiError(j.message || j.msg || ("HTTP " + r.status), { status: r.status, code: j.code || "", retryable: r.status >= 500 || r.status === 429 || r.status === 408, detail: j.details || j.hint || "" });
    }
    if (o.raw) return r;
    if (r.status === 204) return null;
    const txt = await r.text(); return txt ? JSON.parse(txt) : null;
  }
  const rest = (table, qs) => "/rest/v1/" + table + (qs ? "?" + qs : "");
  const get = (table, qs) => request("GET", rest(table, qs || "select=*"));
  async function getAll(table, qs, pageSize) {
    const page = pageSize || 1000; let out = [], from = 0;
    for (let i = 0; i < 50; i++) {
      const rows = await request("GET", rest(table, qs), { range: from + "-" + (from + page - 1) });
      out = out.concat(rows || []); if (!rows || rows.length < page) break; from += page;
    }
    return out;
  }
  async function insert(table, row, o) { const r = await request("POST", rest(table, o && o.qs), { body: row, prefer: "return=representation" + (o && o.ignoreDuplicates ? ",resolution=ignore-duplicates" : "") }); return Array.isArray(row) ? r : (r && r[0]); }
  async function patch(table, filter, body) { return request("PATCH", rest(table, filter), { body, prefer: "return=representation" }); }
  async function del(table, filter) { return request("DELETE", rest(table, filter)); }
  async function rpc(fn, args) { return request("POST", "/rest/v1/rpc/" + fn, { body: args || {} }); }
  /** Existiert eine Tabelle? (404 / PGRST205 = fehlt) */
  async function tableExists(table) {
    try { await request("GET", rest(table, "select=id&limit=1")); return true; }
    catch (e) { if (e.network) throw e; return !(e.status === 404 || e.code === "PGRST205" || e.code === "42P01"); }
  }

  /* ---------------- Outbox (Offline-Schreibpuffer) ----------------
     Nur für idempotente Schreibvorgänge: Inserts mit vom Client erzeugter
     ID (doppelte werden ignoriert) und PATCH/DELETE per ID. */
  let outbox = ls.get(LS_OUTBOX, []);
  let flushing = false;
  const saveOutbox = () => { ls.set(LS_OUTBOX, outbox); emit("outbox", outbox.length); };
  async function sendOp(op) {
    if (op.method === "POST") return request("POST", op.path, { body: op.body, prefer: "return=minimal,resolution=ignore-duplicates" });
    if (op.method === "PATCH") return request("PATCH", op.path, { body: op.body, prefer: "return=minimal" });
    if (op.method === "DELETE") return request("DELETE", op.path);
    if (op.method === "RPC") return request("POST", op.path, { body: op.body });
  }
  /** Schreiben mit Offline-Sicherung. Ergebnis: {ok:true} oder {queued:true}. 4xx-Fehler werden geworfen.
      Alle Schreibvorgänge laufen nacheinander (Kette), damit z. B. ein PATCH nie vor seinem INSERT ankommt. */
  let chain = Promise.resolve();
  function write(method, table, filterOrNull, body) {
    const op = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), uid: session && session.user ? session.user.id : null, method, path: method === "RPC" ? "/rest/v1/rpc/" + table : rest(table, filterOrNull), body, ts: Date.now(), tries: 0 };
    const run = async () => {
      if (outbox.length) { outbox.push(op); saveOutbox(); flush(); return { queued: true }; }   // Reihenfolge wahren
      try { await sendOp(op); return { ok: true }; }
      catch (e) { if (e.network || e.retryable) { outbox.push(op); saveOutbox(); return { queued: true }; } throw e; }
    };
    const p = chain.then(run, run); chain = p.catch(() => {});
    return p;
  }
  const idle = () => chain;
  async function flush() {
    if (flushing || !outbox.length) return;
    flushing = true;
    try {
      while (outbox.length) {
        const op = outbox[0];
        // Puffer eines anderen Kontos nie unter dem aktuellen Konto senden
        if (op.uid && (!session || !session.user || session.user.id !== op.uid)) { if (!session) break; outbox.shift(); saveOutbox(); continue; }
        try { await sendOp(op); outbox.shift(); saveOutbox(); }
        catch (e) {
          if (e.network || e.retryable) { op.tries++; saveOutbox(); break; }
          const failed = ls.get(LS_FAILED, []); failed.push(Object.assign({}, op, { error: e.message, status: e.status })); ls.set(LS_FAILED, failed.slice(-50));
          outbox.shift(); saveOutbox(); emit("failed", e);
        }
      }
    } finally { flushing = false; }
    if (!outbox.length) emit("synced");
  }
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => flush());
    setInterval(() => { if (outbox.length) flush(); }, 30000);
  }

  /* ---------------- Snapshot ---------------- */
  function saveSnapshot(data) { if (!session) return; ls.set(LS_SNAP, { user: session.user && session.user.id, at: Date.now(), data }); }
  function loadSnapshot() { const s = ls.get(LS_SNAP, null); if (!s || !session || !session.user || s.user !== session.user.id) return null; return s; }

  /* ---------------- Edge Functions ---------------- */
  /** Fehlerarten: not_deployed · offline · unauthorized · rate_limited · unavailable · bad_request */
  async function invoke(fn, payload, o) {
    await ensureFresh();
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), (o && o.timeoutMs) || 90000) : null;
    let r;
    try { r = await fetch(URL_ + "/functions/v1/" + fn, { method: "POST", headers: headers(), body: JSON.stringify(payload), signal: ctrl && ctrl.signal }); }
    catch (e) { throw new ApiError(e.name === "AbortError" ? "Die KI hat zu lange gebraucht." : "Keine Verbindung.", { network: true, code: e.name === "AbortError" ? "timeout" : "offline", retryable: true }); }
    finally { if (timer) clearTimeout(timer); }
    const j = await r.json().catch(() => null);
    if (r.ok && j) return j;
    // Eigene Codes der Funktion haben Vorrang; ein 404 der Plattform heißt „Funktion nicht deployt“
    const OWN = ["not_configured", "unauthorized", "rate_limited", "refused", "unavailable", "bad_request"];
    const code = j && OWN.includes(j.code) ? j.code : r.status === 404 ? "not_deployed" : r.status === 401 ? "unauthorized" : r.status === 429 ? "rate_limited" : r.status >= 500 ? "unavailable" : "bad_request";
    throw new ApiError((j && (j.error || j.message)) || ("HTTP " + r.status), { status: r.status, code, retryable: r.status >= 500 || r.status === 429 });
  }

  root.Api = {
    configure(url, key) { URL_ = url; KEY = key; },
    ApiError, on, ls,
    get session() { return session; }, get user() { return session && session.user; },
    signIn, signUp, signOut, recover, updatePassword, refresh, handleRedirect,
    request, get, getAll, insert, patch, del, rpc, tableExists,
    write, flush, idle, get pending() { return outbox.length; }, failed: () => ls.get(LS_FAILED, []), clearFailed: () => ls.del(LS_FAILED),
    saveSnapshot, loadSnapshot, invoke
  };
})(typeof window !== "undefined" ? window : globalThis);
