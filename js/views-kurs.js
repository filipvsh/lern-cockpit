/* =====================================================================
   LERN-COCKPIT · LERNKURS ZUR KLAUSUR (Klausur-Standard, siehe CLAUDE.md)
   #/kurs/<id>                 Kurs-Start: Countdown, heute dran, Kapitel-Pfad,
                               Merkblatt, Videos, Probe-Klausur, Blitz
   #/kurs/<id>?k=<Kapitel>     Kapitel: Erklärung, Diagramme, Beispiele Schritt
                               für Schritt, Bewegungs-Labor, typische Fehler,
                               Videos, Üben
   #/kurs/<id>?k=merkblatt     Merkblatt (druckbar)
   #/kurs/<id>?k=videos        alle Videos zum Abhaken
   Kurse liefern Daten nach dem Muster von PK.COURSE (js/physik-kurs.js).
   Gelesen-Status in einstellungen.kurs_gelesen = { "<id>:<Kapitel>": Datum }.
   ===================================================================== */
const LERNKURSE = () => {
  const out = [];
  if (typeof PK !== "undefined") { if (typeof PHYS !== "undefined" && !PK.COURSE.topics) Object.assign(PK.COURSE, { topics: PHYS.TOPICS, plan: PHYS.PLAN, items: PHYS.ITEMS, examKeys: PHYS.EXAM, blitzKeys: PHYS.BLITZ, qf: "ph", testsKey: "physik_tests", blitzRec: "lc_ph_blitz",
    examDesc: "13 Aufgaben quer durch die Kinematik (Einheiten, Gesetze, Diagramme, Anhalteweg, Einholen, s ~ t²)", blitzDesc: "Einheiten, Formeln, Diagramme.", crSheet: { grund: [0], gleich: [1], besch: [2], diag: [3], anhalt: [4], treff: [5], exp: [6, 7] } }); out.push(PK.COURSE); }
  if (typeof EK !== "undefined") { if (!EK.COURSE.unit) Object.assign(EK.COURSE, { exam: "#/mathe/test?f=ek", blitz: "#/mathe/blitz?f=ek", unit: id => "ku:erdkunde:" + id, all: "ku:erdkunde:all", termKey: id => "ek:beg_" + id }); out.push(EK.COURSE); }
  return out;
};
/** Kurs zu einem Fach (für Klausur-Seite, Fehlerheft) */
const kursOfFach = f => LERNKURSE().find(c => c.fach === f);
/** Übungs-Schlüssel eines Kapitels */
const chKeys = (c, ch) => ch.keys || ((c.topics || []).find(t => t.id === ch.id) || { keys: [] }).keys;
const kursById = id => LERNKURSE().find(c => c.id === id);
const kursRead = () => setting("kurs_gelesen", {}) || {};
const kuMd = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
const kuProg = (c, ch) => typeof MK !== "undefined" ? MK.progressKeys(chKeys(c, ch), mkStats()) : 0;
const kuExam = c => typeof fachExam === "function" ? fachExam(c.fach) : null;

V.kurs = () => {
  if (!STATE.loaded) return pageHead("Lernkurs");
  const c = kursById(ROUTE.sub || ""); if (!c) { location.hash = "#/faecher"; return ""; }
  const k = ROUTE.query.k || "";
  if (k === "merkblatt") return kuSheet(c);
  if (k === "videos") return kuVideos(c);
  if (k === "crash") return crView(c);
  if (k === "begriffe" && c.terms) return kuTerms(c);
  const ch = c.chapters.find(x => x.id === k);
  return ch ? kuChapter(c, ch) : kuHome(c);
};

/* ---------- Kurs-Start ---------- */
function kuHome(c) {
  const ex = kuExam(c); const d = ex ? daysUntil(ex.datum) : null; const rd = kursRead();
  const ps = c.chapters.map(ch => kuProg(c, ch)); const next = c.chapters.findIndex((ch, i) => !rd[c.id + ":" + ch.id] || ps[i] < MK_DONE);
  const vids = c.chapters.flatMap(ch => ch.vids); const seen = videoSeen(); const vs = vids.filter(v => seen[v.id]).length;
  const last = (setting(c.testsKey, []) || []).slice(-1)[0];
  const plan = c.plan || []; const today = plan.find(p => p.d === todayISO()) || (c.terms ? plan.find(p => p.d > todayISO()) : null);
  const head = '<a class="backlink" href="' + (ex ? "#/klausur/" + esc(ex.id) : "#/fach/" + encodeURIComponent(c.fach)) + '">' + ICO.back + esc(c.fach) + '</a>' +
    '<div class="ku-hero"><div><div class="eyebrow">📚 Lernkurs ' + esc(c.fach) + '</div><h1 class="t-large">' + esc(c.title) + '</h1><div class="t-sub">' + esc(c.sub) + '</div></div>' +
    (d != null ? '<div class="ku-count"><b>' + (d <= 0 ? "heute" : d) + '</b><span>' + (d === 1 ? "Tag" : d <= 0 ? "" : "Tage") + '</span></div>' : '') + '</div>';
  const nx = next >= 0 ? c.chapters[next] : null;
  const go = '<div class="card ku-go">' + (nx ? '<div><span class="km-rec">Als Nächstes</span><b>Kapitel ' + (next + 1) + ': ' + esc(nx.title) + '</b><span class="t-sub">' + (rd[c.id + ":" + nx.id] ? "Erklärung gelesen – jetzt üben, bis es sitzt" : "Erst lesen und die Beispiele mitrechnen, dann üben") + '</span></div><a class="btn primary lg" href="#/kurs/' + c.id + '?k=' + nx.id + '">' + ICO.play + 'Weiterlernen</a>'
    : '<div><span class="km-rec">Alles durch 💪</span><b>Jetzt unter Klausurbedingungen testen</b><span class="t-sub">Probe-Klausur in der App + die echte Probeklausur auf Papier</span></div><a class="btn primary lg" href="' + c.exam + '">📝 Probe-Klausur</a>') + '</div>' +
    (today ? '<div class="card ku-today"><b>📅 Lernplan ' + (today.d === todayISO() ? "heute" : fmtDL(today.d)) + ': ' + esc(today.title) + '</b><ul class="ku-tasks">' + today.tasks.map(t => kuTask(c, t)).join("") + '</ul>' + (c.terms ? '<details class="ku-plan"><summary>Ganzen Lernplan bis zur Klausur zeigen</summary>' + plan.map(p => '<div class="ku-pd' + (p.d === todayISO() ? " today" : p.d < todayISO() ? " past" : "") + '"><b>' + esc(fmtDL(p.d)) + ' · ' + esc(p.title) + '</b><ul class="ku-tasks">' + p.tasks.map(t => kuTask(c, t)).join("") + '</ul></div>').join("") + '</details>' : '') + '</div>' : '');
  const cr = crState(c); const crDone = c.chapters.filter(ch => cr[ch.id]).length;
  const crash = '<a class="card ku-crash-card" href="#/kurs/' + c.id + '?k=crash"><span class="ku-cc-ic">🚀</span><div><b>Crashkurs – alles an einem Abend (ca. 2 Std.)</b><span class="t-sub">' + (crDone ? crDone + ' von ' + c.chapters.length + ' Blöcken geschafft – weitermachen' : '' + c.chapters.length + ' Blöcke: kurz Input, dann sofort abgefragt. Am Ende Probe-Klausur.') + '</span>' + progBar(Math.round(crDone / c.chapters.length * 100), crDone === c.chapters.length ? "g" : "") + '</div><span class="chev">' + ICO.chev + '</span></a>';
  const tools = '<div class="ku-tools">' +
    '<a class="ku-tool" href="#/kurs/' + c.id + '?k=merkblatt"><span>📋</span><b>Merkblatt</b><small>' + (c.terms ? 'alles Wichtige + Fachbegriffe' : 'alle Formeln & Diagramme') + ' · druckbar</small></a>' +
    '<a class="ku-tool" href="#/kurs/' + c.id + '?k=videos"><span>🎬</span><b>Videos</b><small>' + vs + ' von ' + vids.length + ' gesehen</small></a>' +
    '<a class="ku-tool" href="' + c.exam + '"><span>📝</span><b>Probe-Klausur</b><small>ohne Hilfe, mit Note' + (last ? ' · zuletzt ' + esc(last.note) : '') + '</small></a>' +
    '<a class="ku-tool" href="' + c.blitz + '"><span>⚡</span><b>Blitz</b><small>60 Sekunden</small></a>' +
    (c.terms ? '<a class="ku-tool" href="#/kurs/' + c.id + '?k=begriffe"><span>🔤</span><b>Fachbegriffe</b><small>' + c.chapters.reduce((a, ch) => a + (ch.terms || []).length, 0) + ' Begriffe · lernen & eintippen</small></a>' : '') +
    (ex && c.items ? '<a class="ku-tool" href="#/klausur/' + esc(ex.id) + '?tab=checkliste"><span>✅</span><b>Checkliste</b><small>Lehrer-Liste + Probeklausur-Lösungen</small></a>' : '') +
    (typeof fehlerOf === "function" && fehlerOf(c.fach).length ? '<a class="ku-tool" href="#/fehler?fach=' + encodeURIComponent(c.fach) + '"><span>📕</span><b>Fehlerheft</b><small>' + fehlerOf(c.fach).length + ' Fehler üben</small></a>' : '') + '</div>';
  const path = '<h2 class="fa-sec">Kapitel</h2><div class="ku-path">' + c.chapters.map((ch, i) => { const r = !!rd[c.id + ":" + ch.id], p = ps[i], done = r && p >= MK_DONE;
    return '<div class="card ku-ch' + (done ? " done" : "") + (i === next ? " next" : "") + '"><a class="ku-ch-main" href="#/kurs/' + c.id + '?k=' + ch.id + '"><span class="ku-n">' + (done ? "✓" : i + 1) + '</span><div class="ku-ch-tx"><b>' + ch.ico + ' ' + esc(ch.title) + '</b><span class="t-sub">' + esc(ch.goal) + '</span>' +
      '<span class="ku-st"><span class="' + (r ? "ok" : "") + '">' + (r ? "✓ gelesen" : "○ noch nicht gelesen") + '</span><span>' + p + ' % geübt</span></span>' + progBar(p, p >= MK_DONE ? "g" : "") + '</div></a>' +
      '<div class="ku-ch-acts"><a class="btn sm" href="#/kurs/' + c.id + '?k=' + ch.id + '">📖 Lernen</a><button class="btn sm primary" data-mkstart="' + c.unit(ch.id) + '">' + ICO.play + 'Üben</button></div></div>'; }).join("") + '</div>';
  return head + (d != null && d <= 2 ? crash + go : go + crash) + tools + modeSeg("ma") + '<button class="btn lg wide dr-go" data-mkstart="' + c.all + '">' + ICO.play + 'Alles gemischt üben (10 Aufgaben)</button>' + path;
}

/* ---------- Kapitel ---------- */
let KU_LAB = {};
function kuSection(s, i) {
  let h = '<section class="card ku-sec"><h2><span class="ku-sn">' + (i + 1) + '</span>' + esc(s.h) + '</h2>';
  if (s.t) h += '<p>' + kuMd(s.t) + '</p>';
  if (s.f) h += '<div class="ck-f ku-f">' + kuMd(s.f) + '</div>';
  if (s.tbl) h += '<div class="ku-tw"><table class="ku-tbl"><tr>' + s.tbl[0].map(x => '<th>' + esc(x) + '</th>').join("") + '</tr>' + s.tbl.slice(1).map(r => '<tr>' + r.map((x, j) => j ? '<td>' + esc(x) + '</td>' : '<th>' + esc(x) + '</th>').join("") + '</tr>').join("") + '</table></div>';
  if (s.matrix && typeof PK !== "undefined") h += PK.matrix();
  if (s.svg) h += '<div class="ku-fig ku-ill">' + s.svg + '</div>';
  if (s.fig) h += '<div class="ku-fig">' + PK.svg(s.fig) + '</div>';
  if (s.figs) h += '<div class="ku-figs">' + s.figs.map(f => '<div class="ku-fig">' + PK.svg(f) + '</div>').join("") + '</div>';
  if (s.lab) h += '<div class="ku-lab" data-lab=\'' + JSON.stringify(s.lab) + '\'></div>';
  if (s.ex) h += '<div class="ku-ex"><div class="ku-exh">✏️ Beispiel – rechne erst selbst auf Papier, dann Schritt für Schritt aufdecken</div><div class="ku-exq">' + kuMd(s.ex.q) + '</div><ol class="ku-steps">' + s.ex.steps.map(x => '<li hidden>' + kuMd(x) + '</li>').join("") + '</ol><div class="ku-exa" hidden>Ergebnis: <b>' + kuMd(s.ex.a) + '</b></div><div class="ku-exb"><button class="btn sm primary" data-kustep>Nächster Schritt</button><button class="btn sm" data-kuall>Ganze Lösung</button></div></div>';
  if (s.tip) h += '<div class="ku-tip">💡 ' + kuMd(s.tip) + '</div>';
  return h + '</section>';
}
function kuChapter(c, ch) {
  const i = c.chapters.indexOf(ch), prev = c.chapters[i - 1], next = c.chapters[i + 1]; const rd = kursRead(); const read = !!rd[c.id + ":" + ch.id]; const p = kuProg(c, ch);
  const seen = videoSeen(); const ex = kuExam(c);
  const items = (c.items || []).filter(it => (ch.nrs || []).includes(it.nr));
  const practice = '<div class="card ku-side-c"><h3>⚡ Üben</h3><div class="t-sub">' + p + ' % geübt' + (p >= MK_DONE ? " – sitzt ✓" : "") + '</div>' + progBar(p, p >= MK_DONE ? "g" : "") + modeSeg("ma") + '<button class="btn primary lg wide" data-mkstart="' + c.unit(ch.id) + '">' + ICO.play + '10 Aufgaben üben</button><p class="t-sub" style="margin:8px 0 0">Jedes Mal neu gemischt. Bei Fehlern siehst du sofort die Lösung – und die Aufgabe landet im Fehlerheft.</p></div>';
  const vids = ch.vids.length ? '<div class="card ku-side-c"><h3>🎬 Videos zum Kapitel</h3>' + ch.vids.map(v => '<div class="ku-vid' + (seen[v.id] ? " seen" : "") + '"><a href="https://www.youtube.com/watch?v=' + esc(v.id) + '" target="_blank" rel="noopener"><img loading="lazy" onerror="this.remove()" src="https://i.ytimg.com/vi/' + esc(v.id) + '/mqdefault.jpg" alt=""><span>' + esc(v.t) + '</span></a><button class="vid-chk" data-vid="' + esc(v.id) + '" aria-label="Gesehen">' + (seen[v.id] ? "✓" : "") + '</button></div>').join("") + '</div>' : '';
  const ck = items.length ? '<div class="card ku-side-c"><h3>✅ Punkte der Checkliste</h3><ul class="ku-ck">' + items.map(it => '<li><b>' + esc(it.nr) + '</b> ' + esc(it.title) + '</li>').join("") + '</ul>' + (ex ? '<a class="btn sm" href="#/klausur/' + esc(ex.id) + '?tab=checkliste">Checkliste öffnen</a>' : '') + '</div>' : '';
  const paper = items.flatMap(it => it.paper || []).filter(Boolean);
  const heft = paper.length ? '<section class="card ku-sec ku-paper"><h2>✍️ Ins Heft / aufs iPad</h2><ul>' + paper.map(x => '<li>' + mkMd(x) + '</li>').join("") + '</ul></section>' : '';
  const pit = '<section class="card ku-sec ku-pit"><h2>⚠️ Typische Fehler in der Klausur</h2><ul>' + ch.pit.map(x => '<li>' + kuMd(x) + '</li>').join("") + '</ul></section>';
  const doneBox = '<div class="card ku-done"><label><input type="checkbox" id="ku_read"' + (read ? " checked" : "") + '> <b>Kapitel gelesen und Beispiele mitgerechnet</b></label><button class="btn primary" data-mkstart="' + c.unit(ch.id) + '">' + ICO.play + 'Jetzt üben</button></div>';
  const nav = '<div class="ck-nav">' + (prev ? '<a class="btn" href="#/kurs/' + c.id + '?k=' + prev.id + '">← ' + esc(prev.short) + '</a>' : '<span></span>') + (next ? '<a class="btn" href="#/kurs/' + c.id + '?k=' + next.id + '">' + esc(next.short) + ' →</a>' : '<a class="btn" href="' + c.exam + '">📝 Probe-Klausur →</a>') + '</div>';
  return '<a class="backlink" href="#/kurs/' + c.id + '">' + ICO.back + 'Lernkurs ' + esc(c.title) + '</a>' +
    '<div class="ku-chhead"><div class="eyebrow">Kapitel ' + (i + 1) + ' von ' + c.chapters.length + '</div><h1 class="t-large">' + ch.ico + ' ' + esc(ch.title) + '</h1><div class="ku-goal">🎯 ' + esc(ch.goal) + '</div>' +
    '<div class="ku-toc">' + ch.sec.map((s, j) => '<a href="#" data-kutoc="' + j + '">' + (j + 1) + '. ' + esc(s.h.replace(/^🔬 /, "")) + '</a>').join("") + (ch.terms ? '<a href="#" data-kutoc="terms">🔤 Fachbegriffe</a>' : '') + '<a href="#/kurs/' + c.id + '?k=merkblatt">📋 Merkblatt</a></div><button class="btn primary ku-mob" data-mkstart="' + c.unit(ch.id) + '">' + ICO.play + 'Direkt üben (' + p + ' % geübt)</button></div>' +
    '<div class="ku-grid"><div class="ku-main">' + ch.sec.map(kuSection).join("") + kuTermSec(c, ch) + pit + heft + doneBox + nav + '</div><aside class="ku-side">' + practice + vids + ck + '</aside></div>';
}

/* ---------- Bewegungs-Labor (s-t, v-t, a-t live) ---------- */
function kuLabHtml(L) {
  const T = 10, sF = t => 0.5 * L.a * t * t + L.v0 * t + L.s0, vF = t => L.a * t + L.v0;
  const sv = PK.curve(sF, 0, T, 50), vv = PK.curve(vF, 0, T, 2);
  const yr = (arr, inc0) => { const ys = arr.map(p => p[1]).concat(inc0 ? [0] : []); return PK.axis(Math.min(...ys), Math.max(...ys), 4); };
  const sa = yr(sv, true), va = yr(vv, true), aa = PK.axis(Math.min(0, L.a, -0.5), Math.max(0, L.a, 0.5), 4);
  const t = L.t, st = sF(t), vt = vF(t), fx = PK.fx;
  const area = [[0, 0]].concat(PK.curve(vF, 0, t, 2)).concat([[t, 0]]);
  const fig = (o) => '<div class="ku-fig">' + PK.svg(Object.assign({ w: 300, h: 210, x: [0, T, 2] }, o)) + '</div>';
  return '<div class="ku-lab-v"><span>s(' + fx(t) + ' s) = ½ · ' + fx(L.a) + ' · ' + fx(t) + '² + ' + fx(L.v0) + ' · ' + fx(t) + ' + ' + fx(L.s0) + ' = <b>' + fx(st) + ' m</b></span><span>v(' + fx(t) + ' s) = ' + fx(L.a) + ' · ' + fx(t) + ' + ' + fx(L.v0) + ' = <b>' + fx(vt) + ' m/s</b> (' + fx(vt * 3.6) + ' km/h)</span><span>Bewegung: <b>' + (L.a === 0 ? (L.v0 === 0 ? "Ruhe" : "gleichförmig") : "gleichmäßig " + (L.a > 0 ? "beschleunigt" : "verzögert (bremsen)")) + '</b></span></div>' +
    '<div class="ku-figs three">' + fig({ y: sa, yl: "s in m", title: "s-t", lines: [{ pts: sv, c: 1 }], marks: [{ x: t, y: st, c: 2 }], vlines: [{ x: t }] }) +
    fig({ y: va, yl: "v in m/s", title: "v-t", lines: [{ pts: vv, c: 1 }], areas: t > 0 ? [{ pts: area, c: 1 }] : [], marks: [{ x: t, y: vt, c: 2 }], vlines: [{ x: t }] }) +
    fig({ y: aa, yl: "a in m/s²", title: "a-t", lines: [{ pts: [[0, L.a], [T, L.a]], c: 1 }], marks: [{ x: t, y: L.a, c: 2 }], vlines: [{ x: t }] }) + '</div>';
}
const KU_SL = [["s0", "s₀", 0, 50, 5, "m"], ["v0", "v₀", -5, 20, 1, "m/s"], ["a", "a", -3, 3, 0.5, "m/s²"], ["t", "t", 0, 10, 0.5, "s"]];
function bindKuLab(el) {
  const L = Object.assign({ t: 4 }, JSON.parse(el.dataset.lab));
  el.innerHTML = '<div class="ku-lab-c">' + KU_SL.map(([k, l, min, max, step, u]) => '<label class="ku-sl"><span>' + l + ' = <b data-labv="' + k + '">' + PK.fx(L[k]) + '</b> ' + u + '</span><input type="range" data-labk="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + L[k] + '"></label>').join("") + '</div><div class="ku-lab-o"></div>';
  const out = el.querySelector(".ku-lab-o"); const draw = () => { out.innerHTML = kuLabHtml(L); };
  el.querySelectorAll("[data-labk]").forEach(x => x.oninput = () => { L[x.dataset.labk] = +x.value; el.querySelector('[data-labv="' + x.dataset.labk + '"]').textContent = PK.fx(+x.value); draw(); });
  draw();
}

/* ---------- Merkblatt ---------- */
function kuSheet(c) {
  return '<div class="ku-noprint"><a class="backlink" href="#/kurs/' + c.id + '">' + ICO.back + 'Lernkurs ' + esc(c.title) + '</a></div>' +
    '<div class="ku-chhead"><div class="eyebrow">📋 Merkblatt ' + esc(c.fach) + '</div><h1 class="t-large">' + esc(c.title) + ' – alles auf einen Blick</h1><div class="t-sub">' + esc(c.sub) + '</div><div class="ku-noprint" style="margin-top:10px"><button class="btn" id="ku_print">🖨️ Drucken / als PDF sichern</button></div></div>' +
    (c.matrix ? '<section class="card ku-sec"><h2>Die drei Bewegungsarten</h2>' + c.matrix() + '</section>' : '') +
    (c.sheetFigs ? '<section class="card ku-sec"><h2>Die wichtigsten Skizzen</h2><div class="ku-sfigs">' + c.sheetFigs.map(x => '<div class="ku-fig ku-ill">' + x + '</div>').join("") + '</div></section>' : '') +
    '<div class="ku-sheet">' + c.sheet.map(b => '<section class="card ku-sb"><h2>' + esc(b.h) + '</h2><table class="ku-st">' + b.rows.map(r => '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>').join("") + '</table></section>').join("") + '</div>' +
    (c.terms ? '<section class="card ku-sec"><h2>🔤 Fachbegriffe A–Z</h2><div class="ku-az">' + c.chapters.flatMap(ch => ch.terms || []).slice().sort((x, y) => x[0].localeCompare(y[0], "de")).map(t => '<div><b>' + esc(t[0]) + '</b> – ' + esc(t[1]) + '</div>').join("") + '</div></section>' : '') +
    '<section class="card ku-sec"><h2>Typische Fehler – vorher abhaken</h2><ul class="ku-pitall">' + c.chapters.flatMap(ch => ch.pit).map(x => '<li>' + kuMd(x) + '</li>').join("") + '</ul></section>';
}
/* ---------- Videos ---------- */
function kuVideos(c) {
  const seen = videoSeen(); const all = c.chapters.flatMap(ch => ch.vids);
  return '<a class="backlink" href="#/kurs/' + c.id + '">' + ICO.back + 'Lernkurs ' + esc(c.title) + '</a>' + pageHead("🎬 Videos: " + c.title, { sub: all.filter(v => seen[v.id]).length + " von " + all.length + " gesehen · antippen öffnet YouTube, danach abhaken" }) +
    c.chapters.map((ch, i) => '<div class="card vid-set"><div class="km-row-h"><h2 style="margin:0">' + (i + 1) + '. ' + ch.ico + ' ' + esc(ch.short) + '</h2><a class="btn sm" href="#/kurs/' + c.id + '?k=' + ch.id + '">Kapitel</a></div><div class="vid-list">' +
      ch.vids.map((v, j) => '<div class="vid' + (seen[v.id] ? " seen" : "") + '"><a class="vid-a" href="https://www.youtube.com/watch?v=' + esc(v.id) + '" target="_blank" rel="noopener"><img loading="lazy" onerror="this.remove()" src="https://i.ytimg.com/vi/' + esc(v.id) + '/mqdefault.jpg" alt=""><span class="vid-t"><span class="vid-n">' + (j + 1) + '</span>' + esc(v.t) + '</span></a><button class="vid-chk" data-vid="' + esc(v.id) + '" aria-label="Gesehen">' + (seen[v.id] ? "✓" : "") + '</button></div>').join("") + '</div></div>').join("");
}

/* ---------- Crashkurs: Input → Abfrage, Block für Block (ca. 2 Std.) ----------
   #/kurs/<id>?k=crash              Übersicht + Weitermachen
   #/kurs/<id>?k=crash&s=<Kap>&p=N  Input-Karte N des Kapitels (letzte = Merke-Karte)
   Abfrage: mkStart("crash:<Kap>") – 8 Aufgaben, Ergebnis in einstellungen.kurs_crash */
const crUnit = (c, ch) => c.id === "physik" ? "crash:" + ch.id : "crash:" + c.id + ":" + ch.id;
const crState = c => ((setting("kurs_crash", {}) || {})[c.id]) || {};
async function crSave(cid, ch, r, n) { const all = Object.assign({}, setting("kurs_crash", {}) || {}); const m = Object.assign({}, all[cid] || {}); const old = m[ch];
  m[ch] = { r: Math.max(r, old ? old.r : 0), n, d: todayISO() }; all[cid] = m; await setSetting("kurs_crash", all); }
const crSecs = ch => ch.sec.filter(s => !s.lab);
const crMin = ch => Math.round(crSecs(ch).length * 1.5) + 9;
function crView(c) {
  const s = ROUTE.query.s; const ch = s && c.chapters.find(x => x.id === s);
  if (ch) return crCard(c, ch, Math.max(0, +ROUTE.query.p || 0));
  const st = crState(c); const i0 = c.chapters.findIndex(x => !st[x.id]); const left = c.chapters.filter(x => !st[x.id]).reduce((a, x) => a + crMin(x), 0) + 20;
  const next = i0 >= 0 ? c.chapters[i0] : null;
  return '<a class="backlink" href="#/kurs/' + c.id + '">' + ICO.back + 'Lernkurs ' + esc(c.title) + '</a>' +
    '<div class="ku-chhead"><div class="eyebrow">🚀 Crashkurs ' + esc(c.fach) + '</div><h1 class="t-large">Alles an einem Abend</h1><div class="ku-goal">So läuft es: <b>Input</b> (kurze Karten mit Formel, Graph und Beispiel – Beispiel erst selbst probieren) → <b>Merke-Karte</b> → sofort <b>8 Aufgaben</b> zum Abfragen. Das ' + c.chapters.length + '-mal, dann die <b>Probe-Klausur</b>. Du kannst jederzeit Pause machen – der Stand bleibt gespeichert.</div></div>' +
    '<div class="card ku-go"><div><span class="km-rec">' + (next ? "Noch ca. " + left + " Min." : "Fertig 💪") + '</span><b>' + (next ? "Block " + (i0 + 1) + ": " + esc(next.title) : "Jetzt die Probe-Klausur") + '</b><span class="t-sub">' + (next ? "Leg Papier, Stift und Taschenrechner bereit." : "13 Aufgaben ohne Hilfe, mit Note – wie morgen.") + '</span></div>' +
    (next ? '<a class="btn primary lg" id="cr_go" href="#/kurs/' + c.id + '?k=crash&s=' + next.id + '&p=0">' + ICO.play + (Object.keys(st).length ? "Weitermachen" : "Los geht's") + '</a>' : '<a class="btn primary lg" href="' + c.exam + '">📝 Probe-Klausur</a>') + '</div>' +
    '<div class="ku-path">' + c.chapters.map((x, i) => { const r = st[x.id]; const pc = r ? Math.round(r.r / r.n * 100) : null;
      return '<div class="card ku-ch' + (r ? " done" : "") + (i === i0 ? " next" : "") + '"><a class="ku-ch-main" href="#/kurs/' + c.id + '?k=crash&s=' + x.id + '&p=0"><span class="ku-n">' + (r ? "✓" : i + 1) + '</span><div class="ku-ch-tx"><b>' + x.ico + ' ' + esc(x.title) + '</b><span class="t-sub">' + (r ? r.r + " von " + r.n + " richtig" + (pc < 60 ? " – lieber nochmal abfragen" : "") : "ca. " + crMin(x) + " Min. · " + crSecs(x).length + " Input-Karten + 8 Aufgaben") + '</span></div></a>' +
        (r ? '<button class="btn sm' + (pc < 60 ? " primary" : "") + '" data-mkstart="' + crUnit(c, x) + '">Nochmal abfragen</button>' : '') + '</div>'; }).join("") +
    '<div class="card ku-ch' + (next ? "" : " next") + '"><a class="ku-ch-main" href="' + c.exam + '"><span class="ku-n">📝</span><div class="ku-ch-tx"><b>Finale: Probe-Klausur</b><span class="t-sub">ca. 20 Min. · danach Spickzettel/Merkblatt einmal durchlesen und schlafen 😴</span></div></a></div></div>';
}
function crCard(c, ch, p) {
  const secs = crSecs(ch); const n = secs.length + 1; p = Math.min(p, n - 1); const ci = c.chapters.indexOf(ch);
  const base = "#/kurs/" + c.id + "?k=crash&s=" + ch.id + "&p=";
  const total = c.chapters.reduce((a, x) => a + crSecs(x).length + 2, 0); const done = c.chapters.slice(0, ci).reduce((a, x) => a + crSecs(x).length + 2, 0) + p;
  let body;
  if (p < secs.length) body = '<div class="eyebrow">Block ' + (ci + 1) + ' · ' + esc(ch.short) + ' · Karte ' + (p + 1) + ' von ' + n + '</div>' + kuSection(secs[p], p);
  else body = '<div class="eyebrow">Block ' + (ci + 1) + ' · ' + esc(ch.short) + ' · Merke</div><section class="card ku-sec ku-merke"><h2>🧠 Das musst du aus diesem Block können</h2>' +
    ((c.crSheet || {})[ch.id] || []).map(j => c.sheet[j]).filter(Boolean).map(b => '<table class="ku-st">' + b.rows.map(r => '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>').join("") + '</table>').join("") +
    '<h3>⚠️ Nicht reinfallen</h3><ul>' + ch.pit.map(x => '<li>' + kuMd(x) + '</li>').join("") + '</ul><p class="t-sub">Lies das einmal laut, dann schließ kurz die Augen und sag die Formeln auswendig auf. Jetzt kommen 8 Aufgaben – Papier bereit!</p></section>';
  const last = p === n - 1;
  return '<div class="les ku-crash"><div class="les-top"><a class="closebtn" href="#/kurs/' + c.id + '?k=crash" aria-label="Pause">' + ICO.x + '</a><div class="les-prog"><i style="width:' + Math.round(done / total * 100) + '%"></i></div><span class="les-combo dim">' + (ci + 1) + '/' + c.chapters.length + '</span></div>' +
    '<div class="les-body">' + body + '</div>' +
    '<div class="les-foot">' + (p > 0 ? '<a class="btn lg" href="' + base + (p - 1) + '">Zurück</a>' : '<span></span>') +
    (last ? '<button class="btn primary lg" id="cr_quiz" data-mkstart="' + crUnit(c, ch) + '">Jetzt abfragen (8 Aufgaben)</button>' : '<a class="btn primary lg" id="cr_next" href="' + base + (p + 1) + '">Verstanden – weiter</a>') + '</div></div>';
}

/* ---------- Lernplan-Aufgabe (mit Sprung zum passenden Teil) ---------- */
function kuTask(c, t) {
  const a = (href, l) => ' <a class="ku-tgo" href="' + href + '">' + l + '</a>', b = (u, l) => ' <button class="ku-tgo" data-mkstart="' + u + '">' + l + '</button>';
  const go = t.ch ? a("#/kurs/" + c.id + "?k=" + t.ch, "📖 öffnen") : t.unit ? b(c.unit(t.unit), "▶ üben") : t.begriffe ? b("ku:" + c.id + ":begriffe", "🔤 los") : t.all ? b(c.all, "▶ üben") : t.exam ? a(c.exam, "📝 starten") : t.crash ? a("#/kurs/" + c.id + "?k=crash", "🚀 starten") : t.sheet ? a("#/kurs/" + c.id + "?k=merkblatt", "📋 öffnen") : t.fehler ? a("#/fehler?fach=" + encodeURIComponent(c.fach), "📕 öffnen") : "";
  return '<li>' + mkMd(t.t) + go + '</li>';
}
/* ---------- Fachbegriffe ---------- */
function kuTermSec(c, ch) {
  if (!ch.terms) return "";
  return '<section class="card ku-sec ku-terms"><h2>🔤 Fachbegriffe – die musst du können</h2><p class="t-sub">In der Klausur bringen Fachbegriffe Punkte. Lies sie einmal laut, dann übe sie: Du bekommst die Erklärung und tippst den Begriff ein.</p>' +
    '<div class="ku-tw"><table class="ku-tbl ku-gl">' + ch.terms.map(t => '<tr><th>' + esc(t[0]) + '</th><td>' + esc(t[1]) + '</td></tr>').join("") + '</table></div>' +
    '<button class="btn primary" data-mkstart="ku:' + c.id + ':beg-' + ch.id + '">🔤 Fachbegriffe üben (eintippen)</button></section>';
}
function kuTerms(c) {
  const all = c.chapters.flatMap(ch => (ch.terms || []).map(t => [t[0], t[1], ch]));
  const p = MK.progressKeys(c.chapters.map(ch => c.termKey(ch.id)), mkStats());
  return '<a class="backlink" href="#/kurs/' + c.id + '">' + ICO.back + 'Lernkurs ' + esc(c.title) + '</a>' + pageHead("🔤 Fachbegriffe: " + c.title, { sub: all.length + " Begriffe · " + p + " % sicher · Erklärung lesen → Begriff eintippen. Groß/klein und Umlaute sind egal, ein kleiner Tippfehler wird verziehen." }) +
    '<button class="btn primary lg wide dr-go" data-mkstart="ku:' + c.id + ':begriffe">' + ICO.play + 'Fachbegriffe-Trainer: 10 Begriffe abfragen</button>' + modeSeg("ma") + '<p class="t-sub" style="margin:-6px 0 14px">Leicht = mit Anfangsbuchstabe und Länge als Hilfe.</p>' +
    c.chapters.filter(ch => ch.terms).map((ch, i) => '<div class="card ku-sec"><div class="km-row-h"><h2 style="margin:0">' + ch.ico + ' ' + esc(ch.short) + '</h2><button class="btn sm" data-mkstart="ku:' + c.id + ':beg-' + ch.id + '">▶ nur diese</button></div><div class="ku-tw"><table class="ku-tbl ku-gl">' +
      ch.terms.map(t => '<tr><th>' + esc(t[0]) + '</th><td>' + esc(t[1]) + '</td></tr>').join("") + '</table></div></div>').join("");
}
/* ---------- Magnituden-Rechner ---------- */
function bindMagLab(el) {
  const L = { a: 6, b: 8 };
  el.innerHTML = '<div class="ku-lab-c">' + [["a", "Beben A"], ["b", "Beben B"]].map(([k, l]) => '<label class="ku-sl"><span>' + l + ': Magnitude <b data-labv="' + k + '">' + PK.fx(L[k]) + '</b></span><input type="range" data-labk="' + k + '" min="4" max="9.5" step="0.1" value="' + L[k] + '"></label>').join("") + '</div><div class="ku-lab-o"></div>';
  const out = el.querySelector(".ku-lab-o");
  const draw = () => { const d = Math.round((L.b - L.a) * 10) / 10, big = d >= 0, dd = Math.abs(d); const amp = Math.pow(10, dd), en = Math.pow(10, 1.5 * dd);
    const f = x => x >= 1e6 ? (x / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Mio." : x >= 100 ? Math.round(x).toLocaleString("de-DE") : x.toLocaleString("de-DE", { maximumFractionDigits: 1 });
    const w = x => Math.max(2, Math.min(100, Math.log10(x + 1) / Math.log10(Math.pow(10, 1.5 * 5.5) + 1) * 100));
    out.innerHTML = '<div class="ku-lab-v"><span>Unterschied: <b>' + PK.fx(dd) + ' Stufe' + (dd === 1 ? '' : 'n') + '</b> – Beben ' + (big ? "B" : "A") + ' ist stärker</span><span>Ausschlag im Seismogramm: <b>' + f(amp) + '-mal</b> so groß (10^' + PK.fx(dd) + ')</span><span>Freigesetzte Energie: <b>≈ ' + f(en) + '-mal</b> so viel (≈ 32 pro Stufe)</span></div>' +
      '<div class="ku-bars"><div><span>Ausschlag</span><i style="width:' + w(amp) + '%"></i></div><div><span>Energie</span><i class="e" style="width:' + w(en) + '%"></i></div></div><p class="t-sub">Balken logarithmisch – in echt ist der Unterschied noch viel größer.</p>'; };
  el.querySelectorAll("[data-labk]").forEach(x => x.oninput = () => { L[x.dataset.labk] = +x.value; el.querySelector('[data-labv="' + x.dataset.labk + '"]').textContent = PK.fx(+x.value); draw(); });
  draw();
}

function bindKurs() {
  const c = kursById(ROUTE.sub || ""); if (!c) return;
  bindModeSeg(); bindVideos();
  if (ROUTE.query.k === "crash" && ROUTE.query.s) document.body.classList.add("focus");
  document.querySelectorAll("[data-mkstart]").forEach(b => b.onclick = () => mkStart(b.dataset.mkstart));
  document.querySelectorAll(".ku-lab").forEach(el => (JSON.parse(el.dataset.lab).type === "mag" ? bindMagLab : bindKuLab)(el));
  document.querySelectorAll(".ku-ex").forEach(ex => {
    const lis = [...ex.querySelectorAll(".ku-steps li")], ans = ex.querySelector(".ku-exa"), bs = ex.querySelector("[data-kustep]"), ba = ex.querySelector("[data-kuall]");
    const fin = () => { ans.hidden = false; bs.remove(); ba.remove(); };
    bs.onclick = () => { const n = lis.find(l => l.hidden); if (n) n.hidden = false; if (!lis.some(l => l.hidden)) fin(); };
    ba.onclick = () => { lis.forEach(l => l.hidden = false); fin(); };
  });
  document.querySelectorAll("[data-kutoc]").forEach(a => a.onclick = ev => { ev.preventDefault(); const s = a.dataset.kutoc === "terms" ? document.querySelector(".ku-terms") : document.querySelectorAll(".ku-sec")[+a.dataset.kutoc]; if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); });
  const rd = document.getElementById("ku_read"); if (rd) rd.onchange = async () => { const m = Object.assign({}, kursRead()); const key = c.id + ":" + ROUTE.query.k; if (rd.checked) { m[key] = todayISO(); addXP(10); } else delete m[key]; await setSetting("kurs_gelesen", m); if (rd.checked) toast("✓ Kapitel gelesen – jetzt üben!"); };
  const pr = document.getElementById("ku_print"); if (pr) pr.onclick = () => window.print();
}
