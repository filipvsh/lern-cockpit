/* =====================================================================
   LERN-COCKPIT · GRAMMATIK-DRILL – Oberfläche
   #/drill                Themen
   #/drill/<Thema>        Merk-Karte (Stiefel-Tabelle), „Wo hakt's?“, Start
   #/drill/<Thema>?run=1  Runde: alles selbst schreiben, Format wird mit der Zeit schwerer
   #/drill/test           Probe-Arbeit: 20 gemischte Aufgaben, ohne Hilfe, mit Note
   #/drill/<Thema>?challenge=<Verb>  ganze Tabelle auf Zeit
   Lernstand in einstellungen.drill = { Thema: { Aufgabe: {b, r, w} } }.
   ===================================================================== */
let DRL = null;          // laufende Runde
let DRC = null;          // laufende Tabellen-Challenge
let DRT = null;          // laufende Probe-Arbeit
let DRL_SAVE = null;
const drillStats = t => ((setting("drill", {}) || {})[t]) || {};
function drillSave(t, stats) {
  const all = Object.assign({}, setting("drill", {}) || {}); all[t] = stats; STATE.settings.drill = all;   // sofort lokal
  clearTimeout(DRL_SAVE); DRL_SAVE = setTimeout(() => setSetting("drill", all), 1200);
}
const drillTopic = () => DRILL.TOPICS.find(t => t.id === decodeURIComponent(ROUTE.sub || ""));

V.drill = () => {
  if (!engineReady()) return pageHead("Grammatik-Drill") + setupCard();
  if (ROUTE.sub === "test") return drillTest();
  const t = drillTopic();
  if (!t) return drillHome();
  if (ROUTE.query.challenge && t.kind === "conj") return drillChallenge(t, ROUTE.query.challenge);
  if (ROUTE.query.run && DRL && DRL.topic === t.id) return drillRun();
  if (ROUTE.query.intro) return drillIntro(t, +ROUTE.query.intro || 1);
  return drillTopicPage(t);
};
function bindDrill() {
  const t = drillTopic(); const q = id => document.getElementById(id);
  document.querySelectorAll("[data-drstart]").forEach(b => b.onclick = () => drillStart(b.dataset.drstart));
  bindModeSeg();
  if (ROUTE.sub === "test") return bindTest();
  if (!t) return;
  if (ROUTE.query.challenge) return bindChallenge(t);
  if (ROUTE.query.run && DRL) return bindRun();
  if (ROUTE.query.intro) document.body.classList.add("focus");
  document.querySelectorAll("[data-drverb]").forEach(b => b.onclick = () => { const d = b.closest("details"); if (d) d.open = !d.open; });
}
/* ---------- Lern-Modus (gilt für Französisch „fr“ und Mathe „ma“) ---------- */
const MODES = [["leicht", "Leicht", "Mit Spickzettel und Hilfen – zum ersten Lernen"], ["normal", "Normal", "Passt sich an: erst mit Hilfen, dann ohne"], ["schwer", "Schwer", "Klausur-Vorbereitung: alles aus dem Kopf, keine Hilfen"]];
const lernModus = f => ((setting("lern_modus", {}) || {})[f]) || "normal";
function modeSeg(f) {
  const m = lernModus(f);
  return '<div class="card mode-card"><div class="mode-h"><b>Modus</b><div class="seg">' + MODES.map(([k, l]) => '<button class="' + (m === k ? "on" : "") + '" data-lmode="' + f + ':' + k + '">' + l + '</button>').join("") + '</div></div><div class="t-sub mode-d">' + MODES.find(x => x[0] === m)[2] + '</div></div>';
}
function bindModeSeg() {
  document.querySelectorAll("[data-lmode]").forEach(b => b.onclick = async () => { const [f, k] = b.dataset.lmode.split(":"); const all = Object.assign({}, setting("lern_modus", {}) || {}); all[f] = k; await setSetting("lern_modus", all); route(); });
}
function drillStart(topicId) {
  const mode = lernModus("fr");
  const items = DRILL.round(topicId, drillStats(topicId), 12, Math.random, mode);
  DRL = { topic: topicId, mode, items, i: 0, total: items.length, right: 0, ui: {}, retries: {}, started: Date.now(), done: false, wrong: [] };
  const h = "#/drill/" + topicId + "?run=1"; if (location.hash === h) route(); else location.hash = h;
}

/* ---------- Übersicht ---------- */
function drillHome() {
  const ps = DRILL.TOPICS.map(t => DRILL.progress(t.id, drillStats(t.id))); const next = ps.findIndex(p => p.pct < 80);
  return pageHead("Französisch-Kurs: Grammatik Lektion 7", { back: ["#/dashboard", "Start"], sub: "Arbeite die Schritte der Reihe nach durch – am Ende die Probe-Arbeit. " + ps.filter(p => p.pct >= 80).length + " von " + ps.length + " geschafft." }) +
    modeSeg("fr") + '<div class="dr-topics mk-course">' + DRILL.TOPICS.map((t, i) => { const p = ps[i];
      return '<a class="card dr-topic mk-step' + (p.pct >= 80 ? " done" : "") + (i === next ? " next" : "") + '" href="#/drill/' + t.id + '"><span class="mk-n">' + (p.pct >= 80 ? "✓" : i + 1) + '</span><div><b>' + esc(t.title) + '</b>' + (i === next ? '<span class="mk-tag">Als Nächstes</span>' : '') + '<span class="t-sub">' + p.ok + ' von ' + p.n + ' sitzen</span>' + progBar(p.pct, p.pct >= 80 ? "g" : "") + '</div><span class="chev">' + ICO.chev + '</span></a>'; }).join("") + testCard(DRILL.TOPICS.length + 1) + '</div>';
}
function testCard(n) {
  const last = (setting("drill_tests", []) || []).slice(-1)[0];
  return '<a class="card dr-topic dr-testc' + (n ? " mk-step mk-exam" : "") + '" href="#/drill/test">' + (n ? '<span class="mk-n">' + n + '</span>' : '<span class="dr-ic">📝</span>') + '<div><b>Probe-Arbeit</b><span class="t-sub">20 Aufgaben aus allen Themen · ohne Hilfe · mit Note' + (last ? ' · zuletzt Note ' + last.note : '') + '</span></div><span class="chev">' + ICO.chev + '</span></a>';
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
/** Spickzettel: Endungen · Stiefel · was sich ändert */
function formHTML(verb, p) {
  const x = DRILL.parts(verb, p);
  return esc(x.pre) + (x.ch ? (x.inBoot ? '<mark>' + esc(x.ch) + '</mark>' : esc(x.ch)) : '') + esc(x.post) + '<em>' + esc(x.end) + '</em>';
}
const ENDS_ER = ["-e", "-es", "-e", "-ons", "-ez", "-ent"];
function endsStrip(ends) {
  return '<div class="dr-ends">' + ["je", "tu", "il", "nous", "vous", "ils"].map((x, p) => '<div><span>' + x + '</span><b>' + (ends || ENDS_ER)[p] + '</b></div>').join("") + '</div>';
}
function bootGrid(verb) {
  const P = ["je", "tu", "il/elle/on", "nous", "vous", "ils/elles"]; const v = DRILL.VERBS[verb || "acheter"];
  const cell = (p, c) => '<div class="' + (v.boot.includes(p) ? "in" : "out") + ' ' + c + '"><span class="p">' + P[p] + '</span><b>' + formHTML(verb || "acheter", p) + '</b></div>';
  return '<div class="dr-bg">' + cell(0, "c1") + cell(3, "c4") + cell(1, "c2") + cell(4, "c5") + cell(2, "c3") + cell(5, "c6") + '</div>' +
    '<div class="dr-legend"><span class="l-in">im Stiefel: je, tu, il, ils → Stamm ändert sich</span><span>draußen: nous, vous → wie im Infinitiv</span></div>';
}
function changeTable() {
  const rows = [["acheter", "kaufen", "e → è"], ["préférer", "lieber mögen", "é → è"], ["répéter", "wiederholen", "é → è"], ["payer", "bezahlen", "y → i"], ["essayer", "anprobieren", "y → i"]];
  return '<table class="dr-chg"><thead><tr><th>Verb</th><th>im Stiefel</th><th>draußen</th></tr></thead><tbody>' +
    rows.map(([v, de, r]) => '<tr><td><b>' + v + '</b><span class="t-sub">' + de + '</span></td><td><span class="rule">' + r + '</span><br>' + (x => x.endsWith("'") ? x : x + " ")(DRILL.pron(0, DRILL.VERBS[v].forms[0])) + formHTML(v, 0) + '</td><td>nous ' + formHTML(v, 3) + '</td></tr>').join("") + '</tbody></table>';
}
const ACC_HELP = 'Akzente wie <b>è</b>: am Handy die Taste <b>e</b> gedrückt halten – oder den Knopf unter dem Eingabefeld antippen.';
function stiefelCheat() {
  return '<div class="card dr-cheat"><h2>👢 Spickzettel</h2><div class="t-sub">In 3 Schritten zur richtigen Form</div>' +
    '<div class="dr-step"><i>1</i>Endung – ist immer gleich</div>' + endsStrip() +
    '<div class="dr-step"><i>2</i>Im Stiefel? Dann ändert sich der Stamm</div>' + bootGrid("acheter") +
    '<div class="dr-step"><i>3</i>Was ändert sich?</div>' + changeTable() +
    '<div class="dr-tip">🧠 <b>Merksatz:</b> Im Stiefel wird\'s schwer – der Akzent kippt nach unten (<b>è</b>), das y wird zum schlanken <b>i</b>. Passé composé immer mit <b>-é</b>: j\'ai acheté, préféré, payé.</div></div>';
}
const MINI = {
  ce: '<table class="dr-mini"><tr><td>männlich</td><td><b>ce</b> pull</td></tr><tr><td>männlich + Vokal/h</td><td><b>cet</b> anorak</td></tr><tr><td>weiblich</td><td><b>cette</b> robe</td></tr><tr><td>Plural</td><td><b>ces</b> films</td></tr></table>',
  quel: '<table class="dr-mini"><tr><td></td><td>Singular</td><td>Plural</td></tr><tr><td>männlich</td><td><b>quel</b></td><td><b>quels</b></td></tr><tr><td>weiblich</td><td><b>quelle</b></td><td><b>quelles</b></td></tr></table>',
  beau: '<table class="dr-mini dr-adj"><tr><td>m.</td><td>beau</td><td>nouveau</td><td>vieux</td></tr><tr><td>m. + Vokal</td><td><b>bel</b></td><td><b>nouvel</b></td><td><b>vieil</b></td></tr><tr><td>f.</td><td>belle</td><td>nouvelle</td><td>vieille</td></tr><tr><td>m. Pl.</td><td>beaux</td><td>nouveaux</td><td>vieux</td></tr><tr><td>f. Pl.</td><td>belles</td><td>nouvelles</td><td>vieilles</td></tr></table>',
  pc: '<div class="dr-pcs">avoir + Partizip · <b>-er → -é</b> (acheter → acheté) · <b>mettre → mis</b><br><span class="t-sub">j\'ai · tu as · il a · nous avons · vous avez · ils ont</span></div>'
};
/** Spickzettel, der in den ersten Stufen während der Aufgabe sichtbar ist */
function drillSpick(it) {
  if (!it.spick) return "";
  let inner;
  if (it.spick === "ends") { const v = DRILL.VERBS[it.verb]; inner = endsStrip(v.end.map(e => e ? "-" + e : "–")) + '<div class="dr-spn">' + (it.verb === "mettre" ? "Singular: <b>met-</b> · Plural: <b>mett-</b>" : "👢 je, tu, il, ils: " + esc(v.note.replace(" im Stiefel", "")) + " · nous, vous: wie im Infinitiv") + '</div>'; }
  else inner = MINI[it.spick] || "";
  return '<details class="dr-spick"' + (it.fmt === "ending" || it.fmt === "build" || it.box === 0 ? " open" : "") + '><summary>📋 Spickzettel</summary>' + inner + '</details>';
}
function drillTopicPage(t) {
  const st = drillStats(t.id); const p = DRILL.progress(t.id, st);
  let card = "";
  if (t.id === "stiefel") card = stiefelCheat() + '<div class="dr-more">Alle Verben einzeln (antippen zum Aufklappen):</div>' +
    t.verbs.map(v => '<details class="card dr-verb"><summary><b>' + esc(v) + '</b><span class="t-sub">' + esc(DRILL.VERBS[v].de) + ' · ' + esc(DRILL.VERBS[v].note) + '</span></summary>' + conjTable(v) + '<a class="btn sm" href="#/drill/stiefel?challenge=' + encodeURIComponent(v) + '">⏱ Tabellen-Challenge</a></details>').join("");
  else if (t.id === "mettre") card = '<div class="card dr-rule"><div class="dr-boot">✂️</div><div><b>mettre: Singular kurz, Plural doppel-t</b><p>je <b>mets</b>, tu <b>mets</b>, il <b>met</b> – nous <b>mettons</b>, vous <b>mettez</b>, ils <b>mettent</b>. Passé composé: j\'ai <b>mis</b>.</p><p class="t-sub">Bedeutet: (hin)legen, stellen, setzen, Kleidung anziehen, Tisch decken.</p></div></div><div class="card dr-verb">' + conjTable("mettre") + '<a class="btn sm" href="#/drill/mettre?challenge=mettre">⏱ Tabellen-Challenge</a></div>';
  else if (t.id === "pc") card = '<div class="card dr-rule"><div class="dr-boot">⏮️</div><div><b>Passé composé = avoir + Partizip</b><p>-er-Verben: Endung <b>-é</b> → j\'ai achet<b>é</b>, essay<b>é</b>, pay<b>é</b>, préfér<b>é</b>, répét<b>é</b>. Unregelmäßig: mettre → j\'ai <b>mis</b>.</p><p class="t-sub">j\'ai · tu as · il/elle a · nous avons · vous avez · ils/elles ont</p></div></div>';
  else if (t.id === "ce") card = '<div class="card dr-rule"><div class="dr-boot">👉</div><div><b>ce, cet, cette, ces = dieser, diese, dieses</b><table class="dr-mini"><tr><td>männlich + Konsonant</td><td><b>ce</b> CD, ce pull</td></tr><tr><td>männlich + Vokal/h</td><td><b>cet</b> acteur, cet homme</td></tr><tr><td>weiblich</td><td><b>cette</b> BD, cette amie</td></tr><tr><td>Plural (m. und f.)</td><td><b>ces</b> films, ces BD</td></tr></table></div></div>';
  else if (t.id === "quel") card = '<div class="card dr-rule"><div class="dr-boot">❓</div><div><b>quel … ? = welcher, welche, welches?</b><table class="dr-mini"><tr><td></td><td>Singular</td><td>Plural</td></tr><tr><td>männlich</td><td><b>quel</b> CD ?</td><td><b>quels</b> films ?</td></tr><tr><td>weiblich</td><td><b>quelle</b> BD ?</td><td><b>quelles</b> BD ?</td></tr></table><p class="t-sub">Angleichung wie bei Adjektiven: f + e, Plural + s. Vor Vokal bleibt es <b>quel</b> (quel acteur).</p></div></div>';
  else if (t.id === "beau") card = '<div class="card dr-rule"><div class="dr-boot">✨</div><div><b>beau, nouveau, vieux stehen VOR dem Nomen</b><table class="dr-mini dr-adj"><tr><td></td><td>beau</td><td>nouveau</td><td>vieux</td></tr><tr><td>m.</td><td>beau film</td><td>nouveau film</td><td>vieux film</td></tr><tr><td>m. + Vokal</td><td><b>bel</b> avion</td><td><b>nouvel</b> avion</td><td><b>vieil</b> avion</td></tr><tr><td>f.</td><td><b>belle</b></td><td><b>nouvelle</b></td><td><b>vieille</b></td></tr><tr><td>m. Pl.</td><td>beaux</td><td>nouveaux</td><td>vieux</td></tr><tr><td>f. Pl.</td><td>belles</td><td>nouvelles</td><td>vieilles</td></tr></table></div></div>';
  const bp = t.kind === "conj" ? DRILL.byPerson(t.id, st) : [];
  const heat = bp.some(x => x.n) ? '<div class="card dr-heatc"><h2>Wo hakt\'s?</h2><div class="dr-heat">' + bp.map(x => '<div class="dr-h ' + (x.pct == null ? "" : x.pct >= 85 ? "g" : x.pct >= 60 ? "o" : "r") + '"><b>' + esc(x.label) + '</b><span>' + (x.pct == null ? "–" : x.pct + " %") + '</span></div>').join("") + '</div><p class="t-sub" style="margin-bottom:0">Rot/orange kommt in den nächsten Runden öfter dran.</p></div>' : '';
  return '<a class="backlink" href="#/drill">' + ICO.back + 'Grammatik-Drill</a><div class="dr-head"><h1 class="t-large">' + esc(t.title) + '</h1><div class="t-sub">' + p.ok + ' von ' + p.n + ' sitzen</div>' + progBar(p.pct, p.pct >= 80 ? "g" : "") + '</div>' +
    modeSeg("fr") + (Object.keys(st).length ? '<button class="btn primary lg wide dr-go" data-drstart="' + t.id + '">' + ICO.play + 'Runde starten (12 Aufgaben)</button><a class="dr-introl" href="#/drill/' + t.id + '?intro=1">Einführung nochmal ansehen</a>'
      : '<a class="btn primary lg wide dr-go" href="#/drill/' + t.id + '?intro=1">' + ICO.play + 'Los geht\'s – Schritt für Schritt</a>') + (t.id === "stiefel" ? card + heat : heat + card);
}

/* ---------- Runde ---------- */
/** Aufgabe mit Lücke; bei „Fehler finden“ steht das falsche Wort durchgestrichen in der Lücke */
function drillQ(it, given) {
  const gap = given != null ? '<span class="dr-gap">' + esc(given) + '</span>' : it.wrong ? '<span class="dr-gap"><s>' + esc(it.wrong) + '</s></span>' : '<span class="dr-gap">___</span>';
  return (it.from && it.fmt === "um" ? '<div class="dr-from">' + esc(it.from) + ' <span>→</span></div>' : '') + '<div class="dr-q"><span>' + esc(it.prompt).replace("___", gap) + '</span></div>';
}
/* ---------- Einführung vor der ersten Runde ---------- */
const HOW = '<div class="dr-how"><b>So übst du – in kleinen Schritten:</b><ol><li><b>Endung einsetzen</b> – der Stamm steht schon da</li><li><b>Bausteine</b> – Stamm + Endung antippen</li><li><b>Selbst schreiben</b> – mit Spickzettel</li><li>Später: Sätze, Umformen, Fehler finden – ohne Hilfe</li></ol><p class="t-sub">' + ACC_HELP + ' Am Anfang zählt ein fehlender Akzent noch als richtig.</p></div>';
function introSteps(t) {
  if (t.id === "stiefel") return [
    ["1 · Die Endungen", '<p>Bei acheter, essayer, payer, préférer und répéter sind die Endungen <b>immer gleich</b>:</p>' + endsStrip() + '<div class="dr-tip">🧠 Merk dir: <span class="nw"><b>tu</b> → -es</span> · <span class="nw"><b>nous</b> → -ons</span> · <span class="nw"><b>vous</b> → -ez</span> · <span class="nw"><b>ils</b> → -ent</span> (spricht man nicht mit)</div>'],
    ["2 · Der Stiefel 👢", '<p>Schreib die 6 Formen als Tabelle. <b>je, tu, il, ils</b> bilden einen Stiefel. Nur dort ändert sich ein Buchstabe im Stamm:</p>' + bootGrid("acheter") + '<p class="t-sub">nous und vous stehen außerhalb – da bleibt alles wie im Infinitiv (acheter → nous achetons).</p>'],
    ["3 · Was ändert sich?", changeTable() + HOW]
  ];
  if (t.id === "mettre") return [
    ["1 · mettre", '<p>mettre = (hin)legen, stellen, anziehen. Die Endungen sind anders als bei acheter:</p>' + endsStrip(["-s", "-s", "–", "-ons", "-ez", "-ent"]) + '<div class="dr-tip">🧠 <b>Singular</b> (je, tu, il): <b>ein t</b> → mets, mets, met<br><b>Plural</b> (nous, vous, ils): <b>doppel-t</b> → mettons, mettez, mettent</div>'],
    ["2 · So übst du", HOW]
  ];
  const card = { pc: '<p><b>Passé composé = avoir + Partizip</b></p>' + MINI.pc, ce: '<p><b>ce, cet, cette, ces = dieser, diese, dieses</b></p>' + MINI.ce, quel: '<p><b>quel …? = welcher, welche, welches?</b> Wie ein Adjektiv: weiblich + e, Plural + s.</p>' + MINI.quel, beau: '<p><b>beau, nouveau, vieux</b> stehen vor dem Nomen. Vor Vokal (avion, anorak, hôtel) gibt es eine Sonderform.</p>' + MINI.beau }[t.id];
  return [["Kurz erklärt", card + '<div class="dr-how"><b>So übst du:</b> Erst mit Merk-Tabelle auf dem Bildschirm, später ohne. ' + ACC_HELP + '</div>']];
}
function drillIntro(t, n) {
  const steps = introSteps(t); n = Math.min(Math.max(1, n), steps.length); const [title, html] = steps[n - 1]; const last = n === steps.length;
  return '<div class="les dr-intro"><div class="les-top"><a class="closebtn" href="#/drill/' + t.id + '" aria-label="Schließen">' + ICO.x + '</a><div class="les-prog"><i style="width:' + Math.round(n / steps.length * 100) + '%"></i></div><span class="les-combo dim">' + n + '/' + steps.length + '</span></div>' +
    '<div class="les-body"><h2 class="les-h">' + title + '</h2>' + html + '</div>' +
    '<div class="les-foot">' + (n > 1 ? '<a class="btn lg" href="#/drill/' + t.id + '?intro=' + (n - 1) + '">Zurück</a>' : '<span></span>') +
    (last ? '<button class="btn primary lg" data-drstart="' + t.id + '">Erste Übung starten</button>' : '<a class="btn primary lg" id="dri_next" href="#/drill/' + t.id + '?intro=' + (n + 1) + '">Verstanden – weiter</a>') + '</div></div>';
}

function drillRun() {
  const R = DRL;
  if (R.done) return drillEnd();
  const it = R.items[R.i], ui = R.ui;
  const pct = Math.round(R.i / R.items.length * 100);
  const top = '<div class="les-top"><a class="closebtn" href="#/drill/' + R.topic + '" aria-label="Runde beenden">' + ICO.x + '</a><div class="les-prog"><i style="width:' + pct + '%"></i></div><span class="les-combo dim">' + R.right + '</span></div>';
  const build = it.fmt === "build";
  const shown = ui.checked ? ui.given : build && (ui.bs != null || ui.be != null) ? (ui.bs != null ? it.blocks.stems[ui.bs] : "…") + (ui.be != null ? it.blocks.ends[ui.be] : "…") : null;
  const head = (it.retry ? '<div class="les-again">Noch einmal – vorhin falsch</div>' : '') + '<h2 class="les-h">' + DRILL.FMT[it.fmt || "form"] + (R.mode === "schwer" ? ' <span class="mode-b">Schwer</span>' : '') + '</h2>' + drillQ(it, shown) + '<div class="t-sub dr-sub">' + esc(it.sub) + '</div>';
  let body;
  if (build) body = '<div class="dr-blocks"><div class="dr-bl"><span>Stamm</span>' + it.blocks.stems.map((x, k) => '<button class="dr-blk' + (ui.bs === k ? " on" : "") + '" data-drs="' + k + '"' + (ui.checked ? " disabled" : "") + '>' + esc(x) + '</button>').join("") + '</div>' +
    '<div class="dr-bl"><span>Endung</span>' + it.blocks.ends.map((x, k) => '<button class="dr-blk e' + (ui.be === k ? " on" : "") + '" data-dre="' + k + '"' + (ui.checked ? " disabled" : "") + '>' + (x ? esc(x) : "– keine") + '</button>').join("") + '</div></div>';
  else {
    const acc = it.fmt === "ending" ? [] : DRILL.accentsFor(it);
    body = '<input id="dr_in" class="answer-input dr-in' + (it.fmt === "ending" ? " short" : "") + '" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + (it.fmt === "ending" ? "Endung, z. B. ons" : "Form eintippen …") + '" value="' + esc(ui.given || "") + '"' + (ui.checked ? " readonly" : "") + '>' +
      (acc.length && !ui.checked ? '<div class="dr-accw"><span>Fehlt dir ein Buchstabe?</span>' + acc.map(a => '<button data-dracc="' + esc(a) + '">' + esc(a) + '</button>').join("") + '</div>' : '');
  }
  body += ui.checked ? '' : drillSpick(it) + (it.hint && it.fmt !== "ending" && it.fmt !== "build" ? (ui.tip ? '<div class="dr-hint">💡 ' + esc(it.hint) + '</div>' : '<div class="dr-tipw"><button class="btn sm" id="dr_tip">💡 Tipp anzeigen</button></div>') : '');
  const full = it.full ? DRILL.pron(it.person, it.full).replace(/([^'])$/, "$1 ") + it.full : it.answer;
  const okMsg = ui.res === "accent" && it.lenient ? "Richtig! Nur noch der Akzent: " + esc(full) : "Richtig!" + (it.full ? " → " + esc(full) : "");
  const foot = ui.checked ? '<div class="les-foot ' + (ui.ok ? "ok" : "bad") + '"><div class="les-fb"><b>' + (ui.ok ? okMsg : ui.res === "accent" ? "Fast – achte auf den Akzent: " + esc(full) : "Richtig wäre: " + esc(full)) + '</b><span>' + esc(it.why) + '</span></div><button class="btn lg les-next" id="dr_next">Weiter</button></div>'
    : '<div class="les-foot"><span class="t-sub">' + (ui.tip ? "Mit Tipp zählt es nicht als gelernt" : "") + '</span><button class="btn primary lg" id="dr_check"' + ((ui.given || "").trim() ? "" : " disabled") + '>Prüfen</button></div>';
  return '<div class="les">' + top + '<div class="les-body">' + head + body + '</div>' + foot + '</div>';
}
function bindRun() {
  document.body.classList.add("focus");
  const R = DRL; if (R.done) { const a = document.getElementById("dr_again"); if (a) a.onclick = () => drillStart(R.topic); return; }
  const it = R.items[R.i], ui = R.ui; const q = id => document.getElementById(id);
  const tip = q("dr_tip"); if (tip) tip.onclick = () => { ui.tip = true; route(); };
  const setBlock = () => { ui.given = ui.bs != null && ui.be != null ? it.blocks.stems[ui.bs] + it.blocks.ends[ui.be] : ""; route(); };
  document.querySelectorAll("[data-drs]").forEach(b => b.onclick = () => { ui.bs = +b.dataset.drs; setBlock(); });
  document.querySelectorAll("[data-dre]").forEach(b => b.onclick = () => { ui.be = +b.dataset.dre; setBlock(); });
  const inp = q("dr_in");
  if (inp) {
    inp.oninput = () => { ui.given = inp.value; const c = q("dr_check"); if (c) c.disabled = !inp.value.trim(); };
    inp.onkeydown = e => { if (e.key === "Enter" && inp.value.trim()) { e.preventDefault(); drillCheck(); } };
    if (!ui.checked) setTimeout(() => inp.focus(), 30);
    document.querySelectorAll("[data-dracc]").forEach(b => b.onmousedown = e => e.preventDefault());
    document.querySelectorAll("[data-dracc]").forEach(b => b.onclick = () => { const s = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, s) + b.dataset.dracc + inp.value.slice(inp.selectionEnd ?? s); inp.focus(); inp.setSelectionRange(s + 1, s + 1); inp.oninput(); });
  }
  const c = q("dr_check"); if (c) c.onclick = drillCheck;
  const n = q("dr_next"); if (n) { n.onclick = drillNext; setTimeout(() => n.focus(), 30); }
}
function drillCheck() {
  const R = DRL, it = R.items[R.i], ui = R.ui; if (ui.checked) return;
  ui.given = (ui.given || "").trim(); if (it.fmt === "ending") ui.given = ui.given.replace(/^-/, "");
  ui.res = DRILL.check(ui.given, it.answer, it); ui.checked = true;
  const ok = ui.ok = ui.res === "ok" || (ui.res === "accent" && !!it.lenient);
  if (ok && !it.retry && !ui.tip) R.right++;
  if (!ok) { R.wrong.push(it); const n = R.retries[it.key] || 0; if (n < 2) { R.retries[it.key] = n + 1; const base = DRILL.items(R.topic).find(x => x.key === it.key); R.items.splice(Math.min(R.items.length, R.i + 4), 0, Object.assign(DRILL.variant(base, R.mode === "schwer" ? 3 : Math.max(0, (it.level || 0) - 1), Math.random), { box: it.box, retry: true }, R.mode === "schwer" ? { hint: null } : {})); } }
  if (!it.retry && !(ok && ui.tip)) drillSave(R.topic, DRILL.learn(drillStats(R.topic), it.key, ok));
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
    (wrong.length ? '<div class="card tight dr-wrong"><b>Noch üben</b>' + wrong.slice(0, 8).map(w => '<div><span class="t-sub">' + esc(w.prompt.replace("___", "…")) + '</span> <b>' + esc(w.full || w.answer) + '</b></div>').join("") + '</div>' : '') +
    '<div class="les-endbtn"><button class="btn primary lg" id="dr_again">Noch eine Runde</button><a class="btn lg" href="#/drill/' + R.topic + '">Fertig</a></div></div>';
}

/* ---------- Tabellen-Challenge: alle 6 Formen auf Zeit ---------- */
function drillChallenge(t, verb) {
  const v = DRILL.VERBS[verb]; if (!v) return drillTopicPage(t);
  if (!DRC || DRC.verb !== verb) DRC = { verb, vals: ["", "", "", "", "", ""], start: null, res: null, time: null };
  const best = lsGet("lc_drill_best_" + verb, null);
  return '<a class="backlink" href="#/drill/' + t.id + '">' + ICO.back + esc(t.title) + '</a><div class="dr-head"><h1 class="t-large">⏱ ' + esc(v.inf) + '</h1><div class="t-sub">' + esc(v.de) + ' – alle Formen so schnell wie möglich' + (best ? ' · Bestzeit ' + (best / 1000).toFixed(1) + ' s' : '') + '</div></div>' +
    '<div class="card"><table class="dr-tab dr-ch"><tbody>' + v.forms.map((f, p) => '<tr class="' + (v.boot.includes(p) ? "boot" : "") + '"><td class="dr-p">' + DRILL.pron(p, f) + '</td><td><input data-drc="' + p + '" class="' + (DRC.res ? (DRC.res[p] ? "ok" : "bad") : "") + '" value="' + esc(DRC.vals[p]) + '" autocomplete="off" autocapitalize="off" spellcheck="false"' + (DRC.res && DRC.res.every(Boolean) ? " readonly" : "") + '></td><td class="dr-sol">' + (DRC.res && !DRC.res[p] ? esc(f) : "") + '</td></tr>').join("") + '</tbody></table>' +
    (DRILL.accentsFor({ verb, key: verb }).length ? '<div class="dr-accw"><span>Fehlt dir ein Buchstabe?</span>' + DRILL.accentsFor({ verb, key: verb }).map(a => '<button data-dracc="' + esc(a) + '">' + esc(a) + '</button>').join("") + '</div>' : '') +
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

/* ---------- Probe-Arbeit: 20 Aufgaben, ohne Hilfe, Note am Ende ---------- */
const DRT_POINTS = { ok: 1, accent: 0.5, wrong: 0 };
function drillTest() {
  if (!DRT) {
    const hist = (setting("drill_tests", []) || []).slice(-5).reverse();
    return '<a class="backlink" href="#/drill">' + ICO.back + 'Grammatik-Drill</a><div class="dr-head"><h1 class="t-large">📝 Probe-Arbeit</h1><div class="t-sub">So wie in der Klassenarbeit: 20 Aufgaben aus allen Themen, alles selbst schreiben, keine Tipps, keine Auswahl. Erst am Ende siehst du, was richtig war – und deine Note.</div></div>' +
      '<div class="card dr-rules"><div>✍️ Formen, Sätze, Umformen, Fehler finden</div><div>🎯 Akzentfehler = halber Punkt</div><div>⏱ ca. 8–10 Minuten</div></div>' +
      '<button class="btn primary lg wide dr-go" id="drt_start">' + ICO.play + 'Probe-Arbeit starten</button>' +
      (hist.length ? '<div class="card dr-heatc"><h2>Deine letzten Ergebnisse</h2>' + hist.map(h => '<div class="dr-hist"><span class="dr-note n' + h.note + '">' + h.note + '</span><span>' + h.pts + ' / ' + h.n + ' Punkte</span><span class="t-sub">' + fmtDL(h.d) + '</span></div>').join("") + '</div>' : '');
  }
  if (DRT.done) return drillTestEnd();
  const it = DRT.items[DRT.i]; const pct = Math.round(DRT.i / DRT.items.length * 100);
  return '<div class="les"><div class="les-top"><a class="closebtn" href="#/drill/test" id="drt_quit" aria-label="Abbrechen">' + ICO.x + '</a><div class="les-prog"><i style="width:' + pct + '%"></i></div><span class="les-combo dim">' + (DRT.i + 1) + '/' + DRT.items.length + '</span></div>' +
    '<div class="les-body"><h2 class="les-h">' + DRILL.FMT[it.fmt || "form"] + '</h2>' + drillQ(it) + '<div class="t-sub dr-sub">' + esc(it.sub) + '</div>' +
    '<input id="drt_in" class="answer-input dr-in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Antwort …" value="' + esc(DRT.given[DRT.i] || "") + '">' +
    '<div class="dr-accw"><span>Fehlt dir ein Buchstabe?</span>' + ["é", "è"].map(a => '<button data-dracc="' + esc(a) + '">' + esc(a) + '</button>').join("") + '</div><p class="t-sub dr-acch">' + ACC_HELP + '</p></div>' +
    '<div class="les-foot">' + (DRT.i ? '<button class="btn lg" id="drt_back">Zurück</button>' : '<span></span>') + '<button class="btn primary lg" id="drt_next">' + (DRT.i === DRT.items.length - 1 ? "Abgeben" : "Weiter") + '</button></div></div>';
}
function drillTestEnd() {
  const R = DRT.result;
  return '<div class="les les-done"><div class="les-trophy">' + (R.note <= 2 ? "🏆" : R.note <= 3 ? "🎉" : "💪") + '</div><h1 class="fx-title">Note ' + R.note + '</h1>' +
    '<div class="les-stats"><div><b>' + R.pts + '/' + R.n + '</b><span>Punkte</span></div><div><b>' + R.pct + ' %</b><span>richtig</span></div><div><b>+' + R.xp + '</b><span>XP</span></div></div>' +
    '<div class="card tight dr-res">' + DRT.items.map((it, k) => { const r = R.res[k];
      return '<div class="dr-ri ' + r + '"><span class="dr-rk">' + (r === "ok" ? "✓" : r === "accent" ? "½" : "✗") + '</span><div><div>' + esc(it.prompt).replace("___", '<b>' + esc(it.answer) + '</b>') + '</div>' + (r !== "ok" ? '<div class="t-sub">Du: <s>' + esc(DRT.given[k] || "–") + '</s>' + (it.why ? ' · ' + esc(it.why) : '') + '</div>' : '') + '</div></div>'; }).join("") + '</div>' +
    '<div class="les-endbtn"><button class="btn primary lg" id="drt_again">Neue Probe-Arbeit</button><a class="btn lg" href="#/drill">Fertig</a></div></div>';
}
function bindTest() {
  const q = id => document.getElementById(id);
  const st = q("drt_start"); if (st) st.onclick = () => { DRT = { items: DRILL.testRound(setting("drill", {}) || {}), i: 0, given: [], done: false }; route(); };
  const ag = q("drt_again"); if (ag) ag.onclick = () => { DRT = { items: DRILL.testRound(setting("drill", {}) || {}), i: 0, given: [], done: false }; route(); };
  const quit = q("drt_quit"); if (quit) quit.onclick = e => { e.preventDefault(); if (!DRT.given.some(Boolean) || confirm("Probe-Arbeit abbrechen?")) { DRT = null; route(); } };
  if (!DRT || DRT.done) return;
  document.body.classList.add("focus");
  const inp = q("drt_in"); if (!inp) return;
  const save = () => { DRT.given[DRT.i] = inp.value; };
  inp.oninput = save; setTimeout(() => inp.focus(), 30);
  inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); q("drt_next").click(); } };
  document.querySelectorAll("[data-dracc]").forEach(b => b.onmousedown = e => e.preventDefault());
  document.querySelectorAll("[data-dracc]").forEach(b => b.onclick = () => { const s = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, s) + b.dataset.dracc + inp.value.slice(inp.selectionEnd ?? s); inp.focus(); inp.setSelectionRange(s + 1, s + 1); save(); });
  const bk = q("drt_back"); if (bk) bk.onclick = () => { save(); DRT.i--; route(); };
  q("drt_next").onclick = async () => {
    save(); if (DRT.i < DRT.items.length - 1) { DRT.i++; return route(); }
    if (DRT.given.filter(x => (x || "").trim()).length < DRT.items.length && !confirm("Noch nicht alles ausgefüllt – trotzdem abgeben?")) return;
    await drillGrade();
  };
}
async function drillGrade() {
  const res = DRT.items.map((it, k) => DRILL.check(DRT.given[k], it.answer, it));
  const pts = res.reduce((a, r) => a + DRT_POINTS[r], 0), n = DRT.items.length, pct = Math.round(pts / n * 100);
  const all = Object.assign({}, setting("drill", {}) || {});
  DRT.items.forEach((it, k) => { all[it.topic] = DRILL.learn(all[it.topic] || {}, it.key, res[k] === "ok"); });
  STATE.settings.drill = all; await setSetting("drill", all);
  const note = DRILL.grade(pct); const xp = 10 + Math.round(pts);
  const hist = (setting("drill_tests", []) || []).concat([{ d: todayISO(), note, pts, n }]).slice(-20);
  await setSetting("drill_tests", hist);
  DRT.result = { res, pts, n, pct, note, xp }; DRT.done = true;
  addXP(xp); route();
}
