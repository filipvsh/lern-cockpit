/* =====================================================================
   LERN-COCKPIT · FEHLERHEFT
   Alles, was in Mathe-Übungen, Grammatik-Drill und Probe-Klausuren/-Arbeiten
   falsch war, an einem Ort – mit „Fehler üben“. Eine Aufgabe verschwindet,
   sobald sie im Fehler-Üben richtig gelöst wurde (oder per „Kann ich jetzt“).
   Gespeichert in einstellungen.fehlerheft = [{ id, src, key, topic, fach,
   prompt, answer, given, d, n }]  (src: "mathe" | "drill")
   #/fehler[?fach=…]
   ===================================================================== */
const FEHLER_MAX = 150;
let FEHLER_SAVE = null;
const fehlerAll = () => (setting("fehlerheft", []) || []).filter(e => e && e.key);
const fehlerOf = f => fehlerAll().filter(e => e.fach === f);
function fehlerStore(list) {
  STATE.settings.fehlerheft = list.slice(-FEHLER_MAX);
  clearTimeout(FEHLER_SAVE); FEHLER_SAVE = setTimeout(() => setSetting("fehlerheft", STATE.settings.fehlerheft), 1500);
}
const fehlerFlush = async () => { if (FEHLER_SAVE) { clearTimeout(FEHLER_SAVE); FEHLER_SAVE = null; await setSetting("fehlerheft", fehlerAll()); } };
/** Fehler merken (gleiche Aufgabe → Zähler hoch, neueste Form behalten) */
function fehlerAdd(e) {
  const list = fehlerAll(); const id = e.src + ":" + e.key; const old = list.find(x => x.id === id);
  const row = Object.assign({}, e, { id, d: todayISO(), n: old ? (old.n || 1) + 1 : 1, given: String(e.given == null ? "" : e.given).slice(0, 80), prompt: String(e.prompt || "").slice(0, 200), answer: String(e.answer || "").slice(0, 120) });
  fehlerStore(list.filter(x => x.id !== id).concat([row]));
}
function fehlerResolve(src, key) { const id = src + ":" + key; const list = fehlerAll(); if (list.some(x => x.id === id)) fehlerStore(list.filter(x => x.id !== id)); }
/** Anzeige-Name einer Gruppe */
function fehlerGroupName(e) {
  if (e.src === "drill") { const t = DRILL.TOPICS.find(x => x.id === e.topic); return "Grammatik · " + (t ? t.short : e.topic); }
  const it = typeof MC !== "undefined" && MC.ITEMS.find(i => i.keys.includes(e.key)); if (it) return "Checkliste " + it.nr + " · " + it.short;
  const t = MK.TOPICS.find(x => e.key.startsWith(x.id + ":")); return t ? t.title : "Mathe";
}
const fehlerGroupKey = e => e.src === "drill" ? "drill:" + e.topic : "mathe";
const givenText = g => g === "none" ? "keine Lösung" : Array.isArray(g) ? g.filter(x => String(x || "").trim()).join(" | ") : g == null ? "" : String(g);

V.fehler = () => {
  const f = ROUTE.query.fach || ""; const list = fehlerAll().filter(e => !f || e.fach === f).slice().reverse();
  const head = pageHead("📕 Fehlerheft" + (f ? " · " + esc(f) : ""), { back: f ? ["#/fach/" + encodeURIComponent(f), f] : ["#/faecher", "Fächer"], sub: "Hier landet alles, was du falsch hattest. Übe genau diese Aufgaben – richtig gelöst, verschwinden sie." });
  if (!list.length) return head + '<div class="card">' + emptyState("check", "Keine offenen Fehler", "Super! Sobald du in Mathe-Übungen, im Grammatik-Drill oder in Probe-Klausuren etwas falsch hast, steht es hier.") + '</div>';
  const groups = {}; list.forEach(e => { const g = fehlerGroupKey(e); (groups[g] = groups[g] || []).push(e); });
  return head + '<div class="fe-sum card"><b>' + plural(list.length, "Aufgabe", "Aufgaben") + '</b> zum Üben' + (f ? "" : " in " + plural([...new Set(list.map(e => e.fach))].length, "Fach", "Fächern")) + '</div>' +
    Object.entries(groups).map(([g, es]) => {
      const byName = {}; es.forEach(e => { const n = fehlerGroupName(e); (byName[n] = byName[n] || []).push(e); });
      return '<div class="card fe-group"><div class="km-row-h"><h2 style="margin:0">' + esc(es[0].fach) + (g.startsWith("drill:") ? " · Grammatik" : "") + '</h2><button class="btn primary sm" data-fepractice="' + esc(g) + '">' + ICO.play + 'Fehler üben (' + es.length + ')</button></div>' +
        Object.entries(byName).map(([n, xs]) => '<div class="fe-sub">' + esc(n) + '</div>' + xs.slice(0, 12).map(e => '<div class="fe-row"><div class="fe-q">' + esc(e.prompt) + '</div><div class="fe-a">Richtig: <b>' + esc(e.answer) + '</b>' + (e.given ? ' · du: <s>' + esc(e.given) + '</s>' : '') + (e.n > 1 ? ' · <span class="fe-n">' + e.n + '× falsch</span>' : '') + '</div><button class="fe-ok" data-feok="' + esc(e.id) + '" title="Kann ich jetzt">✓</button></div>').join("")).join("") + '</div>';
    }).join("");
};
function bindFehler() {
  document.querySelectorAll("[data-feok]").forEach(b => b.onclick = async () => { const list = fehlerAll().filter(x => x.id !== b.dataset.feok); fehlerStore(list); await fehlerFlush(); route(); });
  document.querySelectorAll("[data-fepractice]").forEach(b => b.onclick = () => {
    const g = b.dataset.fepractice; const es = fehlerAll().filter(e => fehlerGroupKey(e) === g);
    if (g === "mathe") mkStart("fehler"); else drillStart(g.slice(6), es.map(e => e.key));
  });
}
