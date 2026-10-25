/* =====================================================================
   LERN-COCKPIT · GRAMMATIK-DRILL – Oberfläche
   #/drill                Themen
   #/drill/<Thema>        Merk-Karte (Stiefel-Tabelle), „Wo hakt's?“, Start
   #/drill/<Thema>?run=1  Runde: antippen → später selbst schreiben
   #/drill/<Thema>?challenge=<Verb>  ganze Tabelle auf Zeit
   Lernstand in einstellungen.drill = { Thema: { Aufgabe: {b, r, w} } }.
   ===================================================================== */
let DRL = null;          // laufende Runde
let DRC = null;          // laufende Tabellen-Challenge
let DRL_SAVE = null;
const drillStats = t => ((setting("drill", {}) || {})[t]) || {};
function drillSave(t, stats) {
  const all = Object.assign({}, setting("drill", {}) || {}); all[t] = stats; STATE.settings.drill = all;   // sofort lokal
  clearTimeout(DRL_SAVE); DRL_SAVE = setTimeout(() => setSetting("drill", all), 1200);
}
const drillTopic = () => DRILL.TOPICS.find(t => t.id === decodeURIComponent(ROUTE.sub || ""));
const ACCENTS = ["é", "è", "ê", "à", "ç", "ï", "ô", "'"];

V.drill = () => {
  if (!engineReady()) return pageHead("Grammatik-Drill") + setupCard();
  const t = drillTopic();
  if (!t) return drillHome();
  if (ROUTE.query.challenge && t.kind === "conj") return drillChallenge(t, ROUTE.query.challenge);
  if (ROUTE.query.run && DRL && DRL.topic === t.id) return drillRun();
  return drillTopicPage(t);
};
function bindDrill() {
  const t = drillTopic(); const q = id => document.getElementById(id);
  document.querySelectorAll("[data-drstart]").forEach(b => b.onclick = () => drillStart(b.dataset.drstart));
  if (!t) return;
  if (ROUTE.query.challenge) return bindChallenge(t);
  if (ROUTE.query.run && DRL) return bindRun();
  document.querySelectorAll("[data-drverb]").forEach(b => b.onclick = () => { const d = b.closest("details"); if (d) d.open = !d.open; });
}
function drillStart(topicId) {
  const items = DRILL.round(topicId, drillStats(topicId), 12);
  DRL = { topic: topicId, items, i: 0, total: items.length, right: 0, ui: {}, retries: {}, started: Date.now(), done: false, wrong: [] };
  const h = "#/drill/" + topicId + "?run=1"; if (location.hash === h) route(); else location.hash = h;
}

/* ---------- Übersicht ---------- */
function drillHome() {
  return pageHead("Grammatik-Drill", { back: ["#/dashboard", "Start"], sub: "Französisch aus Lektion 7 – bis es sitzt. Erst antippen, dann selbst schreiben." }) +
    '<div class="dr-topics">' + DRILL.TOPICS.map(t => { const p = DRILL.progress(t.id, drillStats(t.id));
      return '<a class="card dr-topic" href="#/drill/' + t.id + '"><div><b>' + esc(t.title) + '</b><span class="t-sub">' + p.ok + ' von ' + p.n + ' sitzen</span>' + progBar(p.pct, p.pct >= 80 ? "g" : "") + '</div><span class="chev">' + ICO.chev + '</span></a>'; }).join("") + '</div>';
}
/** kleine Karte für andere Seiten (Klausur-Modus, Spiele) */
function drillCard() {
  const tot = DRILL.TOPICS.reduce((a, t) => { const p = DRILL.progress(t.id, drillStats(t.id)); return { ok: a.ok + p.ok, n: a.n + p.n }; }, { ok: 0, n: 0 });
  return '<a class="card dr-card" href="#/drill"><span class="dr-ic">👢</span><span class="dr-tx"><b>Grammatik-Drill</b><span class="t-sub">acheter, préférer, mettre, ce/cet, quel, beau … – ' + tot.ok + ' von ' + tot.n + ' sitzen</span></span><span class="chev">' + ICO.chev + '</span></a>';
}

/* ---------- Merk-Karte je Thema ---------- */
function conjTable(verb, opts) {
  const v = DRILL.VERBS[verb]; const mettre = verb === "mettre";
  return '<table class="dr-tab"><tbody>' + v.forms.map((f, p) => { const x = DRILL.parts(verb, p);
    return '<tr class="' + (x.inBoot ? "boot" : "") + '"><td class="dr-p">' + DRILL.pron(p, f) + '</td><td class="dr-f">' + esc(x.pre) + (x.ch ? '<mark>' + esc(x.ch) + '</mark>' : '') + esc(x.post) + '<span class="dr-e">' + esc(x.end) + '</span></td>' + (opts && opts.boot !== false ? '<td class="dr-b">' + (x.inBoot ? (mettre ? "Sg." : "👢") : (mettre ? "Pl." : "")) + '</td>' : '') + '</tr>'; }).join("") +
    '<tr class="dr-pc"><td class="dr-p">j\'ai</td><td class="dr-f" colspan="2">' + esc(v.pc) + '</td></tr></tbody></table>';
}
function drillTopicPage(t) {
  const st = drillStats(t.id); const p = DRILL.progress(t.id, st);
  let card = "";
  if (t.id === "stiefel") card = '<div class="card dr-rule"><div class="dr-boot">👢</div><div><b>Die Stiefel-Regel</b><p>Bei <b>je, tu, il/elle/on, ils/elles</b> (im Stiefel) ändert sich der Stamm: <b>è</b> statt e/é, <b>i</b> statt y. Bei <b>nous</b> und <b>vous</b> (außerhalb) bleibt er wie im Infinitiv.</p><p class="t-sub">Endungen immer: -e, -es, -e, -ons, -ez, -ent · Passé composé: j\'ai acheté, préféré …</p></div></div>' +
    t.verbs.map((v, i) => '<details class="card dr-verb"' + (i === 0 ? " open" : "") + '><summary><b>' + esc(v) + '</b><span class="t-sub">' + esc(DRILL.VERBS[v].de) + ' · ' + esc(DRILL.VERBS[v].note) + '</span></summary>' + conjTable(v) + '<a class="btn sm" href="#/drill/stiefel?challenge=' + encodeURIComponent(v) + '">⏱ Tabellen-Challenge</a></details>').join("");
  else if (t.id === "mettre") card = '<div class="card dr-rule"><div class="dr-boot">✂️</div><div><b>mettre: Singular kurz, Plural doppel-t</b><p>je <b>mets</b>, tu <b>mets</b>, il <b>met</b> – nous <b>mettons</b>, vous <b>mettez</b>, ils <b>mettent</b>. Passé composé: j\'ai <b>mis</b>.</p><p class="t-sub">Bedeutet: (hin)legen, stellen, setzen, Kleidung anziehen, Tisch decken.</p></div></div><div class="card dr-verb">' + conjTable("mettre") + '<a class="btn sm" href="#/drill/mettre?challenge=mettre">⏱ Tabellen-Challenge</a></div>';
  else if (t.id === "pc") card = '<div class="card dr-rule"><div class="dr-boot">⏮️</div><div><b>Passé composé = avoir + Partizip</b><p>-er-Verben: Endung <b>-é</b> → j\'ai achet<b>é</b>, essay<b>é</b>, pay<b>é</b>, préfér<b>é</b>, répét<b>é</b>. Unregelmäßig: mettre → j\'ai <b>mis</b>.</p><p class="t-sub">j\'ai · tu as · il/elle a · nous avons · vous avez · ils/elles ont</p></div></div>';
  else if (t.id === "ce") card = '<div class="card dr-rule"><div class="dr-boot">👉</div><div><b>ce, cet, cette, ces = dieser, diese, dieses</b><table class="dr-mini"><tr><td>männlich + Konsonant</td><td><b>ce</b> CD, ce pull</td></tr><tr><td>männlich + Vokal/h</td><td><b>cet</b> acteur, cet homme</td></tr><tr><td>weiblich</td><td><b>cette</b> BD, cette amie</td></tr><tr><td>Plural (m. und f.)</td><td><b>ces</b> films, ces BD</td></tr></table></div></div>';
  else if (t.id === "quel") card = '<div class="card dr-rule"><div class="dr-boot">❓</div><div><b>quel … ? = welcher, welche, welches?</b><table class="dr-mini"><tr><td></td><td>Singular</td><td>Plural</td></tr><tr><td>männlich</td><td><b>quel</b> CD ?</td><td><b>quels</b> films ?</td></tr><tr><td>weiblich</td><td><b>quelle</b> BD ?</td><td><b>quelles</b> BD ?</td></tr></table><p class="t-sub">Angleichung wie bei Adjektiven: f + e, Plural + s. Vor Vokal bleibt es <b>quel</b> (quel acteur).</p></div></div>';
  else if (t.id === "beau") card = '<div class="card dr-rule"><div class="dr-boot">✨</div><div><b>beau, nouveau, vieux stehen VOR dem Nomen</b><table class="dr-mini dr-adj"><tr><td></td><td>beau</td><td>nouveau</td><td>vieux</td></tr><tr><td>m.</td><td>beau film</td><td>nouveau film</td><td>vieux film</td></tr><tr><td>m. + Vokal</td><td><b>bel</b> avion</td><td><b>nouvel</b> avion</td><td><b>vieil</b> avion</td></tr><tr><td>f.</td><td><b>belle</b></td><td><b>nouvelle</b></td><td><b>vieille</b></td></tr><tr><td>m. Pl.</td><td>beaux</td><td>nouveaux</td><td>vieux</td></tr><tr><td>f. Pl.</td><td>belles</td><td>nouvelles</td><td>vieilles</td></tr></table></div></div>';
  const bp = t.kind === "conj" ? DRILL.byPerson(t.id, st) : [];
  const heat = bp.some(x => x.n) ? '<div class="card"><h2>Wo hakt\'s?</h2><div class="dr-heat">' + bp.map(x => '<div class="dr-h ' + (x.pct == null ? "" : x.pct >= 85 ? "g" : x.pct >= 60 ? "o" : "r") + '"><b>' + esc(x.label) + '</b><span>' + (x.pct == null ? "–" : x.pct + " %") + '</span></div>').join("") + '</div><p class="t-sub" style="margin-bottom:0">Rot/orange kommt in den nächsten Runden öfter dran.</p></div>' : '';
  return '<a class="backlink" href="#/drill">' + ICO.back + 'Grammatik-Drill</a><div class="dr-head"><h1 class="t-large">' + esc(t.title) + '</h1><div class="t-sub">' + p.ok + ' von ' + p.n + ' sitzen</div>' + progBar(p.pct, p.pct >= 80 ? "g" : "") + '</div>' +
    '<button class="btn primary lg wide dr-go" data-drstart="' + t.id + '">' + ICO.play + 'Runde starten (12 Aufgaben)</button>' + heat + card;
}

/* ---------- Runde ---------- */
function drillRun() {
  const R = DRL;
  if (R.done) return drillEnd();
  const it = R.items[R.i], ui = R.ui; ui.opts = ui.opts || (it.type === "pick" ? Engine.shuffle([it.answer].concat(DRILL.distractors(it))) : null);
  const pct = Math.round(R.i / R.items.length * 100);
  const top = '<div class="les-top"><a class="closebtn" href="#/drill/' + R.topic + '" aria-label="Runde beenden">' + ICO.x + '</a><div class="les-prog"><i style="width:' + pct + '%"></i></div><span class="les-combo dim">' + R.right + '</span></div>';
  const head = (it.retry ? '<div class="les-again">Noch einmal – vorhin falsch</div>' : '') + '<h2 class="les-h">' + (it.type === "type" ? "Schreib die Form" : "Welche Form passt?") + '</h2><div class="dr-q"><span>' + esc(it.prompt).replace("___", '<span class="dr-gap">' + (ui.checked ? esc(ui.given || "") : "___") + '</span>') + '</span></div><div class="t-sub dr-sub">' + esc(it.sub) + '</div>';
  let body;
  if (it.type === "pick") body = '<div class="les-opts">' + ui.opts.map((o, k) => '<button class="les-opt' + (ui.pick === k ? " on" : "") + (ui.checked ? (o === it.answer ? " right" : ui.pick === k ? " wrongpick" : "") : "") + '" data-dro="' + k + '"' + (ui.checked ? " disabled" : "") + '><span class="k">' + (k + 1) + '</span>' + esc(o) + '</button>').join("") + '</div>';
  else body = '<input id="dr_in" class="answer-input dr-in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Form eintippen …" value="' + esc(ui.given || "") + '"' + (ui.checked ? " readonly" : "") + '><div class="dr-acc">' + ACCENTS.map(a => '<button data-dracc="' + esc(a) + '"' + (ui.checked ? " disabled" : "") + '>' + esc(a) + '</button>').join("") + '</div>';
  const foot = ui.checked ? '<div class="les-foot ' + (ui.res === "ok" ? "ok" : "bad") + '"><div class="les-fb"><b>' + (ui.res === "ok" ? "Richtig!" : ui.res === "accent" ? "Fast – achte auf den Akzent: " + esc(it.answer) : "Richtig: " + esc(it.answer)) + '</b><span>' + esc(it.why) + '</span></div><button class="btn lg les-next" id="dr_next">Weiter</button></div>'
    : '<div class="les-foot"><span class="t-sub">' + (it.type === "type" ? "Sitzt schon gut – jetzt selbst schreiben" : "") + '</span><button class="btn primary lg" id="dr_check"' + ((it.type === "pick" ? ui.pick != null : (ui.given || "").trim()) ? "" : " disabled") + '>Prüfen</button></div>';
  return '<div class="les">' + top + '<div class="les-body">' + head + body + '</div>' + foot + '</div>';
}
function bindRun() {
  document.body.classList.add("focus");
  const R = DRL; if (R.done) { const a = document.getElementById("dr_again"); if (a) a.onclick = () => drillStart(R.topic); return; }
  const it = R.items[R.i], ui = R.ui; const q = id => document.getElementById(id);
  document.querySelectorAll("[data-dro]").forEach(b => b.onclick = () => { ui.pick = +b.dataset.dro; route(); });
  const inp = q("dr_in");
  if (inp) {
    inp.oninput = () => { ui.given = inp.value; const c = q("dr_check"); if (c) c.disabled = !inp.value.trim(); };
    inp.onkeydown = e => { if (e.key === "Enter" && inp.value.trim()) { e.preventDefault(); drillCheck(); } };
    if (!ui.checked) setTimeout(() => inp.focus(), 30);
    document.querySelectorAll("[data-dracc]").forEach(b => b.onclick = () => { const s = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, s) + b.dataset.dracc + inp.value.slice(inp.selectionEnd ?? s); inp.focus(); inp.setSelectionRange(s + 1, s + 1); inp.oninput(); });
  }
  const c = q("dr_check"); if (c) c.onclick = drillCheck;
  const n = q("dr_next"); if (n) { n.onclick = drillNext; setTimeout(() => n.focus(), 30); }
}
function drillCheck() {
  const R = DRL, it = R.items[R.i], ui = R.ui; if (ui.checked) return;
  ui.given = it.type === "pick" ? ui.opts[ui.pick] : (ui.given || "").trim();
  ui.res = DRILL.check(ui.given, it.answer, it); ui.checked = true;
  const ok = ui.res === "ok";
  if (ok && !it.retry) R.right++;
  if (!ok) { R.wrong.push(it); const n = R.retries[it.key] || 0; if (n < 2) { R.retries[it.key] = n + 1; R.items.splice(Math.min(R.items.length, R.i + 4), 0, Object.assign({}, it, { retry: true, type: "pick" })); } }
  if (!it.retry) drillSave(R.topic, DRILL.learn(drillStats(R.topic), it.key, ok));
  route();
}
async function drillNext() {
  const R = DRL; R.i++; R.ui = {};
  if (R.i >= R.items.length) { R.done = true; R.xp = 5 + R.right; clearTimeout(DRL_SAVE); await setSetting("drill", setting("drill", {})); addXP(R.xp); }
  route();
}
function drillEnd() {
  const R = DRL; const t = DRILL.TOPICS.find(x => x.id === R.topic); const acc = Math.round(R.right / R.total * 100);
  const bp = t.kind === "conj" ? DRILL.byPerson(t.id, drillStats(t.id)) : [];
  const wrong = [...new Map(R.wrong.map(w => [w.key, w])).values()];
  return '<div class="les les-done"><div class="les-trophy">' + (acc === 100 ? "🏆" : acc >= 70 ? "🎉" : "💪") + '</div><h1 class="fx-title">' + (acc === 100 ? "Alles richtig!" : "Runde geschafft!") + '</h1>' +
    '<div class="les-stats"><div><b>+' + R.xp + '</b><span>XP</span></div><div><b>' + R.right + '/' + R.total + '</b><span>beim 1. Versuch</span></div></div>' +
    (bp.some(x => x.n) ? '<div class="dr-heat" style="width:min(420px,100%)">' + bp.map(x => '<div class="dr-h ' + (x.pct == null ? "" : x.pct >= 85 ? "g" : x.pct >= 60 ? "o" : "r") + '"><b>' + esc(x.label) + '</b><span>' + (x.pct == null ? "–" : x.pct + " %") + '</span></div>').join("") + '</div>' : '') +
    (wrong.length ? '<div class="card tight dr-wrong"><b>Noch üben</b>' + wrong.slice(0, 8).map(w => '<div><span class="t-sub">' + esc(w.prompt.replace("___", "…")) + '</span> <b>' + esc(w.answer) + '</b></div>').join("") + '</div>' : '') +
    '<div class="les-endbtn"><button class="btn primary lg" id="dr_again">Noch eine Runde</button><a class="btn lg" href="#/drill/' + R.topic + '">Fertig</a></div></div>';
}

/* ---------- Tabellen-Challenge: alle 6 Formen auf Zeit ---------- */
function drillChallenge(t, verb) {
  const v = DRILL.VERBS[verb]; if (!v) return drillTopicPage(t);
  if (!DRC || DRC.verb !== verb) DRC = { verb, vals: ["", "", "", "", "", ""], start: null, res: null, time: null };
  const best = lsGet("lc_drill_best_" + verb, null);
  return '<a class="backlink" href="#/drill/' + t.id + '">' + ICO.back + esc(t.title) + '</a><div class="dr-head"><h1 class="t-large">⏱ ' + esc(v.inf) + '</h1><div class="t-sub">' + esc(v.de) + ' – alle Formen so schnell wie möglich' + (best ? ' · Bestzeit ' + (best / 1000).toFixed(1) + ' s' : '') + '</div></div>' +
    '<div class="card"><table class="dr-tab dr-ch"><tbody>' + v.forms.map((f, p) => '<tr class="' + (v.boot.includes(p) ? "boot" : "") + '"><td class="dr-p">' + DRILL.pron(p, f) + '</td><td><input data-drc="' + p + '" class="' + (DRC.res ? (DRC.res[p] ? "ok" : "bad") : "") + '" value="' + esc(DRC.vals[p]) + '" autocomplete="off" autocapitalize="off" spellcheck="false"' + (DRC.res && DRC.res.every(Boolean) ? " readonly" : "") + '></td><td class="dr-sol">' + (DRC.res && !DRC.res[p] ? esc(f) : "") + '</td></tr>').join("") + '</tbody></table>' +
    '<div class="dr-acc">' + ACCENTS.map(a => '<button data-dracc="' + esc(a) + '">' + esc(a) + '</button>').join("") + '</div>' +
    (DRC.res && DRC.res.every(Boolean) ? '<div class="fb ok"><div class="fb-t"><b>Alle richtig in ' + (DRC.time / 1000).toFixed(1) + ' s' + (DRC.best ? " – neue Bestzeit! 🏆" : "") + '</b></div></div><div class="les-endbtn"><button class="btn primary" id="drc_again">Nochmal</button><a class="btn" href="#/drill/' + t.id + '">Fertig</a></div>'
      : '<div class="les-endbtn"><button class="btn primary lg" id="drc_check">Prüfen</button></div>') + '</div>';
}
function bindChallenge(t) {
  const verb = ROUTE.query.challenge; const v = DRILL.VERBS[verb]; if (!v || !DRC) return;
  let last = null;
  document.querySelectorAll("[data-drc]").forEach(inp => {
    inp.onfocus = () => { last = inp; if (!DRC.start) DRC.start = Date.now(); };
    inp.oninput = () => { DRC.vals[+inp.dataset.drc] = inp.value; };
    inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); const nx = document.querySelector('[data-drc="' + (+inp.dataset.drc + 1) + '"]'); if (nx) nx.focus(); else document.getElementById("drc_check")?.click(); } };
  });
  const first = document.querySelector('[data-drc]:not([readonly])'); if (first && !DRC.res) setTimeout(() => first.focus(), 30);
  document.querySelectorAll("[data-dracc]").forEach(b => b.onmousedown = e => e.preventDefault());
  document.querySelectorAll("[data-dracc]").forEach(b => b.onclick = () => { const inp = last || first; if (!inp) return; const s = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, s) + b.dataset.dracc + inp.value.slice(inp.selectionEnd ?? s); inp.focus(); inp.setSelectionRange(s + 1, s + 1); inp.oninput(); });
  const ck = document.getElementById("drc_check"); if (ck) ck.onclick = () => {
    DRC.res = v.forms.map((f, p) => DRILL.check(DRC.vals[p], f, { verb, person: p, key: verb + ":" + p }) === "ok");
    let st = drillStats(t.id); v.forms.forEach((f, p) => { st = DRILL.learn(st, verb + ":" + p, DRC.res[p]); }); if (t.id !== "pc") drillSave(t.id, st);
    if (DRC.res.every(Boolean)) { DRC.time = Date.now() - (DRC.start || Date.now()); const best = lsGet("lc_drill_best_" + verb, null); DRC.best = best == null || DRC.time < best; if (DRC.best) lsSet("lc_drill_best_" + verb, DRC.time); addXP(5); }
    route();
  };
  const ag = document.getElementById("drc_again"); if (ag) ag.onclick = () => { DRC = null; route(); };
}
