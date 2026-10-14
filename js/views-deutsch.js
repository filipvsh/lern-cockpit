/* =====================================================================
   LERN-COCKPIT · DEUTSCH EXTREM-MODUS
   Kommunikationsanalyse (5 Axiome nach Watzlawick) – Route #/extrem/<Prüfung>?tab=…
   Speichern: Unterthemen + exercises (source "ai") unter dem Deutsch-Thema,
   Fortschritt als learning_events (mode in detail), Fahrplan/Texte in einstellungen.
   Nur INSERT und PATCH, nichts wird gelöscht.
   ===================================================================== */
const DX_EXAM = "0bf7d143-fdb2-45f2-9633-44e33dfb8a98";
const isExtremExam = k => !!k && (String(k.id) === DX_EXAM || (k.fach === "Deutsch" && /kommunikation|watzlawick|gespr(ä|ae)ch/i.test((k.thema || "") + " " + (k.description || ""))));
const DX_SUBS = { axiome: "Axiome", absatz: "Absatz schreiben", aufbau: "Aufbau", zitieren: "Zitieren" };
const DX_TABS = [["start", "Start"], ["karten", "Karten"], ["quiz", "Quiz"], ["aufbau", "Aufbau"], ["absatz", "Absatz"], ["zitieren", "Zitieren"], ["begriffe", "Begriffe"], ["fahrplan", "Fahrplan"]];
let DXS = { examId: null, ready: false, busy: false, err: null, subs: {}, topic: null, ex: {} };
let DXU = {}, DXU_TAB = "";   // Zustand des aktuellen Tabs (nicht gespeichert)

/* ---------- Einrichten: Thema, Unterthemen, Übungen (nur fehlende anlegen) ---------- */
function dxSeedRows() {
  const rows = [];
  const add = (key, sub, row) => rows.push({ key, sub, row: Object.assign({ difficulty: 2, source: "ai" }, row) });
  DX.KARTEN.forEach((c, i) => {
    const sub = /Einleitung|Situation|Inhaltsangabe|Analyseteil|Schluss/.test(c.f) ? "aufbau" : /Schablone|Redeanteil/.test(c.f) ? "absatz" : /zitier|vgl\.|\[/.test(c.f) ? "zitieren" : "axiome";
    add("karte:" + i, sub, { type: "free_text", difficulty: 1, question: "Karteikarte: " + c.f, solution: c.b });
  });
  DX.QUIZ.forEach((q, i) => add("quiz:" + i, "axiome", { type: "multiple_choice", question: "Welches Axiom? " + q.s, options: DX.AX_OPTIONS, correct_index: q.a - 1, solution: q.r + (q.auch ? " (Auch Axiom " + q.auch + " passt.)" : "") }));
  DX.ZITIER.forEach((z, i) => add("zitat:" + i, "zitieren", { type: "multiple_choice", difficulty: 1, question: "Zitieren: " + z.q, options: z.opts, correct_index: z.c, solution: z.r }));
  for (let r = 0; r * 5 < DX.BEGRIFFE.length; r++) add("match:" + r, "axiome", { type: "matching", difficulty: 1, question: "Fachbegriffe zuordnen – Runde " + (r + 1), options: DX.BEGRIFFE.slice(r * 5, r * 5 + 5) });
  add("aufbau", "aufbau", { type: "matching", question: "Bring die Bausteine der Gesprächsanalyse in die richtige Reihenfolge.", options: DX.AUFBAU.map(a => [a.t, a.inhalt]) });
  Object.entries(DX.SZENEN).forEach(([k, s]) => add("absatz:" + k, "absatz", { type: "short_writing", difficulty: 3, question: "Schreib einen Analyseabsatz zu " + s.titel + " nach der Schablone: " + DX.SCHABLONE.join(" · "), solution: DX.MUSTER }));
  return rows;
}
async function dxEnsure(k) {
  if (DXS.busy || (DXS.ready && DXS.examId === k.id)) return;
  DXS = { examId: k.id, ready: false, busy: true, err: null, subs: {}, topic: null, ex: {} };
  try {
    let topic = topicsOfExam(k.id)[0];
    if (!topic) topic = (await dbInsert("topics", { title: "Kommunikationsanalyse (Watzlawick)", exam_id: k.id, subject_id: subjectId(k.fach), priority: 3, status: "active" })).row;
    DXS.topic = topic;
    let n = subsOfTopic(topic.id).length;
    for (const [key, title] of Object.entries(DX_SUBS)) {
      let st = subsOfTopic(topic.id).find(s => s.title.toLowerCase() === title.toLowerCase());
      if (!st) st = (await dbInsert("subtopics", { topic_id: topic.id, title, difficulty: 2, sort: n++ })).row;
      DXS.subs[key] = st;
    }
    const missing = [];
    dxSeedRows().forEach(({ key, sub, row }) => {
      const st = DXS.subs[sub];
      const have = exercisesOf(st.id).find(e => e.question === row.question);
      if (have) DXS.ex[key] = have;
      else { const r = Object.assign({ id: Engine.uuid(), subtopic_id: st.id, created_at: new Date().toISOString() }, row); missing.push(r); DXS.ex[key] = r; }
    });
    for (let i = 0; i < missing.length; i += 50) {
      const part = missing.slice(i, i + 50);
      await Api.insert("exercises", part);
      ES.exercises.push(...part);
    }
    await Api.idle();
    DXS.ready = true; bump();
  } catch (e) { DXS.err = e.network ? "Keine Verbindung – zum ersten Einrichten brauchst du Internet." : "Einrichten fehlgeschlagen: " + e.message; }
  finally { DXS.busy = false; if (ROUTE.name === "extrem") route(); }
}

/* ---------- Lernereignisse & Auswertung ---------- */
function dxLog(key, type, result, detail) {
  const ex = DXS.ex[key]; if (!ex) return;
  const st = subById(ex.subtopic_id);
  logEvent({ type, result, exercise_id: ex.id, subtopic_id: ex.subtopic_id, topic_id: st ? st.topic_id : null, exam_id: DXS.examId, subject: "Deutsch", difficulty: ex.difficulty || 2, detail: Object.assign({ extrem: true }, detail || {}) });
}
const dxEvents = () => ES.events.filter(e => e.detail && e.detail.extrem && String(e.exam_id) === String(DXS.examId));
const dxToday = mode => dxEvents().filter(e => e.detail.mode === mode && isoLocal(new Date(e.created_at)) === todayISO()).length;
function dxBox(key) {
  const ex = DXS.ex[key]; if (!ex) return 1;
  let box = 1;
  dxEvents().filter(e => e.exercise_id === ex.id && e.detail.mode === "leitner").forEach(e => { box = e.result >= 1 ? Math.min(3, box + 1) : 1; });
  return box;
}
function dxStreak() {
  const days = new Set(dxEvents().map(e => isoLocal(new Date(e.created_at))));
  let d = todayISO(); if (!days.has(d)) d = addDays(d, -1);
  let n = 0; while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
const dxSetting = (name, def) => setting("extrem_" + name + "_" + DXS.examId, def);
const dxSetSetting = (name, v) => setSetting("extrem_" + name + "_" + DXS.examId, v);

/* ---------- Seite ---------- */
V.extrem = () => {
  const k = klById(decodeURIComponent(ROUTE.sub || DX_EXAM));
  if (!engineReady()) return pageHead("Deutsch Extrem") + setupCard();
  if (!k) return pageHead("Deutsch Extrem", { back: ["#/lernplan", "Lernplan"] }) + '<div class="card">' + emptyState("flag", "Klausur nicht gefunden", "Trag die Deutsch-Klausur im Lernplan ein.") + '</div>';
  if (!DXS.ready || DXS.examId !== k.id) {
    if (!DXS.busy && !DXS.err) setTimeout(() => dxEnsure(k), 0);
    return dxHead(k) + '<div class="card">' + (DXS.err ? emptyState("flag", "Noch nicht bereit", esc(DXS.err), '<button class="btn primary sm" id="dx_retry">Nochmal versuchen</button>') : '<div class="pdf-loading"><span class="spinner"></span> Extrem-Modus wird eingerichtet …</div>') + '</div>';
  }
  const tab = DX_TABS.some(t => t[0] === ROUTE.query.tab) ? ROUTE.query.tab : "start";
  if (DXU_TAB !== tab + ":" + k.id) { DXU = {}; DXU_TAB = tab + ":" + k.id; }   // Tabwechsel: frischer Zustand
  const nav = '<div class="seg dx-tabs">' + DX_TABS.map(([t, l]) => '<a class="' + (t === tab ? "on" : "") + '" href="#/extrem/' + esc(k.id) + '?tab=' + t + '">' + l + '</a>').join("") + '</div>';
  return dxHead(k) + nav + '<div id="dx_body">' + ({ start: dxStart, karten: dxKarten, quiz: dxQuiz, aufbau: dxAufbau, absatz: dxAbsatz, zitieren: dxZitieren, begriffe: dxBegriffe, fahrplan: dxFahrplan }[tab])(k) + '</div>';
};
function dxHead(k) {
  return '<a class="backlink" href="#/lernplan/' + esc(k.id) + '">' + ICO.back + 'Klausur</a><div class="dx-hero"><div class="eyebrow">Deutsch · ' + esc(fmtDL(k.datum)) + '</div><h1 class="t-large">Extrem-Modus</h1><p class="t-callout">Kommunikationsanalyse mit den 5 Axiomen nach Watzlawick</p></div>';
}
function bindExtrem() {
  const r = document.getElementById("dx_retry"); if (r) r.onclick = () => { DXS.err = null; route(); };
  if (!DXS.ready) return;
  const tab = DX_TABS.some(t => t[0] === ROUTE.query.tab) ? ROUTE.query.tab : "start";
  ({ start: bindDxStart, karten: bindDxKarten, quiz: bindDxQuiz, aufbau: bindDxAufbau, absatz: bindDxAbsatz, zitieren: bindDxZitieren, begriffe: bindDxBegriffe, fahrplan: bindDxFahrplan }[tab] || (() => {}))();
}
const dxGo = tab => { DXU = {}; location.hash = "#/extrem/" + DXS.examId + "?tab=" + tab; };

/* 1 · Start */
function dxCountdown(k) {
  const at = new Date(k.datum + "T" + (k.uhrzeit || "08:00") + ":00").getTime(); const ms = at - Date.now();
  if (ms <= 0) return "Heute ist Klausur – viel Erfolg!";
  const h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
  return d >= 1 ? "Noch " + plural(d, "Tag", "Tage") + " und " + plural(h % 24, "Stunde", "Stunden") : "Noch " + plural(h, "Stunde", "Stunden") + " und " + plural(Math.floor(ms / 60000) % 60, "Minute", "Minuten");
}
function dxStart(k) {
  const z = DX.TAGESZIEL; const c = dxToday("leitner"), q = dxToday("quiz"), a = dxToday("absatz");
  const goal = (lbl, n, max, tab) => '<button class="dx-goal" data-dxgo="' + tab + '"><div class="dg-h"><b>' + Math.min(n, max) + '/' + max + '</b> ' + lbl + (n >= max ? ' <span class="pill p-green">geschafft</span>' : '') + '</div>' + progBar(Math.min(100, n / max * 100), n >= max ? "g" : "") + '</button>';
  const boxes = [0, 0, 0]; DX.KARTEN.forEach((_, i) => { boxes[dxBox("karte:" + i) - 1]++; });
  const qa = dxEvents().filter(e => e.detail.mode === "quiz" && !e.detail.retry); const qr = qa.length ? Math.round(qa.filter(e => e.result >= 1).length / qa.length * 100) : null;
  const all = (Math.min(c, z.karten) / z.karten + Math.min(q, z.quiz) / z.quiz + Math.min(a, z.absatz) / z.absatz) / 3;
  const streak = dxStreak();
  return '<div class="card dx-count"><div class="t-sub">' + esc(fmtDL(k.datum)) + (k.uhrzeit ? " · " + esc(k.uhrzeit) : "") + '</div><div class="dx-big">' + esc(dxCountdown(k)) + '</div>' + (streak ? '<div class="pill p-accent" style="margin-top:var(--s2)">🔥 ' + plural(streak, "Tag", "Tage") + ' in Folge</div>' : '') + '</div>' +
    '<div class="card mt"><h2>Heute</h2><p class="t-sub" style="margin-bottom:var(--s3)">Ziel: ' + z.karten + ' Karten, ' + z.quiz + ' Quizfragen, ' + z.absatz + ' Absatz.</p>' + progBar(all * 100, all >= 1 ? "g" : "") + '<div class="dx-goals">' + goal("Karten", c, z.karten, "karten") + goal("Quizfragen", q, z.quiz, "quiz") + goal("Absatz", a, z.absatz, "absatz") + '</div></div>' +
    '<div class="card mt"><h2>Stand</h2><div class="strow"><div class="stbox"><div class="n">' + boxes[2] + '/' + DX.KARTEN.length + '</div><div class="l">Karten in Box 3</div></div><div class="stbox"><div class="n">' + (qr == null ? "—" : qr + " %") + '</div><div class="l">Quiz richtig</div></div><div class="stbox"><div class="n">' + dxEvents().filter(e => e.detail.mode === "absatz").length + '</div><div class="l">Absätze geschrieben</div></div></div>' +
    '<div class="dx-boxes">' + boxes.map((n, i) => '<span>Box ' + (i + 1) + ' <b>' + n + '</b></span>').join("") + '</div></div>' +
    '<div class="dx-grid mt">' + DX_TABS.slice(1).map(([t, l]) => '<button class="game-tile dx-tile" data-dxgo="' + t + '"><b>' + l + '</b><span class="t-sub">' + ({ karten: "Leitner, 3 Boxen", quiz: "Welches Axiom?", aufbau: "5 Bausteine ordnen", absatz: "Schablone üben", zitieren: "„…“, (Z. x), […], vgl.", begriffe: "Begriff ↔ Definition", fahrplan: "90 Minuten, abhaken" })[t] + '</span></button>').join("") + '</div>';
}
function bindDxStart() { document.querySelectorAll("[data-dxgo]").forEach(b => b.onclick = () => dxGo(b.dataset.dxgo)); }

/* 2 · Karteikarten (Leitner) */
function dxKartenQueue() {
  const keys = DX.KARTEN.map((_, i) => "karte:" + i);
  const last = key => { const ex = DXS.ex[key]; const ev = ex && dxEvents().filter(e => e.exercise_id === ex.id).pop(); return ev ? new Date(ev.created_at).getTime() : 0; };
  return keys.sort((a, b) => dxBox(a) - dxBox(b) || last(a) - last(b));
}
function dxKarten() {
  if (!DXU.q) DXU = { q: dxKartenQueue().slice(0, 20), i: 0, flip: false, known: 0 };
  const key = DXU.q[DXU.i];
  if (!key) return '<div class="card"><div class="fx-done"><div class="done-mark">' + ICO.check + '</div><h2 class="fx-title">Runde geschafft</h2><p class="lead" style="margin:var(--s3) auto 0">' + DXU.known + ' gewusst. Karten aus Box 1 kommen beim nächsten Mal zuerst.</p><button class="btn primary" id="dk_again" style="margin-top:var(--s5)">Noch eine Runde</button></div></div>';
  const c = DX.KARTEN[+key.split(":")[1]]; const box = dxBox(key);
  return '<div class="dx-meta"><span>Karte ' + (DXU.i + 1) + ' von ' + DXU.q.length + '</span><span class="pill">Box ' + box + '</span></div>' +
    '<button class="dx-card' + (DXU.flip ? " flip" : "") + '" id="dk_card"><div class="kind">' + (DXU.flip ? "Antwort" : "Frage") + '</div><div class="dx-card-t">' + esc(DXU.flip ? c.b : c.f) + '</div>' + (DXU.flip ? '' : '<div class="t-sub">Tippen zum Umdrehen</div>') + '</button>' +
    (DXU.flip ? '<div class="dx-actions"><button class="btn lg" id="dk_no">Nochmal</button><button class="btn primary lg" id="dk_yes">Wusste ich</button></div>' : '');
}
function bindDxKarten() {
  const q = id => document.getElementById(id);
  const card = q("dk_card"); if (card) card.onclick = () => { DXU.flip = !DXU.flip; route(); };
  const ag = q("dk_again"); if (ag) ag.onclick = () => { DXU = {}; route(); };
  const ans = ok => {
    const key = DXU.q[DXU.i];
    dxLog(key, ok ? "exercise_correct" : "exercise_wrong", ok ? 1 : 0, { mode: "leitner", box_before: dxBox(key) });
    if (ok) DXU.known++; else if (DXU.q.slice(DXU.i + 1).filter(x => x === key).length === 0) DXU.q.splice(Math.min(DXU.q.length, DXU.i + 4), 0, key);
    DXU.i++; DXU.flip = false; route();
  };
  const y = q("dk_yes"); if (y) y.onclick = () => ans(true);
  const n = q("dk_no"); if (n) n.onclick = () => ans(false);
}

/* 3 · Quiz „Welches Axiom?“ */
function dxQuiz() {
  if (!DXU.q) DXU = { q: Engine.shuffle(DX.QUIZ.map((_, i) => ({ i, retry: false }))), p: 0, pick: null, right: 0, done: 0 };
  const it = DXU.q[DXU.p];
  if (!it) return '<div class="card"><div class="fx-done"><div class="done-mark">' + ICO.check + '</div><h2 class="fx-title">Quiz geschafft</h2><p class="lead" style="margin:var(--s3) auto 0">' + DXU.right + ' von ' + DXU.done + ' beim ersten Versuch richtig.</p><button class="btn primary" id="dq_again" style="margin-top:var(--s5)">Neu mischen</button></div></div>';
  const qq = DX.QUIZ[it.i]; const fb = DXU.pick != null; const ok = fb && (DXU.pick === qq.a - 1 || (qq.auch && DXU.pick === qq.auch - 1));
  return '<div class="dx-meta"><span>Frage ' + (DXU.p + 1) + ' von ' + DXU.q.length + (it.retry ? " · Wiederholung" : "") + '</span><span>' + DXU.right + ' richtig</span></div>' +
    '<div class="fx-card"><div class="kind">Welches Axiom?</div><div class="task" style="font-size:18px">' + esc(qq.s) + '</div><div class="choices">' + DX.AX_OPTIONS.map((o, i) => '<button class="opt-choice' + (fb ? (i === qq.a - 1 || (qq.auch && i === qq.auch - 1) ? " right" : i === DXU.pick ? " wrongpick" : "") : "") + '" data-dq="' + i + '"' + (fb ? " disabled" : "") + '>' + esc(o) + '</button>').join("") + '</div>' +
    (fb ? feedbackBox(ok ? "ok" : "bad", ok ? "Richtig" : "Nicht ganz – Axiom " + qq.a, esc(qq.r) + (qq.auch ? " Auch Axiom " + qq.auch + " passt." : "")) : '') + '</div>' +
    (fb ? '<div class="dx-actions"><span class="grow"></span><button class="btn primary lg" id="dq_next">Weiter</button></div>' : '');
}
function bindDxQuiz() {
  const q = id => document.getElementById(id);
  const ag = q("dq_again"); if (ag) ag.onclick = () => { DXU = {}; route(); };
  document.querySelectorAll("[data-dq]").forEach(b => b.onclick = () => {
    const it = DXU.q[DXU.p]; const qq = DX.QUIZ[it.i]; DXU.pick = +b.dataset.dq;
    const ok = DXU.pick === qq.a - 1 || (qq.auch && DXU.pick === qq.auch - 1);
    dxLog("quiz:" + it.i, ok ? "exercise_correct" : "exercise_wrong", ok ? 1 : 0, { mode: "quiz", retry: it.retry, given: DX.AX_OPTIONS[DXU.pick] });
    if (!it.retry) { DXU.done++; if (ok) DXU.right++; }
    if (!ok && !it.retry) DXU.q.splice(Math.min(DXU.q.length, DXU.p + 5), 0, { i: it.i, retry: true });   // falsche kommen später nochmal
    route();
  });
  const n = q("dq_next"); if (n) n.onclick = () => { DXU.p++; DXU.pick = null; route(); };
}

/* 4 · Aufbau-Puzzle */
function dxAufbau() {
  if (!DXU.order) { let o; do { o = Engine.shuffle(DX.AUFBAU.map((_, i) => i)); } while (o.every((x, i) => x === i)); DXU = { order: o, checked: false, tries: 0 }; }
  const done = DXU.checked && DXU.order.every((x, i) => x === i);
  return '<p class="t-sub" style="margin-bottom:var(--s3)">Bring die 5 Bausteine der Gesprächsanalyse in die richtige Reihenfolge – mit den Pfeilen oder per Ziehen.</p><div class="dx-puzzle" id="dp_list">' +
    DXU.order.map((x, i) => '<div class="dx-piece' + (DXU.checked ? (x === i ? " ok" : " bad") : "") + '" draggable="true" data-dp="' + i + '"><span class="dp-n">' + (i + 1) + '</span><div class="dp-t"><b>' + esc(DX.AUFBAU[x].t) + '</b>' + (done ? '<div class="t-sub">' + esc(DX.AUFBAU[x].inhalt) + '</div>' : '') + '</div><span class="dp-arrows"><button class="iconbtn" data-up="' + i + '" aria-label="nach oben"' + (i === 0 ? " disabled" : "") + '>▲</button><button class="iconbtn" data-down="' + i + '" aria-label="nach unten"' + (i === DXU.order.length - 1 ? " disabled" : "") + '>▼</button></span></div>').join("") + '</div>' +
    (done ? feedbackBox("ok", DXU.tries === 1 ? "Perfekt – beim ersten Versuch!" : "Richtig", "Unter jedem Baustein steht jetzt, was reingehört.") + '<div class="dx-actions"><span class="grow"></span><button class="btn" id="dp_again">Nochmal mischen</button></div>'
      : (DXU.checked ? feedbackBox("bad", "Noch nicht ganz", "Rot markierte Bausteine stehen falsch.") : '') + '<div class="dx-actions"><span class="grow"></span><button class="btn primary lg" id="dp_check">Prüfen</button></div>');
}
function bindDxAufbau() {
  const move = (i, j) => { if (j < 0 || j >= DXU.order.length) return; const o = DXU.order; [o[i], o[j]] = [o[j], o[i]]; DXU.checked = false; route(); };
  document.querySelectorAll("[data-up]").forEach(b => b.onclick = () => move(+b.dataset.up, +b.dataset.up - 1));
  document.querySelectorAll("[data-down]").forEach(b => b.onclick = () => move(+b.dataset.down, +b.dataset.down + 1));
  let from = null;
  document.querySelectorAll("[data-dp]").forEach(el => {
    el.ondragstart = () => { from = +el.dataset.dp; };
    el.ondragover = e => e.preventDefault();
    el.ondrop = e => { e.preventDefault(); const to = +el.dataset.dp; if (from == null || from === to) return; const [x] = DXU.order.splice(from, 1); DXU.order.splice(to, 0, x); DXU.checked = false; route(); };
  });
  const c = document.getElementById("dp_check"); if (c) c.onclick = () => {
    DXU.checked = true; DXU.tries++;
    const ok = DXU.order.every((x, i) => x === i);
    if (ok) dxLog("aufbau", "exercise_correct", DXU.tries === 1 ? 1 : 0.5, { mode: "aufbau", tries: DXU.tries });
    route();
  };
  const a = document.getElementById("dp_again"); if (a) a.onclick = () => { DXU = {}; route(); };
}

/* 5 · Absatz-Trainer */
function dxSceneText(key) { const saved = (dxSetting("szenen", {}) || {})[key]; return saved && saved.trim() ? saved : DX.SZENEN[key].platzhalter; }
function dxChecks(t) {
  const s = String(t || "");
  return [
    ["Axiom genannt?", /axiom|watzlawick|nicht nicht kommunizieren|beziehungsaspekt|interpunktion|analog|digital|symmetrisch|komplementär/i.test(s)],
    ["Zitat in „…“?", /[„"“][^„"“”]{3,}[“”"]/.test(s)],
    ["Zeile in Klammern (Z. x)?", /\((vgl\.\s*)?Z\.\s*\d+/.test(s)],
    ["Wirkung erklärt?", /dadurch|wirkt|zeigt|verdeutlicht|deutlich|weil|sodass|so dass/i.test(s)],
    ["Präsens?", s.trim().length > 20 && !/\b(sagte|war|hatte|ging|zeigte|wurde|drückte|schaute|fragte|antwortete)\b/i.test(s)]
  ];
}
function dxAbsatz() {
  const key = DXU.scene || "netter"; const text = dxSceneText(key);
  const lines = text.split(/\n/).flatMap(l => { const w = l.split(" "); const out = []; let cur = ""; w.forEach(x => { if ((cur + " " + x).length > 70 && cur) { out.push(cur); cur = x; } else cur = cur ? cur + " " + x : x; }); out.push(cur); return out; });
  const isPlaceholder = !((dxSetting("szenen", {}) || {})[key] || "").trim();
  const draft = DXU.draft != null ? DXU.draft : lsGet("lc_dx_draft_" + key, "");
  const checks = dxChecks(draft); const manual = DXU.manual || {};
  return '<div class="seg" style="margin-bottom:var(--s4)">' + Object.entries(DX.SZENEN).map(([k2, s]) => '<button class="' + (k2 === key ? "on" : "") + '" data-scene="' + k2 + '">' + esc(s.titel.replace(/^„|“.*$/g, "").replace(/“/g, "")) + '</button>').join("") + '</div>' +
    '<div class="card"><div class="dx-scene-h"><b>' + esc(DX.SZENEN[key].titel) + '</b>' + (isPlaceholder ? '<span class="pill">Platzhalter</span>' : '') + '<button class="btn plain sm" id="da_paste">' + (isPlaceholder ? "Originaltext einfügen" : "Text ändern") + '</button></div>' +
    '<ol class="dx-lines">' + lines.map(l => '<li>' + esc(l) + '</li>').join("") + '</ol></div>' +
    '<div class="card mt"><h2>Schablone</h2><ol class="dx-schablone">' + DX.SCHABLONE.map(s => '<li>' + esc(s) + '</li>').join("") + '</ol>' +
    '<textarea id="da_text" style="min-height:170px;margin-top:var(--s3)" placeholder="Das … Axiom zeigt sich, als … Sie sagt „…“ (Z. x). Dadurch …">' + esc(draft) + '</textarea>' +
    '<div class="dx-checks" id="da_checks">' + checks.map(([l, auto], i) => '<label class="dx-check"><input type="checkbox" data-dc="' + i + '"' + (manual[i] != null ? (manual[i] ? " checked" : "") : (auto ? " checked" : "")) + '> ' + esc(l) + (auto ? ' <span class="t-cap">erkannt</span>' : '') + '</label>').join("") + '</div>' +
    '<div class="dx-actions"><button class="btn" id="da_ai">' + ICO.ki + (AI.state === "ok" ? "Lehrer-Feedback (KI)" : "Feedback von Claude") + '</button><span class="grow"></span><button class="btn primary" id="da_save">Absatz speichern</button></div>' +
    (DXU.rubric ? rubricHtml(DXU.rubric) : '') +
    '<details class="dx-muster"><summary>Musterabsatz anzeigen</summary><p>' + esc(DX.MUSTER) + '</p></details></div>';
}
function bindDxAbsatz() {
  const q = id => document.getElementById(id); const key = DXU.scene || "netter";
  document.querySelectorAll("[data-scene]").forEach(b => b.onclick = () => { DXU = { scene: b.dataset.scene }; route(); });
  const ta = q("da_text");
  const upd = () => { DXU.draft = ta.value; lsSet("lc_dx_draft_" + key, ta.value); const cs = dxChecks(ta.value); document.querySelectorAll("[data-dc]").forEach((cb, i) => { if ((DXU.manual || {})[i] == null) cb.checked = cs[i][1]; }); };
  ta.oninput = debounce(upd, 250);
  document.querySelectorAll("[data-dc]").forEach(cb => cb.onchange = () => { DXU.manual = DXU.manual || {}; DXU.manual[+cb.dataset.dc] = cb.checked; });
  q("da_paste").onclick = () => openModal("Text einfügen", '<p class="hint">Füge den Text aus deinem Schulordner ein – Zeilenumbrüche bleiben als Zeilen erhalten. Gespeichert wird er nur bei dir.</p><textarea id="dp_txt" style="min-height:240px">' + esc((dxSetting("szenen", {}) || {})[key] || "") + '</textarea>', '<button class="btn" id="dp_c">Abbrechen</button><button class="btn primary" id="dp_s">Übernehmen</button>', () => {
    q("dp_c").onclick = closeModal;
    q("dp_s").onclick = async () => { const all = Object.assign({}, dxSetting("szenen", {}) || {}); all[key] = q("dp_txt").value; await dxSetSetting("szenen", all); closeModal(); route(); toast("Text gespeichert"); };
  });
  q("da_save").onclick = () => {
    const text = ta.value.trim(); if (text.length < 40) { toast("Schreib erst einen ganzen Absatz (mindestens 2 Sätze).", true); return; }
    const boxes = [...document.querySelectorAll("[data-dc]")]; const n = boxes.filter(b => b.checked).length;
    dxLog("absatz:" + key, "self_assessment", n / boxes.length, { mode: "absatz", text: text.slice(0, 2000), checks: boxes.map(b => b.checked) });
    toast(n === boxes.length ? "Gespeichert – alle 5 Punkte drin!" : "Gespeichert – " + n + " von 5 Punkten erfüllt"); DXU.draft = ""; lsSet("lc_dx_draft_" + key, ""); route();
  };
  q("da_ai").onclick = async () => {
    const text = ta.value.trim(); if (text.length < 40) { toast("Schreib erst einen Absatz.", true); return; }
    const scene = dxSceneText(key);
    if (AI.state === "ok") {   // KI-Funktion eingerichtet und erreichbar → Feedback direkt hier
      const btn = q("da_ai"); btn.classList.add("loading");
      try { DXU.rubric = await AI.correct({ item: { exercise: { type: "short_writing", question: "Analyseabsatz (Watzlawick-Axiom, Zitat mit Zeile, Wirkung, Präsens) zu folgender Szene:\n" + scene, solution: DX.MUSTER } }, answer: text }); route(); return; }
      catch (e) { btn.classList.remove("loading"); toast(AI.errorText(e) + " Öffne Claude über den Knopf.", true); return; }
    }
    openInClaude("Du bist meine Deutschlehrerin (Gymnasium NRW, EF). Gib mir kurzes Feedback (max. 6 Stichpunkte) zu meinem Analyseabsatz einer Kommunikationsanalyse nach Watzlawick.\nPrüfe: 1) Axiom richtig benannt und erklärt? 2) Zitat in „…“ mit Zeilenangabe (Z. x)? 3) Wirkung erklärt? 4) Präsens? 5) Sprache.\nZeig am Ende eine verbesserte Version.\n\nSZENE:\n" + scene + "\n\nMEIN ABSATZ:\n" + text);
  };
}

/* 6 · Zitier-Trainer */
function dxZitieren() {
  if (DXU.i == null) DXU = { i: 0, pick: null, right: 0, order: DX.ZITIER.map(z => Engine.shuffle(z.opts.map((_, j) => j))) };
  const z = DX.ZITIER[DXU.i];
  if (!z) return '<div class="card"><div class="fx-done"><div class="done-mark">' + ICO.check + '</div><h2 class="fx-title">' + DXU.right + ' von ' + DX.ZITIER.length + ' richtig</h2><button class="btn primary" id="dz_again" style="margin-top:var(--s5)">Nochmal</button></div></div>';
  const fb = DXU.pick != null; const ok = fb && DXU.pick === z.c;
  const gap = fb ? '<span class="dx-gap ' + (ok ? "ok" : "bad") + '">' + esc(z.opts[DXU.pick]) + '</span>' : '<span class="dx-gap">?</span>';
  return '<div class="dx-meta"><span>Aufgabe ' + (DXU.i + 1) + ' von ' + DX.ZITIER.length + '</span></div><div class="fx-card"><div class="kind">Setz das Richtige in die Lücke</div><div class="task" style="font-size:18px">' + esc(z.q).replace("___", gap) + '</div>' +
    '<div class="dx-chips">' + DXU.order[DXU.i].map(j => '<button class="pickchip' + (fb && j === z.c ? " on" : "") + '" data-dz="' + j + '"' + (fb ? " disabled" : "") + '>' + esc(z.opts[j]) + '</button>').join("") + '</div>' +
    (fb ? feedbackBox(ok ? "ok" : "bad", ok ? "Richtig" : "Richtig wäre: " + z.opts[z.c], esc(z.r)) : '') + '</div>' +
    (fb ? '<div class="dx-actions"><span class="grow"></span><button class="btn primary lg" id="dz_next">Weiter</button></div>' : '');
}
function bindDxZitieren() {
  const q = id => document.getElementById(id);
  const ag = q("dz_again"); if (ag) ag.onclick = () => { DXU = {}; route(); };
  document.querySelectorAll("[data-dz]").forEach(b => b.onclick = () => { const z = DX.ZITIER[DXU.i]; DXU.pick = +b.dataset.dz; const ok = DXU.pick === z.c; if (ok) DXU.right++; dxLog("zitat:" + DXU.i, ok ? "exercise_correct" : "exercise_wrong", ok ? 1 : 0, { mode: "zitieren", given: z.opts[DXU.pick] }); route(); });
  const n = q("dz_next"); if (n) n.onclick = () => { DXU.i++; DXU.pick = null; route(); };
}

/* 7 · Fachbegriffe-Matching (wie der Übungstyp „matching“) */
function dxBegriffe() {
  const rounds = Math.ceil(DX.BEGRIFFE.length / 5);
  if (DXU.r == null) DXU = { r: 0, map: {}, sel: null, checked: false };
  const pairs = DX.BEGRIFFE.slice(DXU.r * 5, DXU.r * 5 + 5);
  if (!DXU.right) DXU.right = Engine.shuffle(pairs.map((_, i) => i));
  const used = new Set(Object.values(DXU.map)); const fb = DXU.checked;
  const left = pairs.map((p, i) => { const m = DXU.map[i]; const cls = fb ? (m === i ? " right" : " wrongpick") : DXU.sel === i ? " on" : m != null ? " paired" : ""; return '<button class="opt-choice' + cls + '" data-ml="' + i + '"' + (fb ? " disabled" : "") + '>' + esc(p[0]) + (m != null ? '<span class="pairto">→ ' + esc(pairs[m][1]) + '</span>' : '') + '</button>'; }).join("");
  const right = DXU.right.map(j => '<button class="opt-choice' + (used.has(j) ? " paired" : "") + '" data-mr="' + j + '"' + (fb ? " disabled" : "") + '>' + esc(pairs[j][1]) + '</button>').join("");
  const n = pairs.filter((_, i) => DXU.map[i] === i).length;
  return '<div class="dx-meta"><span>Runde ' + (DXU.r + 1) + ' von ' + rounds + '</span></div><div class="fx-card dx-match"><div class="kind">Zuordnen</div><div class="task" style="font-size:16px">Tippe links einen Begriff und dann rechts die passende Erklärung.</div><div class="match"><div>' + left + '</div><div>' + right + '</div></div>' +
    (fb ? feedbackBox(n === pairs.length ? "ok" : "bad", n + " von " + pairs.length + " richtig", n === pairs.length ? "" : "Falsche Paare sind rot markiert.") : '') + '</div>' +
    '<div class="dx-actions">' + (fb ? '<span class="grow"></span>' + (DXU.r + 1 < rounds ? '<button class="btn primary lg" id="dm_next">Nächste Runde</button>' : '<button class="btn primary lg" id="dm_restart">Von vorn</button>') : '<button class="btn plain" id="dm_reset">Zurücksetzen</button><span class="grow"></span><button class="btn primary lg" id="dm_check"' + (Object.keys(DXU.map).length < pairs.length ? " disabled" : "") + '>Prüfen</button>') + '</div>';
}
function bindDxBegriffe() {
  const q = id => document.getElementById(id);
  document.querySelectorAll("[data-ml]").forEach(b => b.onclick = () => { DXU.sel = +b.dataset.ml; route(); });
  document.querySelectorAll("[data-mr]").forEach(b => b.onclick = () => { if (DXU.sel == null) return; const j = +b.dataset.mr; Object.keys(DXU.map).forEach(k => { if (DXU.map[k] === j) delete DXU.map[k]; }); DXU.map[DXU.sel] = j; DXU.sel = null; route(); });
  const r = q("dm_reset"); if (r) r.onclick = () => { DXU.map = {}; DXU.sel = null; route(); };
  const c = q("dm_check"); if (c) c.onclick = () => { DXU.checked = true; const pairs = DX.BEGRIFFE.slice(DXU.r * 5, DXU.r * 5 + 5); const n = pairs.filter((_, i) => DXU.map[i] === i).length; dxLog("match:" + DXU.r, n === pairs.length ? "exercise_correct" : "exercise_wrong", n / pairs.length, { mode: "begriffe", right: n, total: pairs.length }); route(); };
  const nx = q("dm_next"); if (nx) nx.onclick = () => { DXU = { r: DXU.r + 1, map: {}, sel: null, checked: false }; route(); };
  const rs = q("dm_restart"); if (rs) rs.onclick = () => { DXU = {}; route(); };
}

/* 8 · Klausur-Fahrplan */
function dxFahrplan() {
  const done = dxSetting("fahrplan", []) || [];
  let t = 0;
  return '<div class="card"><h2>90 Minuten – so teilst du sie ein</h2><p class="t-sub" style="margin-bottom:var(--s3)">Hak in der Probe ab, was du geschafft hast. Bleibt gespeichert.</p>' +
    DX.FAHRPLAN.map((s, i) => { const from = t; t += s.min; return '<label class="dx-step' + (done.includes(i) ? " done" : "") + '"><input type="checkbox" data-df="' + i + '"' + (done.includes(i) ? " checked" : "") + '><span class="dx-time">' + from + '–' + t + '′</span><span class="dx-st"><b>' + esc(s.t) + '</b><span class="t-sub">' + esc(s.h) + '</span></span><span class="dx-min">' + s.min + ' Min.</span></label>'; }).join("") +
    '<div class="dx-actions"><span class="t-sub">' + done.length + ' von ' + DX.FAHRPLAN.length + ' abgehakt</span><span class="grow"></span><button class="btn plain sm" id="df_reset">Alle Haken entfernen</button></div></div>';
}
function bindDxFahrplan() {
  document.querySelectorAll("[data-df]").forEach(cb => cb.onchange = async () => {
    const done = new Set(dxSetting("fahrplan", []) || []); const i = +cb.dataset.df;
    if (cb.checked) done.add(i); else done.delete(i);
    await dxSetSetting("fahrplan", [...done].sort((a, b) => a - b)); route();
  });
  const r = document.getElementById("df_reset"); if (r) r.onclick = async () => { await dxSetSetting("fahrplan", []); route(); };
}

/* ---------- Einstieg auf Klausurkarte / Klausurseite ---------- */
function extremEntry(k) {
  return '<a class="dx-entry" href="#/extrem/' + esc(k.id) + '"><span class="dx-entry-i">⚡</span><span><b>Extrem-Modus</b><span class="t-sub">Axiome, Quiz, Absatz, Zitieren – alles für die Klausur</span></span><span class="chev">' + ICO.chev + '</span></a>';
}
