/* =====================================================================
   LERN-COCKPIT · PUSH-ERINNERUNGEN
   Meldet dieses Gerät für Push an (Web Push, VAPID) und speichert das Abo in
   „einstellungen.push_subs“. Die Edge Function „push-reminder“ schickt alle
   15 Minuten fällige Erinnerungen – auch wenn die App geschlossen ist.
   Einrichtung auf dem Server: docs/PUSH.md. Der öffentliche Schlüssel hier
   ist öffentlich und unbedenklich; der private liegt nur als Secret in Supabase.
   ===================================================================== */
const VAPID_PUBLIC = "BGaHMIcRxYFempJIKVN333Keyy_ls30XZfsTzKULPRwZFFxvx0K32lUBQQcIOfDtGBO4qACgkveMXyTr_YFWNmg";
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
function pushSupported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && location.protocol === "https:"; }
let PUSH = { sub: null, checked: false, busy: false, msg: "" };
const b64uToBytes = s => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function pushReg() { return navigator.serviceWorker.getRegistration() .then(r => r || navigator.serviceWorker.register("sw.js")).then(() => navigator.serviceWorker.ready); }
async function pushRefresh() {
  if (!pushSupported()) { PUSH.checked = true; return; }
  try { const reg = await pushReg(); PUSH.sub = await reg.pushManager.getSubscription(); } catch (e) { PUSH.sub = null; }
  PUSH.checked = true;
}
const pushSubs = () => setting("push_subs", []) || [];
const pushOn = () => !!(PUSH.sub && pushSubs().some(s => s.endpoint === PUSH.sub.endpoint));

/** Gerät anmelden, Abo speichern, Probe-Nachricht schicken */
async function pushEnable() {
  PUSH.busy = true; PUSH.msg = ""; route();
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw Object.assign(new Error("Benachrichtigungen sind blockiert – erlaube sie in den Browser-/Handy-Einstellungen für diese Seite."), { user: true });
    const reg = await pushReg();
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(VAPID_PUBLIC) });
    const j = sub.toJSON(); PUSH.sub = sub;
    const list = pushSubs().filter(s => s.endpoint !== j.endpoint).concat([{ endpoint: j.endpoint, keys: j.keys, geraet: isIOS() ? "iPhone/iPad" : /android/i.test(navigator.userAgent) ? "Android" : "Computer", seit: todayISO() }]);
    await setSetting("push_subs", list); await setSetting("push_aus", false); await Api.idle();
    try { await Api.invoke("push-reminder", { mode: "test", endpoint: j.endpoint }, { timeoutMs: 20000 }); PUSH.msg = "Erinnerungen sind an – gleich kommt eine Probe-Nachricht."; }
    catch (e) { PUSH.msg = e.code === "not_deployed" || e.code === "unreachable" ? "Dieses Gerät ist angemeldet. Damit Nachrichten kommen, muss der Server-Teil einmal eingerichtet werden (Anleitung: docs/PUSH.md)." : e.code === "not_configured" ? "Angemeldet – auf dem Server fehlen noch die Schlüssel (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)." : "Angemeldet, aber die Probe-Nachricht kam nicht durch: " + (e.message || e); }
  } catch (e) { PUSH.msg = e.user ? e.message : "Anmelden hat nicht geklappt: " + (e.message || e); }
  finally { PUSH.busy = false; route(); }
}
async function pushDisable() {
  PUSH.busy = true; route();
  try { const ep = PUSH.sub && PUSH.sub.endpoint; if (PUSH.sub) await PUSH.sub.unsubscribe().catch(() => {}); PUSH.sub = null; await setSetting("push_subs", pushSubs().filter(s => s.endpoint !== ep)); PUSH.msg = "Erinnerungen auf diesem Gerät sind aus."; }
  finally { PUSH.busy = false; route(); }
}
function pushCard() {
  if (!PUSH.checked) { pushRefresh().then(() => { if (ROUTE.name === "einstellungen") route(); }); }
  const iosHint = isIOS() && !isStandalone() ? '<div class="notice" style="margin-top:var(--s3)"><span class="dot" style="background:var(--orange)"></span><span><b>iPhone:</b> Push geht nur, wenn die App auf dem Home-Bildschirm liegt. Tippe in Safari auf „Teilen“ → „Zum Home-Bildschirm“ und öffne das Cockpit von dort. Dann hier einschalten.</span></div>' : '';
  const state = !pushSupported() ? '<div class="hint">Dieser Browser kann keine Push-Nachrichten' + (location.protocol !== "https:" ? " (nur über https)" : "") + '.</div>' + iosHint
    : pushOn() ? '<div class="hint">✓ Auf diesem Gerät an. Du bekommst Erinnerungen ab ' + esc(setting("erinnerung_uhrzeit", "18:00")) + ' Uhr, wenn dein Tagesziel offen ist, um 21 Uhr, wenn deine Serie in Gefahr ist, und vor Klausuren (7, 3 und 1 Tag vorher).</div>'
      + '<div style="display:flex;gap:var(--s2);flex-wrap:wrap;margin-top:var(--s3)"><button class="btn sm" id="pu_test"' + (PUSH.busy ? " disabled" : "") + '>Probe-Nachricht</button><button class="btn sm" id="pu_off"' + (PUSH.busy ? " disabled" : "") + '>Ausschalten</button></div>'
      : '<div class="hint">Erinnerungen kommen auch, wenn die App zu ist – z. B. „🔥 Deine Serie ist in Gefahr!“ oder „Französisch-Klausur in 3 Tagen“.</div>' + iosHint + '<button class="btn primary sm" id="pu_on" style="margin-top:var(--s3)"' + (PUSH.busy ? " disabled" : "") + '>Push-Erinnerungen einschalten</button>';
  const others = pushSubs().length - (pushOn() ? 1 : 0);
  return '<div class="card mt" id="push_card"><h2>Push-Erinnerungen</h2>' + state + (others > 0 ? '<div class="t-sub" style="margin-top:var(--s2)">Außerdem auf ' + plural(others, "weiterem Gerät", "weiteren Geräten") + ' an.</div>' : '') + (PUSH.msg ? '<div class="hint" style="margin-top:var(--s3)"><b>' + esc(PUSH.msg) + '</b></div>' : '') + '</div>';
}
function bindPush() {
  const q = id => document.getElementById(id);
  const on = q("pu_on"); if (on) on.onclick = pushEnable;
  const off = q("pu_off"); if (off) off.onclick = pushDisable;
  const t = q("pu_test"); if (t) t.onclick = async () => { t.disabled = true; try { await Api.invoke("push-reminder", { mode: "test", endpoint: PUSH.sub.endpoint }, { timeoutMs: 20000 }); toast("Probe-Nachricht ist unterwegs"); } catch (e) { toast("Probe-Nachricht ging nicht: " + (e.code === "not_deployed" || e.code === "unreachable" ? "Server-Teil noch nicht eingerichtet (docs/PUSH.md)" : e.message), true); } t.disabled = false; };
}
/* in die Einstellungen einhängen (ganz oben) */
const V_einstellungen_push = V.einstellungen, bindEinstellungen_push = bindEinstellungen;
V.einstellungen = () => { const h = V_einstellungen_push(); return engineReady() ? pushCard() + h : h; };
bindEinstellungen = function () { bindEinstellungen_push(); bindPush(); };
/* beim Start prüfen, ob dieses Gerät schon angemeldet ist (für den Hinweis im Dashboard) */
window.addEventListener("load", () => setTimeout(() => pushRefresh().then(() => { if (ROUTE.name === "dashboard" && !document.getElementById("mbg")) route(); }), 1500));
