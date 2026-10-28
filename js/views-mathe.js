/* =====================================================================
   LERN-COCKPIT · MATHE-KURS – Oberfläche
   #/mathe                 Checkliste 1. Klausur (14 Punkte + Material), Probe-Klausur,
                           Potenz-Blitz, Extra-Kurs Potenzfunktionen
   #/mathe/ck-<Nr>         Punkt der Checkliste: Erklärung, Auf Papier/iPad, Üben
   #/mathe/<Thema>         Extra-Kurs: Merkzettel, Beispiel mit Lösungsweg, Start
   #/mathe/<Thema>?run=1   Übungsrunde (Hilfen je nach Modus)
   #/mathe/test            Probe-Klausur: ohne Hilfe, Note am Ende
   #/mathe/blitz           60 Sekunden so viele Aufgaben wie möglich
   Lernstand in einstellungen.mathe_kurs = { Typ: {b, r, w} },
   Ergebnisse in einstellungen.mathe_tests, Selbsteinschätzung je Punkt
   in einstellungen.mathe_check = { Nr: "ok" | "mid" | "no" }.
   ===================================================================== */
let MKR = null;   // laufende Runde
let MKT = null;   // laufende Probe-Klausur
let MKB = null;   // laufender Blitz
let MK_SAVE = null;
const mkStats = () => setting("mathe_kurs", {}) || {};
function mkSave(stats) { STATE.settings.mathe_kurs = stats; clearTimeout(MK_SAVE); MK_SAVE = setTimeout(() => setSetting("mathe_kurs", stats), 1200); }
const mkLvl = () => ({ leicht: 0, normal: 1, schwer: 2 })[lernModus("ma")];
const mkTopic = () => MK.TOPICS.find(t => t.id === ROUTE.sub);
const MK_DONE = 80;
const ckStatus = () => setting("mathe_check", {}) || {};
/** Lern-Einheit: Thema des Extra-Kurses oder Punkt der Checkliste */
function mkUnit(id) {
  if (String(id).startsWith("ck-")) { const it = MC.item(id.slice(3)); return it && { id, keys: it.keys, title: it.nr + " · " + it.short, ico: "✅", back: "#/mathe/" + id, item: it }; }
  const t = MK.TOPICS.find(x => x.id === id); return t && { id, keys: MK.types(id), title: t.title, ico: t.ico, back: "#/mathe/" + id, topic: t };
}
/** Aufgaben mit echtem Rechenweg → Hinweis „auf Papier / iPad rechnen“ */
const MK_PAPER = /^(ck:(npq|splq|splin|sach|table|tab2eq|lin2pts|xquad|xlin|nsq|nausk|nfactor|fval2|yint|nlin)|werte:(f|a)|gleich:|gesetze:coef|trafo:build)/;
const mkPaperHint = it => MK_PAPER.test(it.key) ? '<div class="mk-paper">✍️ <span>Rechne auf <b>Papier oder iPad</b> mit – so wie in der Klausur – und tippe dann nur das Ergebnis ein.</span></div>' : '';
const mkMd = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

V.mathe = () => {
  if (!engineReady()) return pageHead("Mathe-Kurs") + setupCard();
  if (ROUTE.sub === "test") return mkExam();
  if (ROUTE.sub === "blitz") return mkBlitz();
  if (ROUTE.query.run && MKR && MKR.topic === ROUTE.sub) return mkRun();
  if (ROUTE.sub.startsWith("ck-") && MC.item(ROUTE.sub.slice(3))) return ckPage(MC.item(ROUTE.sub.slice(3)));
  const t = mkTopic();
  if (!t) return mkHome();
  return mkTopicPage(t);
};
function bindMathe() {
  bindModeSeg();
  document.querySelectorAll("[data-game]").forEach(b => b.onclick = () => startGame(b.dataset.game, ""));
  document.querySelectorAll("[data-mkstart]").forEach(b => b.onclick = () => mkStart(b.dataset.mkstart));
  if (ROUTE.sub === "test") return bindMkExam();
  if (ROUTE.sub === "blitz") return bindMkBlitz();
  if (ROUTE.query.run && MKR) return bindMkRun();
  document.querySelectorAll("[data-ckst]").forEach(b => b.onclick = async () => { const [nr, v] = b.dataset.ckst.split(":"); const all = Object.assign({}, ckStatus()); if (all[nr] === v) delete all[nr]; else all[nr] = v; await setSetting("mathe_check", all); route(); });
  document.querySelectorAll("[data-ckpack]").forEach(b => b.onchange = async () => { const all = Object.assign({}, setting("mathe_pack", {}) || {}); all[b.dataset.ckpack] = b.checked; await setSetting("mathe_pack", all); });
}
function mkStart(topic) {
  const u = mkUnit(topic); if (!u || !u.keys.length) return;
  MKR = { topic, items: MK.roundKeys(u.keys, mkStats(), mkLvl(), 10, Math.random, GRAPH_FUNCS), i: 0, right: 0, ui: {}, retries: {}, wrong: [], done: false, mode: lernModus("ma") };
  MKR.total = MKR.items.length;
  const h = "#/mathe/" + topic + "?run=1"; if (location.hash === h) route(); else location.hash = h;
}

/* ---------- Checkliste (Startseite) ---------- */
const CK_ST = [["ok", "✅", "Kann ich"], ["mid", "🟡", "Unsicher"], ["no", "❌", "Noch nicht"]];
function ckRow(it) {
  const st = ckStatus()[it.nr]; const p = it.keys.length ? MK.progressKeys(it.keys, mkStats()) : null; const icon = st ? CK_ST.find(x => x[0] === st)[1] : "";
  return '<a class="ck-row' + (st ? " " + st : "") + '" href="#/mathe/ck-' + it.nr + '"><span class="ck-nr">' + it.nr + '</span><div class="ck-main"><b>' + esc(it.short) + '</b><span class="ck-t">' + esc(it.title) + '</span>' +
    (p != null ? '<span class="ck-p">' + progBar(p, p >= MK_DONE ? "g" : "") + '<i>' + p + ' %</i></span>' : '') + '</div><span class="ck-st">' + icon + '</span><span class="chev">' + ICO.chev + '</span></a>';
}
function mkHome() {
  const st = ckStatus(); const ok = MC.ITEMS.filter(i => st[i.nr] === "ok").length; const last = (setting("mathe_tests", []) || []).slice(-1)[0];
  const areas = [...new Set(MC.ITEMS.map(i => i.area))];
  const next = MC.ITEMS.find(i => st[i.nr] !== "ok" && i.keys.length);
  const ps = MK.TOPICS.map(t => MK.progress(t.id, mkStats()));
  return pageHead("Mathe: Checkliste 1. Klausur EF", { back: ["#/dashboard", "Start"], sub: "Tippe auf einen Punkt: Erklärung, Aufgaben fürs Heft/iPad und Übungen. Markiere, was du schon kannst." }) +
    '<div class="card ck-sum"><div><b>' + ok + ' von ' + MC.ITEMS.length + '</b> Punkten: „Kann ich“</div>' + progBar(Math.round(ok / MC.ITEMS.length * 100), ok === MC.ITEMS.length ? "g" : "") +
    (next ? '<a class="btn primary ck-next" href="#/mathe/ck-' + next.nr + '">' + ICO.play + 'Weiter mit ' + next.nr + ' · ' + esc(next.short) + '</a>' : '') + '</div>' +
    modeSeg("ma") + areas.map(a => '<div class="card ck-area"><h2>' + esc(a) + '</h2>' + MC.ITEMS.filter(i => i.area === a).map(ckRow).join("") + '</div>').join("") +
    '<div class="mk-course"><a class="card mk-step mk-exam" href="#/mathe/test"><span class="mk-n">📝</span><div><b>Probe-Klausur (App)</b><span class="t-sub">16 Aufgaben aus der Checkliste · ohne Hilfe · mit Note' + (last ? ' · zuletzt Note ' + last.note : '') + '</span></div><span class="chev">' + ICO.chev + '</span></a></div>' +
    '<div class="card ck-book"><b>📚 Außerdem aus dem Buch</b><ul><li>Probeklausur <b>S. 37</b> (ohne Nr. 2d und Nr. 5) – Lösungen <b>S. 231 f.</b></li><li>Alle Lösungen zu den Übungen ab <b>S. 223</b> · Rückblick <b>S. 36</b></li><li>Trainingsblätter auf <b>Logineo</b></li></ul></div>' +
    '<div class="mk-extra"><a class="card mk-x" href="#/mathe/blitz"><span>⚡</span><div><b>Potenz-Blitz</b><span class="t-sub">60 Sekunden, so viele wie möglich' + (lsGet("lc_mk_blitz", null) ? ' · Rekord ' + lsGet("lc_mk_blitz", 0) : '') + '</span></div></a>' +
    '<button class="card mk-x" data-game="graph"><span>📈</span><div><b>Graphen-Quiz</b><span class="t-sub">Graph ansehen, Funktion antippen</span></div></button></div>' +
    '<details class="card ck-extra"><summary><b>Extra: Potenzfunktionen vertiefen</b> <span class="t-sub">7 Schritte · ' + ps.filter(p => p >= MK_DONE).length + ' geschafft</span></summary><div class="mk-course">' +
    MK.TOPICS.map((t, i) => '<a class="card mk-step' + (ps[i] >= MK_DONE ? " done" : "") + '" href="#/mathe/' + t.id + '"><span class="mk-n">' + (ps[i] >= MK_DONE ? "✓" : i + 1) + '</span><div><b>' + t.ico + ' ' + esc(t.title) + '</b>' + progBar(ps[i], ps[i] >= MK_DONE ? "g" : "") + '</div><span class="chev">' + ICO.chev + '</span></a>').join("") + '</div></details>';
}

/* ---------- Punkt der Checkliste ---------- */
function ckPage(it) {
  const st = ckStatus()[it.nr]; const id = "ck-" + it.nr; const p = it.keys.length ? MK.progressKeys(it.keys, mkStats()) : null;
  const i = MC.ITEMS.indexOf(it), prev = MC.ITEMS[i - 1], next = MC.ITEMS[i + 1];
  const learn = it.learn.map(b => '<div class="ck-b">' + (b.h ? '<h3>' + esc(b.h) + '</h3>' : '') + (b.t ? '<p>' + mkMd(b.t) + '</p>' : '') + (b.f ? '<div class="ck-f">' + mkMd(b.f) + '</div>' : '') + (b.ex ? '<div class="ck-ex"><span>Beispiel</span><ol>' + b.ex.map(x => '<li>' + mkMd(x) + '</li>').join("") + '</ol></div>' : '') + '</div>').join("");
  const paper = it.paper.concat(it.book.filter(x => /^S\./.test(x)).length ? ["**Buch:** " + it.book.join(" · ") + " – Lösungen im Buch ab S. 223"] : it.book.length ? ["**" + it.book.join(", ") + "** durchlesen"] : []);
  const pack = it.pack ? '<div class="card ck-pack"><h2>🎒 Checkliste zum Abhaken</h2>' + it.pack.map(x => '<label><input type="checkbox" data-ckpack="' + esc(x) + '"' + ((setting("mathe_pack", {}) || {})[x] ? " checked" : "") + '> ' + esc(x) + '</label>').join("") + '<p class="t-sub">Formelsammlung wird gestellt.</p></div>' : '';
  return '<a class="backlink" href="#/mathe">' + ICO.back + 'Checkliste</a><div class="dr-head"><div class="ck-area-l">' + esc(it.area) + ' · Punkt ' + it.nr + '</div><h1 class="t-large ck-h">' + esc(it.short) + '</h1><div class="ck-quote">„' + esc(it.title) + '“</div>' + (p != null ? '<div class="t-sub">' + p + ' % geübt</div>' + progBar(p, p >= MK_DONE ? "g" : "") : '') + '</div>' +
    '<div class="card ck-self"><b>Wie sicher bist du?</b><div class="seg">' + CK_ST.map(([k, ic, l]) => '<button class="' + (st === k ? "on" : "") + '" data-ckst="' + it.nr + ':' + k + '">' + ic + ' ' + l + '</button>').join("") + '</div></div>' +
    (it.keys.length ? modeSeg("ma") + '<button class="btn primary lg wide dr-go" data-mkstart="' + id + '">' + ICO.play + 'Üben (10 Aufgaben)</button>' : '') + pack +
    '<div class="card ck-learn"><h2>📖 Erklärung</h2>' + learn + '</div>' +
    (paper.length ? '<div class="card ck-paper"><h2>✍️ Auf Papier / iPad</h2><p class="t-sub">Das solltest du wirklich aufschreiben – in der Klausur zählt der Rechenweg.</p><ul>' + paper.map(x => '<li>' + mkMd(x) + '</li>').join("") + '</ul></div>' : '') +
    (it.gg ? '<a class="card mk-video" href="https://www.geogebra.org/graphing" target="_blank" rel="noopener">📐 <span>GeoGebra öffnen (geogebra.org/graphing)</span></a>' : '') +
    '<div class="ck-nav">' + (prev ? '<a class="btn" href="#/mathe/ck-' + prev.nr + '">← ' + prev.nr + ' · ' + esc(prev.short) + '</a>' : '<span></span>') + (next ? '<a class="btn" href="#/mathe/ck-' + next.nr + '">' + next.nr + ' · ' + esc(next.short) + ' →</a>' : '') + '</div>';
}
/** Karte für Klausur-Modus */
function matheCard() {
  const ok = MC.ITEMS.filter(i => ckStatus()[i.nr] === "ok").length;
  return '<a class="card dr-card mk-card" href="#/mathe"><span class="dr-ic">📐</span><span class="dr-tx"><b>Checkliste 1. Klausur – lernen & üben</b><span class="t-sub">' + ok + ' von ' + MC.ITEMS.length + ' Punkten „Kann ich“ · Erklärungen, Heft-Aufgaben, Probe-Klausur</span></span><span class="chev">' + ICO.chev + '</span></a>';
}

/* ---------- Thema: Merkzettel + Beispiel ---------- */
function mkCard(t) {
  return '<table class="mk-rules">' + t.card.map(([a, b, c]) => '<tr><td class="mk-a">' + esc(a) + '</td><td class="mk-b">' + esc(b) + '</td><td class="t-sub">' + esc(c) + '</td></tr>').join("") + '</table>';
}
function mkTopicPage(t) {
  const p = MK.progress(t.id, mkStats());
  let seed = 7; const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const ex = MK.make(MK.types(t.id)[0], 0, rng, GRAPH_FUNCS);
  const exQ = ex.kind === "graph" ? '<div class="mk-graph sm">' + graphSvg(GRAPH_FUNCS.find(f => f.id === ex.fid).f) + '</div>' : '<div class="mk-exq">' + esc(ex.prompt) + '</div>';
  return '<a class="backlink" href="#/mathe">' + ICO.back + 'Checkliste</a><div class="dr-head"><h1 class="t-large">' + t.ico + ' ' + esc(t.title) + '</h1><div class="t-sub">' + p + ' % sicher' + (p >= MK_DONE ? ' – geschafft ✓' : '') + '</div>' + progBar(p, p >= MK_DONE ? "g" : "") + '</div>' +
    modeSeg("ma") + '<button class="btn primary lg wide dr-go" data-mkstart="' + t.id + '">' + ICO.play + 'Übung starten (10 Aufgaben)</button>' +
    '<div class="card mk-sheet"><h2>📋 Merkzettel</h2>' + mkCard(t) + '</div>' +
    '<div class="card mk-sheet"><h2>✏️ So geht\'s – Beispiel</h2>' + exQ + '<ol class="mk-steps">' + ex.steps.map(s => '<li>' + esc(s) + '</li>').join("") + '</ol><div class="mk-ans">Lösung: <b>' + esc(MK.answerText(ex)) + '</b></div></div>' +
    (t.video ? '<a class="card mk-video" href="https://www.youtube.com/watch?v=' + t.video + '" target="_blank" rel="noopener">▶️ <span>Erklärvideo ansehen</span></a>' : '');
}

/* ---------- Aufgabe anzeigen (Runde, Probe-Klausur, Blitz) ---------- */
/** Graph aus Punktlisten (Checkliste): Bereich, Kurven, markierte Punkte */
function curveSvg(pl) {
  const [X0, X1, Y0, Y1] = pl.range || [-5, 5, -5, 5]; const W = 300, H = 300; const cid = "cv" + (++GRAPH_N);
  const sx = x => (x - X0) / (X1 - X0) * W, sy = y => H - (y - Y0) / (Y1 - Y0) * H;
  let g = "";
  for (let x = Math.ceil(X0); x <= X1; x++) g += '<line x1="' + sx(x) + '" y1="0" x2="' + sx(x) + '" y2="' + H + '" class="g' + (x === 0 ? " ax" : "") + '"/>' + (x && x > X0 && x < X1 ? '<text x="' + (sx(x) - 3) + '" y="' + (sy(0) + 13) + '">' + x + '</text>' : "");
  for (let y = Math.ceil(Y0); y <= Y1; y++) g += '<line x1="0" y1="' + sy(y) + '" x2="' + W + '" y2="' + sy(y) + '" class="g' + (y === 0 ? " ax" : "") + '"/>' + (y && y < Y1 && y > Y0 ? '<text x="' + (sx(0) + 4) + '" y="' + (sy(y) + 4) + '">' + y + '</text>' : "");
  const paths = (pl.curves || []).map(c => '<path class="curve" clip-path="url(#' + cid + ')" d="' + c.map((p, i) => (i ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(Math.max(-40, Math.min(40, p[1]))).toFixed(1)).join("") + '"/>').join("");
  const dots = (pl.dots || []).map(d => '<circle class="dot" cx="' + sx(d[0]) + '" cy="' + sy(d[1]) + '" r="4.5"/>').join("");
  return '<svg class="graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Graph"><defs><clipPath id="' + cid + '"><rect width="' + W + '" height="' + H + '"/></clipPath></defs>' + g + '<text x="' + (W - 10) + '" y="' + (sy(0) - 6) + '" class="axl">x</text><text x="' + (sx(0) + 6) + '" y="12" class="axl">y</text>' + paths + dots + '</svg>';
}
const mkTable = tb => '<table class="mk-tab"><tr><th>x</th>' + tb.x.map(v => '<td>' + MK.fmt(v) + '</td>').join("") + '</tr><tr><th>y</th>' + tb.y.map(v => '<td>' + MK.fmt(v) + '</td>').join("") + '</tr></table>';
function mkQ(it) {
  if (it.plot) return '<div class="mk-graph">' + curveSvg(it.plot) + '</div><div class="mk-q sm">' + esc(it.prompt) + '</div>';
  if (it.table) return '<div class="mk-q sm">' + esc(it.prompt) + '</div>' + mkTable(it.table);
  if (it.kind === "graph") return '<div class="mk-graph">' + graphSvg(GRAPH_FUNCS.find(f => f.id === it.fid).f) + '</div><div class="mk-q sm">' + esc(it.prompt) + '</div>';
  return '<div class="mk-q">' + esc(it.prompt) + '</div>';
}
/** Eingabe je Art; ui.given hält den Stand; done: schon geprüft */
function mkInput(it, ui, done) {
  const dis = done ? " disabled" : "", ro = done ? " readonly" : "";
  const inp = (id, v, ph) => '<input class="answer-input mk-in" data-mkin="' + id + '" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="' + (ph || "") + '" value="' + esc(v || "") + '"' + ro + '>';
  const keys = done ? '' : '<div class="mk-keys"><button data-mkkey="-">− minus</button><button data-mkkey=",">, Komma</button><button data-mkkey="/">/ Bruch</button></div>';
  if (it.kind === "chip" || it.kind === "graph") return '<div class="mk-chips' + (it.kind === "graph" ? " g" : "") + '">' + it.opts.map((o, k) => '<button class="les-opt' + (ui.given === k ? " on" : "") + (done ? (k === it.answer ? " right" : ui.given === k ? " wrongpick" : "") : "") + '" data-mkc="' + k + '"' + dis + '>' + esc(o) + '</button>').join("") + '</div>';
  const g = Array.isArray(ui.given) ? ui.given : [];
  if (it.kind === "num") return '<div class="mk-ask">' + esc(it.ask || "Ergebnis") + '</div>' + inp(0, typeof ui.given === "string" ? ui.given : "", "z. B. 4 oder 0,5") + keys;
  if (it.kind === "pair") return it.labels ? '<div class="mk-pair">' + it.labels.map((l, k) => '<label><span>' + esc(l) + '</span>' + inp(k, g[k]) + '</label>').join("") + '</div>' + keys
    : '<div class="mk-pair pt"><span class="mk-br">(</span>' + inp(0, g[0], "x") + '<span class="mk-br">|</span>' + inp(1, g[1], "y") + '<span class="mk-br">)</span></div>' + keys;
  if (it.kind === "text") return '<div class="mk-ask">' + esc(it.ask || "Eingabe") + '</div><input class="answer-input mk-in mk-txt" data-mkin="0" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="z. B. x^2+1" value="' + esc(typeof ui.given === "string" ? ui.given : "") + '"' + ro + '>' +
    (done ? '' : '<div class="mk-keys">' + ["^", "(", ")", "/", "sqrt(", "-"].map(k => '<button data-mkkey="' + k + '">' + k + '</button>').join("") + '</div>');
  if (it.kind === "nums") return '<div class="mk-pair"><label><span>x₁ =</span>' + inp(0, ui.given === "none" ? "" : g[0]) + '</label><label><span>x₂ =</span>' + inp(1, ui.given === "none" ? "" : g[1]) + '</label></div>' +
    '<div class="mk-none"><button class="btn sm' + (ui.given === "none" ? " primary" : "") + '" data-mknone' + dis + '>keine Lösung</button><span class="t-sub">Nur eine Lösung? Zweites Feld leer lassen.</span></div>' + keys;
  return "";
}
const mkFilled = (it, g) => it.kind === "chip" || it.kind === "graph" ? g != null : it.kind === "num" || it.kind === "text" ? !!String(g || "").trim() : it.kind === "nums" ? g === "none" || (Array.isArray(g) && g.some(x => String(x || "").trim())) : Array.isArray(g) && g.filter(x => String(x || "").trim()).length === it.answer.length;
/** Eingaben verdrahten; onChange(given), onEnter() */
function bindMkInput(it, ui, onChange, onEnter) {
  let last = null;
  const read = () => { const vals = [...document.querySelectorAll("[data-mkin]")].map(x => x.value); ui.given = it.kind === "num" || it.kind === "text" ? vals[0] : vals; onChange(); };
  document.querySelectorAll("[data-mkin]").forEach(x => { x.onfocus = () => { last = x; ui.f = +x.dataset.mkin; }; x.oninput = () => { if (ui.given === "none") ui.given = []; read(); }; x.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); const nx = document.querySelector('[data-mkin="' + (+x.dataset.mkin + 1) + '"]'); if (nx && !nx.value) nx.focus(); else onEnter(); } }; });
  // nach einem Neuzeichnen im selben Feld weiterschreiben (nicht ins erste springen)
  const first = document.querySelector("[data-mkin]:not([readonly])");
  const cur = document.querySelector('[data-mkin="' + (ui.f || 0) + '"]:not([readonly])') || first;
  if (cur) { const v = cur.value.length; cur.focus(); try { cur.setSelectionRange(v, v); } catch (e) {} last = cur; }
  document.querySelectorAll("[data-mkkey]").forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { const x = last || first; if (!x) return; const k = b.dataset.mkkey; const s = x.selectionStart ?? x.value.length; if (k === "-" && s === 0 && x.value.startsWith("-")) { x.value = x.value.slice(1); } else { x.value = x.value.slice(0, s) + k + x.value.slice(x.selectionEnd ?? s); x.setSelectionRange(s + k.length, s + k.length); } x.focus(); read(); }; });
  document.querySelectorAll("[data-mkc]").forEach(b => b.onclick = () => { ui.given = +b.dataset.mkc; onChange(true); });
  const no = document.querySelector("[data-mknone]"); if (no) no.onclick = () => { ui.given = ui.given === "none" ? [] : "none"; onChange(true); };
}

/* ---------- Übungsrunde ---------- */
function mkRun() {
  const R = MKR; if (R.done) return mkEnd();
  const it = R.items[R.i], ui = R.ui; const t = mkUnit(R.topic);
  const pct = Math.round(R.i / R.items.length * 100);
  const top = '<div class="les-top"><a class="closebtn" href="' + t.back + '" aria-label="Runde beenden">' + ICO.x + '</a><div class="les-prog"><i style="width:' + pct + '%"></i></div><span class="les-combo dim">' + R.right + '</span></div>';
  const help = ui.checked ? '' : R.mode === "leicht" ? '<details class="dr-spick mk-help" open><summary>📋 Merkzettel</summary><div class="mk-rule">' + esc(it.rule) + '</div></details>' + (ui.steps ? '' : '<div class="dr-tipw"><button class="btn sm" id="mk_steps">👣 Lösungsweg zeigen</button></div>')
    : R.mode === "normal" ? (ui.tip ? '<div class="dr-hint">💡 ' + esc(it.rule) + '</div>' : '<div class="dr-tipw"><button class="btn sm" id="mk_tip">💡 Tipp anzeigen</button></div>') : '';
  const stepsBox = ui.steps || ui.checked ? '<ol class="mk-steps box">' + it.steps.map(s => '<li>' + esc(s) + '</li>').join("") + '</ol>' : '';
  const body = (it.retry ? '<div class="les-again">Noch einmal – vorhin falsch</div>' : '') + '<div class="mk-topic">' + t.ico + ' ' + esc(t.title) + (R.mode === "schwer" ? ' · <b>Schwer</b>' : '') + '</div>' + mkQ(it) + (ui.checked ? '' : mkPaperHint(it)) + mkInput(it, ui, ui.checked) + help + (ui.checked ? '' : stepsBox);
  const foot = ui.checked ? '<div class="les-foot ' + (ui.ok ? "ok" : "bad") + '"><div class="les-fb"><b>' + (ui.ok ? "Richtig!" : "Richtig wäre: " + esc(MK.answerText(it))) + '</b>' + stepsBox + '</div><button class="btn lg les-next" id="mk_next">Weiter</button></div>'
    : '<div class="les-foot"><span class="t-sub">' + (ui.tip || ui.steps ? "Mit Hilfe zählt es nicht als gelernt" : "") + '</span><button class="btn primary lg" id="mk_check"' + (mkFilled(it, ui.given) ? "" : " disabled") + '>Prüfen</button></div>';
  return '<div class="les mk-run">' + top + '<div class="les-body">' + body + '</div>' + foot + '</div>';
}
function bindMkRun() {
  document.body.classList.add("focus");
  const R = MKR; if (R.done) { const a = document.getElementById("mk_again"); if (a) a.onclick = () => mkStart(R.topic); return; }
  const it = R.items[R.i], ui = R.ui; const q = id => document.getElementById(id);
  if (!ui.checked) bindMkInput(it, ui, rerender => { if (rerender) return route(); const c = q("mk_check"); if (c) c.disabled = !mkFilled(it, ui.given); }, () => { if (mkFilled(it, ui.given)) mkCheck(); });
  const tp = q("mk_tip"); if (tp) tp.onclick = () => { ui.tip = true; route(); };
  const sp = q("mk_steps"); if (sp) sp.onclick = () => { ui.steps = true; route(); };
  const c = q("mk_check"); if (c) c.onclick = mkCheck;
  const n = q("mk_next"); if (n) { n.onclick = mkNext; setTimeout(() => n.focus(), 30); }
}
function mkCheck() {
  const R = MKR, it = R.items[R.i], ui = R.ui; if (ui.checked) return;
  ui.ok = MK.check(it, ui.given); ui.checked = true;
  const helped = ui.tip || ui.steps;
  if (ui.ok && !it.retry && !helped) R.right++;
  if (!ui.ok) { R.wrong.push(it); const n = R.retries[it.key] || 0; if (n < 1) { R.retries[it.key] = n + 1; R.items.splice(Math.min(R.items.length, R.i + 3), 0, Object.assign(MK.make(it.key, mkLvl(), Math.random, GRAPH_FUNCS), { retry: true })); } }
  if (!it.retry && !(ui.ok && helped)) mkSave(MK.learn(mkStats(), it.key, ui.ok));
  route();
}
async function mkNext() {
  const R = MKR; R.i++; R.ui = {};
  if (R.i >= R.items.length) { R.done = true; R.xp = 5 + R.right + (R.mode === "schwer" ? 5 : 0); clearTimeout(MK_SAVE); await setSetting("mathe_kurs", mkStats()); addXP(R.xp, { perfect: R.right === R.total }); }
  route();
}
function mkEnd() {
  const R = MKR; const t = mkUnit(R.topic); const acc = Math.round(R.right / R.total * 100); const p = MK.progressKeys(t.keys, mkStats());
  const nu = t.item ? (n => n && { id: "ck-" + n.nr, ico: "✅", title: n.nr + " · " + n.short })(MC.ITEMS.slice(MC.ITEMS.indexOf(t.item) + 1).find(x => x.keys.length)) : (n => n && { id: n.id, ico: n.ico, title: n.title })(MK.TOPICS[MK.TOPICS.indexOf(t.topic) + 1]);
  const nxt = nu;
  return '<div class="les les-done"><div class="les-trophy">' + (acc === 100 ? "🏆" : acc >= 70 ? "🎉" : "💪") + '</div><h1 class="fx-title">' + (acc === 100 ? "Alles richtig!" : "Runde geschafft!") + '</h1>' +
    '<div class="les-stats"><div><b>+' + R.xp + '</b><span>XP</span></div><div><b>' + R.right + '/' + R.total + '</b><span>ohne Hilfe richtig</span></div><div><b>' + p + ' %</b><span>' + esc(t.title.split(",")[0]) + '</span></div></div>' +
    (p >= MK_DONE && t.item && ckStatus()[t.item.nr] !== "ok" ? '<div class="card tight mk-nextc">Sitzt! Markiere Punkt ' + t.item.nr + ' auf der Checkliste als <b>✅ Kann ich</b>.</div>' : '') + (p >= MK_DONE && nxt ? '<div class="card tight mk-nextc">✓ Das sitzt! Weiter mit <b>' + nxt.ico + ' ' + esc(nxt.title) + '</b></div>' : p >= MK_DONE ? '<div class="card tight mk-nextc">✓ Alle Schritte geschafft? Dann jetzt die <b>Probe-Klausur</b>.</div>' : '') +
    '<div class="les-endbtn"><button class="btn primary lg" id="mk_again">Noch eine Runde</button>' + (p >= MK_DONE && nxt ? '<a class="btn lg" href="#/mathe/' + nxt.id + '">Nächster Punkt</a>' : '<a class="btn lg" href="' + t.back + '">Zurück</a>') + '</div></div>';
}

/* ---------- Probe-Klausur ---------- */
function mkExam() {
  if (!MKT) {
    const hist = (setting("mathe_tests", []) || []).slice(-5).reverse();
    return '<a class="backlink" href="#/mathe">' + ICO.back + 'Checkliste</a><div class="dr-head"><h1 class="t-large">📝 Probe-Klausur</h1><div class="t-sub">Wie die echte Klausur: Aufgaben aus allen Themen, keine Tipps, kein Merkzettel. Erst am Ende siehst du die Lösungen mit Lösungsweg – und deine Note.</div></div>' +
      '<div class="card dr-rules"><div>🧮 16 Aufgaben quer durch die Checkliste (Punkte 2–10, 13)</div><div>🧠 schwere Zahlen, alles aus dem Kopf</div><div>⏱ ca. 15–20 Minuten – Zettel und Stift bereitlegen</div></div>' +
      '<button class="btn primary lg wide dr-go" id="mkt_start">' + ICO.play + 'Probe-Klausur starten</button>' +
      (hist.length ? '<div class="card dr-heatc"><h2>Deine letzten Ergebnisse</h2>' + hist.map(h => '<div class="dr-hist"><span class="dr-note n' + h.note + '">' + h.note + '</span><span>' + h.pts + ' / ' + h.n + ' Punkte</span><span class="t-sub">' + fmtDL(h.d) + '</span></div>').join("") + '</div>' : '');
  }
  if (MKT.done) return mkExamEnd();
  const it = MKT.items[MKT.i]; const ui = MKT.ui[MKT.i] = MKT.ui[MKT.i] || {}; const pct = Math.round(MKT.i / MKT.items.length * 100);
  return '<div class="les mk-run"><div class="les-top"><a class="closebtn" href="#/mathe/test" id="mkt_quit" aria-label="Abbrechen">' + ICO.x + '</a><div class="les-prog"><i style="width:' + pct + '%"></i></div><span class="les-combo dim">' + (MKT.i + 1) + '/' + MKT.items.length + '</span></div>' +
    '<div class="les-body"><div class="mk-topic">Aufgabe ' + (MKT.i + 1) + '</div>' + mkQ(it) + mkPaperHint(it) + mkInput(it, ui, false) + '</div>' +
    '<div class="les-foot">' + (MKT.i ? '<button class="btn lg" id="mkt_back">Zurück</button>' : '<span></span>') + '<button class="btn primary lg" id="mkt_next">' + (MKT.i === MKT.items.length - 1 ? "Abgeben" : "Weiter") + '</button></div></div>';
}
function mkExamEnd() {
  const R = MKT.result;
  return '<div class="les les-done"><div class="les-trophy">' + (R.note <= 2 ? "🏆" : R.note <= 3 ? "🎉" : "💪") + '</div><h1 class="fx-title">Note ' + R.note + '</h1>' +
    '<div class="les-stats"><div><b>' + R.pts + '/' + R.n + '</b><span>Punkte</span></div><div><b>' + R.pct + ' %</b><span>richtig</span></div><div><b>+' + R.xp + '</b><span>XP</span></div></div>' +
    '<div class="card tight dr-res">' + MKT.items.map((it, k) => { const ok = R.res[k];
      return '<div class="dr-ri ' + (ok ? "ok" : "wrong") + '"><span class="dr-rk">' + (ok ? "✓" : "✗") + '</span><div><div>' + esc(it.prompt) + ' → <b>' + esc(MK.answerText(it)) + '</b></div>' + (ok ? '' : '<div class="t-sub">' + esc(it.steps.join(" · ")) + '</div>') + '</div></div>'; }).join("") + '</div>' +
    '<div class="les-endbtn"><button class="btn primary lg" id="mkt_again">Neue Probe-Klausur</button><a class="btn lg" href="#/mathe">Zur Checkliste</a></div></div>';
}
function bindMkExam() {
  const q = id => document.getElementById(id);
  const fresh = () => { MKT = { items: MK.exam(Math.random, GRAPH_FUNCS, MC.EXAM_CK), i: 0, ui: [], done: false }; route(); };
  const st = q("mkt_start"); if (st) st.onclick = fresh;
  const ag = q("mkt_again"); if (ag) ag.onclick = fresh;
  const quit = q("mkt_quit"); if (quit) quit.onclick = e => { e.preventDefault(); if (!MKT.ui.some(u => u && u.given != null) || confirm("Probe-Klausur abbrechen?")) { MKT = null; route(); } };
  if (!MKT || MKT.done) return;
  document.body.classList.add("focus");
  const it = MKT.items[MKT.i], ui = MKT.ui[MKT.i];
  bindMkInput(it, ui, rerender => { if (rerender) route(); }, () => q("mkt_next").click());
  const bk = q("mkt_back"); if (bk) bk.onclick = () => { MKT.i--; route(); };
  q("mkt_next").onclick = async () => {
    if (MKT.i < MKT.items.length - 1) { MKT.i++; return route(); }
    const open = MKT.items.filter((x, k) => !mkFilled(x, (MKT.ui[k] || {}).given)).length;
    if (open && !confirm(plural(open, "Aufgabe ist", "Aufgaben sind") + " noch leer – trotzdem abgeben?")) return;
    const res = MKT.items.map((x, k) => MK.check(x, (MKT.ui[k] || {}).given));
    const pts = res.filter(Boolean).length, n = res.length, pct = Math.round(pts / n * 100), note = MK.grade(pct), xp = 10 + pts * 2;
    let s = mkStats(); MKT.items.forEach((x, k) => { s = MK.learn(s, x.key, res[k]); }); STATE.settings.mathe_kurs = s; await setSetting("mathe_kurs", s);
    await setSetting("mathe_tests", (setting("mathe_tests", []) || []).concat([{ d: todayISO(), note, pts, n }]).slice(-20));
    MKT.result = { res, pts, n, pct, note, xp }; MKT.done = true; addXP(xp); route();
  };
}

/* ---------- Potenz-Blitz: 60 Sekunden ---------- */
const MKB_KEYS = ["gesetze:mul", "gesetze:div", "gesetze:pow", "gesetze:zero", "negativ:frac", "negativ:pow", "negativ:mix", "negativ:half", "werte:f", "eigen:sym", "gleich:odd"];
const mkbNew = () => MK.make(MKB_KEYS[Math.floor(Math.random() * MKB_KEYS.length)], Math.min(1, mkLvl()), Math.random, GRAPH_FUNCS);
function mkBlitz() {
  if (!MKB || MKB.over) {
    const best = lsGet("lc_mk_blitz", 0);
    return '<a class="backlink" href="#/mathe">' + ICO.back + 'Mathe-Kurs</a><div class="dr-head"><h1 class="t-large">⚡ Potenz-Blitz</h1><div class="t-sub">60 Sekunden: Potenzgesetze, negative Exponenten, Funktionswerte. Richtig = +1, falsch = nächste Aufgabe.' + (best ? ' Rekord: ' + best : '') + '</div></div>' +
      (MKB && MKB.over ? '<div class="card mk-blres"><div class="mk-big">' + MKB.score + '</div><div>richtig in 60 Sekunden' + (MKB.record ? ' – <b>neuer Rekord! 🏆</b>' : '') + '</div>' + (MKB.wrong.length ? '<div class="t-sub" style="margin-top:8px">Falsch: ' + MKB.wrong.slice(0, 5).map(w => esc(w.prompt) + ' → ' + esc(MK.answerText(w))).join(" · ") + '</div>' : '') + '</div>' : '') +
      '<button class="btn primary lg wide dr-go" id="mkb_start">' + ICO.play + (MKB ? 'Nochmal' : 'Los!') + '</button>';
  }
  const it = MKB.it, left = Math.max(0, Math.ceil((MKB.end - Date.now()) / 1000));
  return '<div class="les mk-run"><div class="les-top"><a class="closebtn" href="#/mathe/blitz" id="mkb_quit" aria-label="Abbrechen">' + ICO.x + '</a><div class="les-prog"><i id="mkb_bar" style="width:' + Math.round(left / 60 * 100) + '%"></i></div><span class="les-combo" id="mkb_t">' + left + ' s</span></div>' +
    '<div class="les-body"><div class="mk-topic">⚡ ' + MKB.score + ' richtig' + (MKB.flash ? ' <span class="mk-flash ' + MKB.flash + '">' + (MKB.flash === "ok" ? "✓" : "✗") + '</span>' : '') + '</div>' + mkQ(it) + mkInput(it, MKB.ui, false) + '</div>' +
    '<div class="les-foot"><span></span><button class="btn primary lg" id="mkb_ok"' + (mkFilled(it, MKB.ui.given) ? "" : " disabled") + '>OK</button></div></div>';
}
function bindMkBlitz() {
  const q = id => document.getElementById(id);
  const st = q("mkb_start"); if (st) st.onclick = () => { MKB = { score: 0, end: Date.now() + 60000, it: mkbNew(), ui: {}, wrong: [], over: false }; route(); };
  if (!MKB || MKB.over) return;
  document.body.classList.add("focus");
  const quit = q("mkb_quit"); if (quit) quit.onclick = e => { e.preventDefault(); clearInterval(MKB.timer); MKB = null; route(); };
  const submit = () => { if (!mkFilled(MKB.it, MKB.ui.given)) return; const ok = MK.check(MKB.it, MKB.ui.given); if (ok) MKB.score++; else MKB.wrong.push(MKB.it); MKB.flash = ok ? "ok" : "bad"; MKB.it = mkbNew(); MKB.ui = {}; route(); };
  bindMkInput(MKB.it, MKB.ui, rerender => { if (rerender && MKB.it.kind === "chip") return submit(); if (rerender) return route(); const b = q("mkb_ok"); if (b) b.disabled = !mkFilled(MKB.it, MKB.ui.given); }, submit);
  q("mkb_ok").onclick = submit;
  clearInterval(MKB.timer);
  MKB.timer = setInterval(() => {
    if (!MKB || ROUTE.name !== "mathe" || ROUTE.sub !== "blitz") { if (MKB) clearInterval(MKB.timer); return; }
    const left = Math.max(0, Math.ceil((MKB.end - Date.now()) / 1000)); const t = q("mkb_t"), bar = q("mkb_bar");
    if (t) t.textContent = left + " s"; if (bar) bar.style.width = Math.round(left / 60 * 100) + "%";
    if (left <= 0) { clearInterval(MKB.timer); MKB.over = true; const best = lsGet("lc_mk_blitz", 0); MKB.record = MKB.score > best; if (MKB.record) lsSet("lc_mk_blitz", MKB.score); if (MKB.score) addXP(Math.min(20, 3 + MKB.score)); route(); }
  }, 250);
}
