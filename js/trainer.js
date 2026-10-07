/* =====================================================================
   LERN-COCKPIT · TRAINER
   Eine zentrale Trainings-Session (TS). Jede Änderung wird sofort in
   localStorage gespeichert und an Supabase gemeldet (training_sessions),
   damit Reloads, Re-Renders und Tab-Wechsel nichts verlieren.
   Modi: vocab · errors · mixed · topic · exam · free
   ===================================================================== */
const LS_TS = "lc_ts_v3";
let TS = lsGet(LS_TS, null);
let UI = (TS && TS.ui) || {};
const MODE_NAMES = { vocab: "Vokabeln", errors: "Fehlertraining", mixed: "Gemischtes Training", topic: "Üben", exam: "Prüfungsmodus", free: "Freie Lernzeit" };
const modeName = t => { t = t || TS; return !t ? "" : t.mockOwn ? "Probeklausur" : t.test === "probe" ? "Probetest" : t.test ? "Vokabeltest" : MODE_NAMES[t.mode]; };
const testDir = examId => lsGet("lc_vtdir_" + examId, "reverse");   // Vokabeltest: standardmäßig Deutsch → Fremdsprache
const AUTO_PAUSE_MIN = 10;   // länger im Hintergrund → Pause ab dem Verlassen (nicht im Prüfungsmodus)

const tsActive = () => !!(TS && (TS.status === "active" || TS.status === "paused"));
function tsSave() { if (TS) { TS.ui = UI; TS.savedAt = Date.now(); lsSet(LS_TS, TS); } else { try { localStorage.removeItem(LS_TS); } catch (e) {} } }
function tsRow() {
  const sum = Engine.summary(TS, Date.now());
  return { status: TS.status, paused_at: TS.status === "paused" && TS.paused_at ? new Date(TS.paused_at).toISOString() : null,
    completed_at: TS.completed_at ? new Date(TS.completed_at).toISOString() : null, active_seconds: sum.activeSeconds,
    current_index: TS.index, question_count: sum.total, correct_count: sum.correct, wrong_count: sum.wrong, score: sum.score,
    state: tsActive() ? Object.assign({}, TS, { ui: null }) : null,   // vollständig → auf einem anderen Gerät fortsetzbar
    updated_at: new Date().toISOString() };
}
function tsSync() {
  if (!TS) return;
  const local = ES.sessions.find(s => s.id === TS.id); const row = tsRow();
  if (local) Object.assign(local, row);
  dbPatch("training_sessions", TS.id, row).catch(e => console.warn("Session-Sync", e));
}
let lastSync = 0;
function tsSyncThrottled() { if (Date.now() - lastSync > 8000) { lastSync = Date.now(); tsSync(); } }
/**
 * Abgleich mit dem Stand in der Datenbank (anderes Gerät):
 *   • dieselbe Session, dort neuer → übernehmen
 *   • lokal läuft eine Session, die woanders beendet wurde → lokal schließen
 *   • lokal nichts aktiv, woanders läuft eine → übernehmen
 * Gibt true zurück, wenn sich etwas geändert hat.
 */
function reconcileSession(remote) {
  const usable = r => r && r.state && r.state.id === r.id && Array.isArray(r.state.items);
  if (tsActive()) {
    const mine = ES.sessions.find(s => s.id === TS.id);
    if (mine && (mine.status === "completed" || mine.status === "abandoned")) { TS = null; UI = {}; tsSave(); return true; }
    if (remote && remote.id === TS.id && usable(remote) && (remote.state.savedAt || 0) > (TS.savedAt || 0)) { TS = remote.state; UI = {}; tsSave(); return true; }
    return false;
  }
  if (usable(remote) && (remote.status === "active" || remote.status === "paused") && (!TS || TS.id !== remote.id)) {
    TS = remote.state; TS.status = remote.status; UI = {}; tsSave();
    toast("Training vom anderen Gerät übernommen – du kannst hier weitermachen");
    return true;
  }
  return false;
}

/* ---------------- Session anlegen ---------------- */
const dirLabel = (col, dir) => { if (isTermCollection(col)) return dir === "reverse" ? "Erklärung → Begriff" : "Begriff → Erklärung"; const s = col ? langName(col.source_language) : "Fremdsprache", t = col ? langName(col.target_language) : "Deutsch"; return dir === "reverse" ? t + " → " + s : s + " → " + t; };
function vocabItem(c, dir) { return { kind: "vocab", key: "v:" + c.id, vocab_id: c.id, direction: dir }; }
function topicItemsFor(st, max) { return Engine.buildTopicItems(st, topicById(st.topic_id), ES.exercises, lastExerciseResult, max); }
/** cfg: {mode, collection_id, subtopic_id, exam_id, topic_id, direction, count, minutes, ref, label} */
function buildSessionFromConfig(cfg) {
  const now = Date.now(); const dir = cfg.direction || "forward"; const count = +cfg.count || 20; let testKind = null, sessDir = null, round = null, extraRound = false;
  let items = [], label = "", scope = {}, timeLimitS = null, feedback = true, hints = true;
  const col = cfg.collection_id ? colById(cfg.collection_id) : null;
  const st = cfg.subtopic_id ? subById(cfg.subtopic_id) : null;
  const exam = cfg.exam_id != null && cfg.exam_id !== "" ? klById(cfg.exam_id) : (st ? examOfSub(st) : null);
  const focus = focusCollections();
  const pool = col ? cardsOf(col.id) : focus ? STATE.vo.filter(v => focus.includes(v.collection_id)) : STATE.vo;
  if (cfg.mode === "vocab") {
    let q = Engine.buildVocabQueue(pool, { now, limit: Math.min(count, Engine.ROUND.maxCards), mode: "review", newLimit: Math.min(Engine.ROUND.maxNew, newLeftToday()) });
    if (!q.length || cfg.extra) {
      // Freiwillige Zusatzrunde: die Wörter, die du am ehesten vergisst
      q = pool.filter(v => !Engine.isNew(v)).map(v => [v, Engine.recallProbability(v, now)]).sort((a, b) => a[1] - b[1]).slice(0, 10).map(x => x[0]);
      label = " · Zusatzrunde"; extraRound = true;
    }
    round = Engine.buildRound(q, { direction: dir }); items = round.items;
    label = (col ? col.name : "Vokabeln") + label; scope = { collection_id: col ? col.id : null, subject: col ? langName(col.source_language) : null };
  } else if (cfg.mode === "errors") {
    const cards = Engine.buildVocabQueue(pool, { mode: "errors", limit: count });
    const exItems = troubleExercises().filter(e => !st || e.subtopic_id === st.id).slice(0, 8).map(e => { const s = subById(e.subtopic_id); return Engine.exerciseItem(e, s, s && topicById(s.topic_id)); });
    round = Engine.buildRound(cards, { direction: dir });
    items = round.items.concat(exItems);
    label = "Fehlertraining" + (col ? " · " + col.name : ""); scope = { collection_id: col ? col.id : null };
  } else if (cfg.mode === "topic" && st) {
    items = topicItemsFor(st, +cfg.count || 6);
    const t = topicById(st.topic_id); label = st.title;
    scope = { subtopic_id: st.id, topic_id: t && t.id, exam_id: exam ? exam.id : null, subject: exam ? exam.fach : null };
  } else if (cfg.mode === "mixed") {
    const subs = st ? [st] : exam ? subsOfExam(exam.id) : priorities().slice(0, 3).map(p => p.subtopic);
    const exItems = subs.flatMap(s => topicItemsFor(s, 3).filter(i => !i.template || i.exercise.type === "short_writing").slice(0, 2));
    const cardPool = exam ? STATE.vo.filter(v => linkedCollections(exam).some(c => c.id === v.collection_id)) : pool;
    const cards = Engine.buildVocabQueue(cardPool.length ? cardPool : pool, { now, limit: 11, mode: "review", allowAhead: true });
    items = Engine.buildMixedItems({ cards, pool: cardPool.length ? cardPool : pool, direction: dir, exerciseItems: exItems });
    label = "Gemischt" + (exam ? " · " + exam.fach : col ? " · " + col.name : "");
    scope = { exam_id: exam ? exam.id : null, collection_id: col ? col.id : null, subtopic_id: st ? st.id : null, subject: exam ? exam.fach : null };
  } else if (cfg.mode === "exam") {
    const t = cfg.topic_id ? topicById(cfg.topic_id) : null;
    const ex = exam || (t && t.exam_id != null ? klById(t.exam_id) : null);
    const subs = t ? subsOfTopic(t.id) : ex ? subsOfExam(ex.id) : [];
    const prio = priorities().filter(p => subs.some(s => s.id === p.subtopic.id));
    items = Engine.buildExamItems({ priorities: prio, subtopics: subs, itemsFor: s => topicItemsFor(s, 4), count: +cfg.count || 6 });
    if (ex) { const cards = STATE.vo.filter(v => linkedCollections(ex).some(c => c.id === v.collection_id)); const m = Engine.makeMatching(Engine.shuffle(cards).slice(0, 5), dir); if (m) items.push(m); }
    timeLimitS = (+cfg.minutes || 45) * 60; feedback = false; hints = false;
    label = (ex ? ex.fach + " · " : "") + (t ? t.title : ex ? klTitle(ex) : "Prüfung");
    scope = { exam_id: ex ? ex.id : null, topic_id: t ? t.id : null, subject: ex ? ex.fach : null };
  } else if (cfg.mode === "test" || cfg.mode === "testexam") {
    const k = klById(cfg.exam_id); const cards = k ? testCards(k) : [];
    const tdir = cfg.direction || (k ? testDir(k.id) : "reverse");
    if (cfg.mode === "test") {
      let q = k ? Engine.testQueue(cards, { now, daysLeft: daysUntil(k.datum), testDay: testDayMs(k) }) : [];
      // Höchstens ROUND.maxNew neue Wörter pro Runde – der Rest kommt in der nächsten Runde
      let nNew = 0; q = q.filter(c => !Engine.isNew(c) || nNew++ < Engine.ROUND.maxNew).slice(0, Engine.ROUND.maxCards);
      if (!q.length) { q = cards.filter(c => !Engine.isNew(c)).map(v => [v, Engine.recallProbability(v, testDayMs(k))]).sort((a, b) => a[1] - b[1]).slice(0, 10).map(x => x[0]); label = " · Zusatzrunde"; extraRound = true; }
      round = Engine.buildRound(q, { direction: tdir }); items = round.items;
    } else {
      items = Engine.shuffle(cards).slice(0, 80).map(c => vocabItem(c, tdir));
      timeLimitS = (+cfg.minutes || 15) * 60; feedback = false; hints = false;
    }
    label = (k ? vtName(k) : "Vokabeltest") + label;
    const col = k ? linkedCollections(k)[0] : null;
    scope = { exam_id: k ? k.id : null, collection_id: col ? col.id : null, subject: k ? k.fach : null };
    testKind = cfg.mode === "test" ? "learn" : "probe"; sessDir = tdir;
  } else if (cfg.mode === "mock") {
    // Probeklausur mit echter Aufgabe (Buch, alte Klausur, von Claude erstellt): Zeitlimit, Abgabe, dann Auswertung
    const k = klById(cfg.exam_id);
    items = [{ kind: "mock_own", key: "mock", task: cfg.task || "", answer: "" }];
    timeLimitS = (+cfg.minutes || 90) * 60; feedback = false; hints = false;
    label = k ? k.fach + "-Klausur am " + fmtD(k.datum) : "Probeklausur"; scope = { exam_id: k ? k.id : null, subject: k ? k.fach : null };
  } else if (cfg.mode === "free") {
    label = cfg.label || "Freie Lernzeit"; scope = { exam_id: cfg.exam_id || null, subject: cfg.subject || null };
  }
  const mode = cfg.mode === "test" ? "vocab" : cfg.mode === "testexam" || cfg.mode === "mock" ? "exam" : cfg.mode;
  const s = Engine.createSession({ mode, items, label, direction: sessDir || dir, timeLimitS, feedback, hints, scope, now });
  if (testKind) s.test = testKind;
  if (round) {
    s.round = true; s.prog = round.prog; s.extra = extraRound;
    s.cfg = Object.assign({}, cfg, { force: undefined, extra: undefined });
    s.stageBefore = {}; Object.keys(round.prog).forEach(id => { const c = cardById(id); if (c) s.stageBefore[id] = Engine.stageOf(c).n; });
  }
  s.masteryBefore = {}; items.forEach(i => { if (i.subtopic_id) s.masteryBefore[i.subtopic_id] = masteryOf(i.subtopic_id).score; });
  if (cfg.mode === "mock") { s.mockOwn = true; if (scope.exam_id != null) subsOfExam(scope.exam_id).forEach(st => { s.masteryBefore[st.id] = masteryOf(st.id).score; }); }
  s.planKey = cfg.planKey || null;
  return s;
}
function startTraining(cfg) {
  if (tsActive() && !cfg.force) { askReplaceSession(cfg); return; }
  const s = buildSessionFromConfig(cfg);
  if (s.mode !== "free" && !s.items.length) { toast(emptyReason(cfg), true); return; }
  TS = s; UI = {}; tsSave();
  const row = { id: s.id, mode: s.mode, status: "active", label: s.label, subject: s.scope.subject || null, subject_id: s.scope.subject ? subjectId(s.scope.subject) : null,
    exam_id: s.scope.exam_id ?? null, topic_id: s.scope.topic_id || null, subtopic_id: s.scope.subtopic_id || null, collection_id: s.scope.collection_id || null,
    direction: s.direction, started_at: new Date(s.started_at).toISOString(), time_limit_s: s.time_limit_s, question_count: s.items.length, active_seconds: 0 };
  dbInsert("training_sessions", row).catch(e => console.warn(e));
  if (s.scope.subtopic_id) setLast({ kind: "subtopic", sub: s.scope.subtopic_id });
  else if (s.scope.collection_id) setLast({ kind: "collection", col: s.scope.collection_id });
  closeModal();
  location.hash = "#/trainer/session";
  if (ROUTE.name === "trainer" && ROUTE.sub === "session") route();
}
function emptyReason(cfg) {
  if (cfg.mode === "vocab") return "Keine Vokabeln in dieser Auswahl.";
  if (cfg.mode === "test" || cfg.mode === "testexam") return "Für diesen Test sind noch keine Vokabeln eingetragen.";
  if (cfg.mode === "errors") return "Keine Fehler zum Wiederholen – sehr gut.";
  if (cfg.mode === "exam") return "Für den Prüfungsmodus braucht die Prüfung mindestens ein Unterthema.";
  return "Für diese Auswahl gibt es noch keine Aufgaben.";
}
function askReplaceSession(cfg) {
  openModal("Training läuft noch", '<p class="hint">„' + esc(TS.label) + '“ ist noch nicht beendet. Bisherige Antworten sind gespeichert.</p>',
    '<button class="btn" id="rp_go">Fortsetzen</button><button class="btn primary" id="rp_new">Beenden und neu starten</button>', () => {
      document.getElementById("rp_go").onclick = () => { closeModal(); location.hash = "#/trainer/session"; };
      document.getElementById("rp_new").onclick = async () => { await tsFinish("abandoned", true); startTraining(Object.assign({}, cfg, { force: true })); };
    });
}

/* ---------------- Steuerung ---------------- */
function tsPause() { if (!TS) return; if (TS.status === "active") Engine.pause(TS, Date.now()); else if (TS.status === "paused") Engine.resume(TS, Date.now()); tsSave(); tsSync(); renderSessionStage(); }
async function tsFinish(status, silent) {
  if (!TS) return;
  const now = Date.now();
  if (status === "completed" && TS.mode === "exam" && !TS.evaluated) {
    if (TS.mockOwn && !TS.answers.length) Engine.recordAnswer(TS, { result: null, verdict: "mock", pending: true, given: TS.items[0].answer }, now);
    Engine.finish(TS, now, "completed"); TS.evalPending = true; tsSave(); tsSync(); renderSessionStage(); return;
  }
  Engine.finish(TS, now, status);
  const subs = Object.keys(TS.masteryBefore || {}); syncMasteryCache(subs);
  tsSave(); tsSync();
  if (!silent) renderSessionStage();
}
function confirmEnd() {
  if (!TS) return;
  if (TS.status === "completed" || TS.status === "abandoned") { leaveTrainer(); return; }
  const sum = Engine.summary(TS, Date.now());
  const inMission = TS.planKey && todayPlan().items.some(i => i.key === TS.planKey && !i.done);
  const rp = TS.round ? Engine.roundProgress(TS) : null;
  openModal(inMission ? "Wirklich aufhören?" : "Training beenden?", '<p class="hint">' + (rp && rp.left ? "Noch " + rp.left + "× richtig, dann ist die Runde geschafft. " : "") + (sum.answered ? sum.answered + " von " + sum.total + " Aufgaben bearbeitet. Deine Antworten sind gespeichert." : "Noch keine Aufgabe bearbeitet.") + (inMission ? "<br><b>Dieser Schritt gehört zu deinem Auftrag für heute.</b> Wenn du jetzt aufhörst, bleibt er offen." : "") + '</p>',
    '<button class="btn" id="ce_no">Weiterlernen</button><button class="btn primary" id="ce_yes">' + (TS.mode === "exam" ? "Abgeben" : "Beenden") + '</button>', () => {
      document.getElementById("ce_no").onclick = closeModal;
      document.getElementById("ce_yes").onclick = async () => { closeModal(); await tsFinish(TS.mode === "exam" || TS.mode === "free" || TS.index >= TS.items.length ? "completed" : "abandoned"); };
    });
}
function leaveTrainer() { const back = TS && TS.scope && TS.scope.exam_id != null ? "#/lernplan/" + TS.scope.exam_id : TS && TS.scope.collection_id ? "#/vokabeln/" + TS.scope.collection_id : "#/trainer"; TS = null; UI = {}; tsSave(); location.hash = back; }
// Hintergrund: im Prüfungsmodus läuft die Zeit weiter; sonst nach 10 Minuten Pause ab dem Verlassen
document.addEventListener("visibilitychange", () => {
  if (!TS || TS.status !== "active") return;
  if (document.visibilityState === "hidden") { TS.hiddenAt = Date.now(); tsSave(); tsSync(); }
  else if (TS.hiddenAt) {
    if (TS.mode !== "exam" && Date.now() - TS.hiddenAt > AUTO_PAUSE_MIN * 60000) { Engine.pause(TS, TS.hiddenAt); toast("Training war pausiert, während du weg warst"); tsSync(); }
    TS.hiddenAt = null; tsSave(); renderSessionStage();
  }
});

/* ---------------- Antworten auswerten ---------------- */
function evBase(item) {
  const st = item.subtopic_id ? subById(item.subtopic_id) : null; const ex = st ? examOfSub(st) : null;
  return { session_id: TS.id, subtopic_id: item.subtopic_id || null, topic_id: item.topic_id || (st && st.topic_id) || null, exam_id: ex ? ex.id : (TS.scope.exam_id ?? null), subject: ex ? ex.fach : (TS.scope.subject || null) };
}
/** Vokabel: SRS + Lernereignis (nur erster Versuch je Karte und Session) */
const SRS_FIELDS = ["reps", "ease", "interval_days", "lapses", "next_review_at", "last_reviewed_at", "last_result", "correct_count", "incorrect_count", "mastery", "difficulty", "level", "next"];
/** SRS-Planung; gehört die Karte zu einem anstehenden Vokabeltest, kommt sie spätestens am Vortag wieder */
function srsFor(card, verdict, retry) {
  const k = testForCollection(card.collection_id);
  // Durchgänge über den Tag: vor dem Test kommt das Wort nach einigen Stunden noch einmal (Engine.passPlan)
  let sameDayMin = 0;
  if (k && verdict !== "wrong") { const pp = Engine.passPlan(daysUntil(k.datum)); if (pp.gapMin && passesToday(card.id) + (retry ? 0 : 1) < pp.perDay) sameDayMin = pp.gapMin; }
  return Engine.srsSchedule(card, verdict, Date.now(), { retry: !!retry, cap: k ? new Date(k.datum + "T00:00:00").getTime() - Engine.DAY : null, sameDayMin });
}
/** Wie oft wurde diese Vokabel heute schon in einer Runde abgefragt? (ein Lernereignis je Runde; die laufende Runde ist erst nach dem ersten Abruf dabei) */
function passesToday(cardId) { const t = todayISO(); return ES.events.filter(e => String(e.vocab_id) === String(cardId) && isoLocal(new Date(e.created_at)) === t).length; }
function applyVocabResult(card, verdict, given, item) {
  const prev = {}; SRS_FIELDS.forEach(k => prev[k] = card[k]);
  const fresh = Engine.isNew(card);
  const patch = srsFor(card, verdict, item.retry);
  dbPatch("vokabeln", card.id, Object.assign({}, patch, { level: Math.min(5, patch.reps), next: patch.next_review_at.slice(0, 10) }));
  if (item.retry) return { prev, eventId: null };   // Wiederholung in der Runde: Gedächtnis ja, Statistik nein
  const col = colById(card.collection_id);
  const ev = logEvent({ type: verdict === "wrong" ? "vocabulary_wrong" : "vocabulary_correct", result: verdict === "correct" ? 1 : verdict === "almost" ? 0.75 : 0, vocab_id: card.id, session_id: TS.id,
    subject: col ? langName(col.source_language) : null, difficulty: patch.difficulty,
    detail: { given: String(given || "").slice(0, 200), expected: Engine.vocabSides(card, item.direction).answer, direction: item.direction, verdict, format: item.kind, fresh } });
  logAdd("vokabel", 1, 0, card.sprache || (col && col.name) || "");   // Tageszähler/Streak (Kompatibilität)
  return { prev, eventId: ev.id };
}
function applyExerciseResult(item, result, type, detail) {
  if (TS.mode === "exam") return;   // Prüfungsmodus: Ereignisse erst bei der Auswertung (exam_result)
  const ex = item.exercise;
  logEvent(Object.assign(evBase(item), { type, result, exercise_id: ex.id || null, difficulty: ex.difficulty || 2,
    detail: Object.assign({ question: String(ex.question).slice(0, 300), template: !!item.template, hints: UI.hints || 0 }, detail || {}) }));
}
function record(result, extra) {
  Engine.recordAnswer(TS, Object.assign({ result, hints: UI.hints || 0 }, extra || {}), Date.now());
  tsSave(); tsSyncThrottled();
}
function nextItem() {
  Engine.advance(TS); UI = {}; tsSave();
  if (TS.index >= TS.items.length) tsFinish("completed"); else renderSessionStage();
}

/* ---------------- Darstellung ---------------- */
function tsClock() { if (!TS) return ""; const now = Date.now(); const ms = TS.time_limit_s ? Engine.remainingMs(TS, now) : Engine.elapsedMs(TS, now); return fmtClock(ms); }
function sessionShell() {
  const back = TS.scope.exam_id != null ? "#/lernplan/" + TS.scope.exam_id : "#/trainer";
  return '<div class="fx"><div class="fx-bar"><div class="left"><a class="closebtn" href="' + back + '" aria-label="Trainer verlassen" title="Verlassen – das Training bleibt gespeichert">' + ICO.x + '</a><span class="ctx">' + esc(modeName()) + ' · ' + esc(TS.label) + '</span></div><div class="timerwrap"><span class="timer' + (TS.time_limit_s ? " countdown" : "") + '" data-tsstate><i></i><span data-tstime>' + tsClock() + '</span></span></div><div class="right"><button class="btn plain sm" id="ts_pause">Pause</button><button class="btn plain sm" id="ts_end">' + (TS.mode === "exam" ? "Abgeben" : "Beenden") + '</button></div></div><div class="fx-stage" id="fxStage"></div><div class="fx-actions"><div class="in" id="fxAct"></div></div></div>';
}
V.trainerSession = () => {
  if (!TS) return '<div class="fx"><div class="fx-stage">' + emptyState("trainer", "Kein Training aktiv", "Starte ein Training über den Trainer oder deinen Tagesplan.", '<a class="btn primary" href="#/trainer">Zum Trainer</a>') + '</div></div>';
  return sessionShell();
};
function bindTrainerSession() {
  document.body.classList.add("focus");
  if (!TS) return;
  if (Engine.isExpired(TS, Date.now())) tsFinish("completed", true);
  document.getElementById("ts_pause").onclick = tsPause;
  document.getElementById("ts_end").onclick = confirmEnd;
  renderSessionStage();
  document.onkeydown = e => {
    if (e.key !== "Enter" || e.shiftKey || !TS) return;
    if (document.activeElement && document.activeElement.tagName === "TEXTAREA") { if (!(e.metaKey || e.ctrlKey)) return; }
    const b = document.querySelector("#fxAct .btn.primary:not([disabled])"); if (b) { e.preventDefault(); b.click(); }
  };
}
function setStage(stage, actions) { const st = document.getElementById("fxStage"), ac = document.getElementById("fxAct"); if (!st) return false; st.innerHTML = stage; ac.innerHTML = actions; return true; }
function stageHead(item) {
  const total = TS.items.length; const n = Math.min(TS.index + 1, total);
  let ctx = modeName();
  if (item.subtopic_id) { const st = subById(item.subtopic_id), t = st && topicById(st.topic_id), ex = st && examOfSub(st); ctx = (ex ? ex.fach + " · " : "") + (t ? t.title : ""); }
  else if (item.vocab_id || item.vocab_ids) { const c = cardById(item.vocab_id || item.vocab_ids[0]); const col = c && colById(c.collection_id); ctx = (col ? col.name + " · " : "") + dirLabel(col, item.direction); }
  const title = item.subtopic_id ? (subById(item.subtopic_id) || {}).title || "" : "";
  let prog = '<div class="fx-progress">' + progBar(TS.index / total * 100) + '<span>' + n + ' von ' + total + (item.retry ? ' · Wiederholung' : '') + '</span></div>';
  if (TS.round && (item.kind === "vocab" || item.kind === "vocab_study")) {
    // Runde: Fortschritt = richtige Antworten aus dem Kopf bis zum Ziel → klares Ende
    const rp = Engine.roundProgress(TS);
    prog = '<div class="fx-progress" title="Neue Wörter brauchen 3 richtige Antworten, Wiederholungen eine">' + progBar(rp.need ? rp.got / rp.need * 100 : 0) + '<span>' + (rp.left ? "noch " + rp.left + "× richtig" : "geschafft") + ' · ' + rp.doneWords + ' von ' + rp.words + ' Wörtern</span></div>';
  }
  return '<div class="fx-ctx">' + esc(ctx) + '</div>' + (title ? '<h1 class="fx-title">' + esc(title) + '</h1>' : '') + prog;
}
function renderSessionStage() {
  if (!document.getElementById("fxStage") || !TS) return;
  sessTick();
  const pb = document.getElementById("ts_pause"); if (pb) { pb.textContent = TS.status === "paused" ? "Fortsetzen" : "Pause"; pb.style.display = (TS.status === "completed" || TS.status === "abandoned") ? "none" : ""; }
  if (TS.status === "paused") { setStage('<div class="fx-done"><div class="eyebrow">' + esc(TS.label) + '</div><h2 class="fx-title" style="margin-top:var(--s3)">Pausiert</h2><p class="lead" style="margin:var(--s3) auto 0">Die Zeit steht. Deine Antworten sind gespeichert.</p></div>', '<span class="grow"></span><button class="btn primary lg" id="ts_resume">Fortsetzen</button>'); document.getElementById("ts_resume").onclick = tsPause; return; }
  if (TS.evalPending) return TS.mockOwn ? renderMockEval() : renderEvaluation();
  if (TS.status === "completed" || TS.status === "abandoned") return renderSummary();
  if (TS.mode === "free") return renderFree();
  const item = Engine.current(TS); if (!item) { tsFinish("completed"); return; }
  if (item.kind === "vocab" || item.kind === "vocab_study") return renderVocab(item);
  if (item.kind === "mock_own") return renderMockOwn(item);
  if (item.kind === "vocab_mc") return renderChoice(item, item.prompt, item.options, item.correct_index, "Welche Übersetzung stimmt?");
  if (item.kind === "vocab_match") return renderMatch(item, item.pairs);
  const ex = item.exercise;
  if (ex.type === "multiple_choice") return renderChoice(item, ex.question, ex.options || [], ex.correct_index, "Multiple Choice");
  if (ex.type === "matching") return renderMatch(item, ex.options || []);
  return renderOpen(item);
}
const feedbackBox = (kind, title, text) => '<div class="fb ' + kind + '"><div class="fb-t">' + (kind === "ok" ? ICO.check : kind === "almost" ? ICO.check : ICO.x) + '<b>' + esc(title) + '</b></div>' + (text ? '<div class="fb-x">' + text + '</div>' : '') + '</div>';

/* Vokabel – neues Wort: ansehen und einmal abschreiben (danach Abruf aus dem Kopf) */
const diffHtml = (given, expected) => Engine.diffParts(given, expected).map(p => p.ok ? esc(p.text) : '<mark class="dif">' + esc(p.text) + '</mark>').join("");
function copyField(answers, label) { return '<input id="vc" class="answer-input copy" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + esc(label) + '" value="' + esc(UI.copy || "") + '">'; }
function bindCopy(answers, lang, onOk) {
  const inp = document.getElementById("vc"); if (!inp) return;
  const test = () => { UI.copy = inp.value; const ok = Engine.checkAnswer(inp.value, answers, lang).verdict === "correct"; inp.classList.toggle("ok", ok); onOk(ok); };
  inp.oninput = test; test(); setTimeout(() => inp.focus(), 30);
}
function cardExtras(card) {
  return (card.example_sentence ? '<div class="t-sub" style="margin-top:var(--s3)">' + esc(card.example_sentence) + '</div>' : '') +
    (card.notes ? '<div class="hint-it" style="margin-top:var(--s3)"><div class="kind">Merkhilfe</div>' + esc(card.notes) + '</div>' : '');
}
function renderStudy(item) {
  const card = cardById(item.vocab_id); if (!card) { nextItem(); return; }
  const s = Engine.vocabSides(card, item.direction);
  setStage(stageHead(item) + '<div class="fx-card"><div class="kind">Neues Wort · einprägen</div><div class="term" style="text-align:center">' + esc(s.prompt) + '</div><div class="study-ans">' + esc(s.answer) + '</div>' + cardExtras(card) + copyField(s.answers, "Einmal abschreiben") + '<div class="t-sub" style="margin-top:var(--s3)">Gleich fragt dich die App danach – dann ohne Vorlage.</div></div>',
    '<button class="btn plain" id="st_known">Kenne ich schon</button><span class="grow"></span><button class="btn primary lg" id="st_next" disabled>Weiter</button>');
  const go = () => { Engine.roundAfter(TS, item, "studied"); nextItem(); };
  bindCopy(s.answers, s.lang, ok => { document.getElementById("st_next").disabled = !ok; });
  document.getElementById("st_next").onclick = go;
  document.getElementById("st_known").onclick = go;
}
/* Vokabel – Abruf aus dem Kopf (Freitext) */
function renderVocab(item) {
  if (item.kind === "vocab_study") return renderStudy(item);
  const card = cardById(item.vocab_id); if (!card) { nextItem(); return; }
  const s = Engine.vocabSides(card, item.direction);
  const fb = UI.phase === "feedback";
  const mustCopy = fb && TS.feedback && TS.round && UI.check.verdict === "wrong";
  let fbHtml = "";
  if (fb && TS.feedback) {
    const v = UI.check.verdict;
    fbHtml = v === "correct" ? feedbackBox("ok", "Richtig", UI.check.note ? esc(UI.check.note) : (s.answers.length > 1 ? "Auch richtig: " + esc(s.answers.filter(a => a !== Engine.normalize(UI.given)).slice(0, 3).join(" · ")) : ""))
      : v === "almost" ? feedbackBox("almost", "Fast richtig", esc(UI.check.note) + (UI.check.expected ? '<br><span class="t-sub">' + diffHtml(UI.given, s.answer) + '</span>' : ""))
      : feedbackBox("bad", "Nicht ganz", 'Richtig: <b class="dif-ans">' + (UI.given ? diffHtml(UI.given, s.answer) : esc(s.answer)) + '</b>' + (UI.check.note ? "<br>" + esc(UI.check.note) : "") + cardExtras(card) +
          (mustCopy ? copyField(s.answers, "Tipp die richtige Lösung einmal ab") + '<div class="t-sub" style="margin-top:6px">Das Wort kommt nach ein paar anderen noch einmal – dann aus dem Kopf.</div>' : "") +
          ((+card.lapses || 0) >= 3 ? '<div class="t-sub" style="margin-top:8px">Hartnäckiges Wort. Eine Eselsbrücke hilft: <button class="linkbtn" id="va_note">Merkhilfe notieren</button></div>' : ""));
  }
  setStage(stageHead(item) + '<div class="fx-card"><div class="kind">' + (item.retry ? "Noch einmal aus dem Kopf" : "Übersetze") + '</div><div class="term" style="text-align:center">' + esc(s.prompt) + '</div><input id="va" class="answer-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Deine Antwort" value="' + esc(UI.given || "") + '"' + (fb ? " readonly" : "") + '>' + fbHtml + '</div>',
    fb ? (UI.check.verdict === "wrong" && TS.feedback ? '<button class="btn" id="va_override" title="Wenn deine Antwort auch richtig ist">Ich hatte recht</button>' : '') + '<span class="grow"></span><button class="btn primary lg" id="va_next"' + (mustCopy ? " disabled" : "") + '>Weiter</button>'
       : '<button class="btn plain" id="va_skip">Weiß ich nicht</button><span class="grow"></span><button class="btn primary lg" id="va_check">Antwort prüfen</button>');
  const inp = document.getElementById("va");
  if (!fb) {
    setTimeout(() => inp.focus(), 30);
    inp.oninput = () => { UI.given = inp.value; };
    const check = given => {
      UI.given = given; UI.check = Engine.checkAnswer(given, s.answers, s.lang); UI.phase = "feedback";
      const v = UI.check.verdict;
      UI.undo = applyVocabResult(card, v, given, item);
      record(v === "correct" ? 1 : v === "almost" ? 0.75 : 0, { verdict: v, given });
      if (TS.feedback) { if (TS.round) Engine.roundAfter(TS, item, v === "wrong" ? "wrong" : "correct"); else if (v === "wrong") Engine.requeue(TS, 4); }
      tsSave();
      if (!TS.feedback) nextItem(); else renderVocab(item);
    };
    document.getElementById("va_check").onclick = () => check(inp.value);
    document.getElementById("va_skip").onclick = () => check("");
  } else {
    document.getElementById("va_next").onclick = nextItem;
    if (mustCopy) bindCopy(s.answers, s.lang, ok => { document.getElementById("va_next").disabled = !ok; });
    const nb = document.getElementById("va_note"); if (nb) nb.onclick = () => vocabModal(card);
    const ov = document.getElementById("va_override");
    if (ov) ov.onclick = () => {
      // Korrektur durch den Nutzer: zählt als richtig. Zustand vor der Antwort wird wiederhergestellt,
      // dann normal als „richtig“ geplant; das Fehler-Ereignis wird korrigiert, die Antwort als Alternative gespeichert.
      const last = TS.answers[TS.answers.length - 1]; if (last) { last.result = 1; last.verdict = "override"; }
      const req = TS.items.findIndex((x, i) => i > TS.index && x.retry && x.key === item.key); if (req > 0) TS.items.splice(req, 1);
      if (TS.round && TS.prog[item.vocab_id]) { TS.prog[item.vocab_id].wrong = Math.max(0, TS.prog[item.vocab_id].wrong - 1); Engine.roundAfter(TS, item, "correct"); }
      const alt = String(UI.given || "").trim();
      if (UI.undo) {
        const patch = srsFor(Object.assign({}, card, UI.undo.prev), "correct", item.retry);
        const alts = item.direction !== "reverse" && alt && !card.alternatives.includes(alt) ? card.alternatives.concat([alt]) : card.alternatives;
        dbPatch("vokabeln", card.id, Object.assign({}, patch, { level: Math.min(5, patch.reps), next: patch.next_review_at.slice(0, 10), alternatives: alts }));
        if (UI.undo.eventId) dbPatch("learning_events", UI.undo.eventId, { type: "vocabulary_correct", result: 1, detail: { given: alt, override: true, direction: item.direction } });
      }
      tsSave(); toast("Als richtig gewertet" + (item.direction !== "reverse" && UI.given ? " · Antwort als Alternative gespeichert" : "")); nextItem();
    };
  }
}
/* Auswahl (Vokabel-MC und Übungen) */
function renderChoice(item, prompt, options, correct, kindLabel) {
  const fb = UI.phase === "feedback";
  const opts = options.map((o, i) => { let cls = ""; if (fb && TS.feedback) cls = i === correct ? " right" : i === UI.pick ? " wrongpick" : ""; else if (UI.pick === i) cls = " on"; return '<button class="opt-choice' + cls + '" data-pick="' + i + '"' + (fb ? " disabled" : "") + '>' + esc(o) + '</button>'; }).join("");
  setStage(stageHead(item) + '<div class="fx-card"><div class="kind">' + esc(kindLabel) + '</div><div class="task">' + esc(prompt) + '</div><div class="choices">' + opts + '</div>' + hintArea(item) + '</div>',
    fb ? '<span class="grow"></span><button class="btn primary lg" id="ch_next">Weiter</button>' : hintButton(item) + '<span class="grow"></span><button class="btn primary lg" id="ch_check"' + (UI.pick == null ? " disabled" : "") + '>Antwort prüfen</button>');
  if (fb) { document.getElementById("ch_next").onclick = nextItem; return; }
  bindHint(item);
  document.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { UI.pick = +b.dataset.pick; tsSave(); renderChoice(item, prompt, options, correct, kindLabel); });
  document.getElementById("ch_check").onclick = () => {
    const ok = UI.pick === correct; const res = Engine.withHints(ok ? 1 : 0, UI.hints);
    if (item.kind === "vocab_mc") { const card = cardById(item.vocab_id); if (card) applyVocabResult(card, ok ? "correct" : "wrong", options[UI.pick], item); }
    else applyExerciseResult(item, res, ok ? "exercise_correct" : "exercise_wrong", { given: options[UI.pick], expected: options[correct], mistake: ok ? null : String(item.exercise.question).slice(0, 80) });
    record(res, { verdict: ok ? "correct" : "wrong", given: UI.pick });
    UI.phase = "feedback"; tsSave();
    if (!TS.feedback) nextItem(); else renderChoice(item, prompt, options, correct, kindLabel);
  };
}
/* Zuordnung */
function renderMatch(item, pairs) {
  const order = item.order || pairs.map((_, i) => i);
  UI.map = UI.map || {}; const fb = UI.phase === "feedback";
  const used = new Set(Object.values(UI.map));
  const left = pairs.map((p, i) => { const m = UI.map[i]; const cls = fb && TS.feedback ? (m === i ? " right" : " wrongpick") : UI.sel === i ? " on" : m != null ? " paired" : ""; return '<button class="opt-choice' + cls + '" data-ml="' + i + '"' + (fb ? " disabled" : "") + '>' + esc(p[0]) + (m != null ? '<span class="pairto">→ ' + esc(pairs[m][1]) + '</span>' : '') + '</button>'; }).join("");
  const right = order.map(j => '<button class="opt-choice' + (used.has(j) ? " paired" : "") + '" data-mr="' + j + '"' + (fb ? " disabled" : "") + '>' + esc(pairs[j][1]) + '</button>').join("");
  setStage(stageHead(item) + '<div class="fx-card"><div class="kind">Zuordnen</div><div class="task" style="font-size:18px">Wähle links ein Element und dann rechts das passende.</div><div class="match"><div>' + left + '</div><div>' + right + '</div></div>' + (fb && TS.feedback ? feedbackBox(UI.res === 1 ? "ok" : "bad", Math.round(UI.res * pairs.length) + " von " + pairs.length + " richtig", "") : "") + '</div>',
    fb ? '<span class="grow"></span><button class="btn primary lg" id="m_next">Weiter</button>' : '<button class="btn plain" id="m_reset">Zurücksetzen</button><span class="grow"></span><button class="btn primary lg" id="m_check"' + (Object.keys(UI.map).length < pairs.length ? " disabled" : "") + '>Antwort prüfen</button>');
  if (fb) { document.getElementById("m_next").onclick = nextItem; return; }
  document.querySelectorAll("[data-ml]").forEach(b => b.onclick = () => { UI.sel = +b.dataset.ml; renderMatch(item, pairs); });
  document.querySelectorAll("[data-mr]").forEach(b => b.onclick = () => { if (UI.sel == null) return; const j = +b.dataset.mr; Object.keys(UI.map).forEach(k => { if (UI.map[k] === j) delete UI.map[k]; }); UI.map[UI.sel] = j; UI.sel = null; tsSave(); renderMatch(item, pairs); });
  document.getElementById("m_reset").onclick = () => { UI.map = {}; UI.sel = null; renderMatch(item, pairs); };
  document.getElementById("m_check").onclick = () => {
    const ans = pairs.map((_, i) => UI.map[i]); const right = ans.filter((x, i) => x === i).length; const res = right / pairs.length;
    UI.res = res; UI.phase = "feedback";
    if (item.kind === "vocab_match") item.vocab_ids.forEach((id, i) => { const c = cardById(id); if (c) applyVocabResult(c, ans[i] === i ? "correct" : "wrong", pairs[ans[i]] ? pairs[ans[i]][1] : "", Object.assign({}, item, { kind: "vocab_match" })); });
    else applyExerciseResult(item, Engine.withHints(res, UI.hints), res === 1 ? "exercise_correct" : "exercise_wrong", { right, total: pairs.length });
    record(Engine.withHints(res, UI.hints), { verdict: res === 1 ? "correct" : "wrong", given: ans });
    tsSave(); if (!TS.feedback) nextItem(); else renderMatch(item, pairs);
  };
}
/* Offene Aufgaben: Freitext, Schreiben, Übersetzung */
const RATE = [[1, "Sicher"], [0.5, "Teilweise"], [0, "Unsicher"]];
const TYPE_NAMES = { free_text: "Freitext", short_writing: "Kurze Schreibaufgabe", translation: "Übersetzung", multiple_choice: "Multiple Choice", matching: "Zuordnung" };
function renderOpen(item) {
  const ex = item.exercise; const phase = UI.phase || "answer";
  let below = "";
  if (phase === "ai") below = '<div class="fb neutral"><div class="fb-t"><span class="spinner"></span><b>Die KI prüft deine Antwort …</b></div></div>';
  if (phase === "rubric") below = rubricHtml(UI.rubric);
  if (phase === "self") below = '<div class="fx-check">' + (ex.expected_answer || ex.solution ? '<div class="solution"><div class="kind">Musterlösung</div>' + esc(ex.expected_answer || ex.solution).replace(/\n/g, "<br>") + '</div>' : '') + '<div class="t-sub">' + (UI.aiError ? esc(UI.aiError) + " " : "") + 'Wie gut war deine Antwort? Deine Einschätzung fließt (mit geringerem Gewicht) in den Lernstand.</div><div class="choice">' + RATE.map(r => '<button data-rate="' + r[0] + '" class="' + (UI.rate === r[0] ? "on" : "") + '">' + r[1] + '</button>').join("") + '</div></div>';
  if (phase === "auto") below = UI.auto.verdict === "correct" || UI.auto.verdict === "almost" ? feedbackBox(UI.auto.verdict === "correct" ? "ok" : "almost", UI.auto.verdict === "correct" ? "Richtig" : "Fast richtig", esc(UI.auto.note || "")) : "";
  const done = phase === "rubric" || (phase === "self" && UI.rate != null) || phase === "auto" || phase === "recorded";
  setStage(stageHead(item) + '<div class="fx-card"><div class="kind">' + esc(TYPE_NAMES[ex.type] || "Aufgabe") + (item.template ? " · Übungsvorlage" : ex.source === "ai" ? " · von der KI erstellt" : "") + '</div><div class="task">' + esc(ex.question).replace(/\n/g, "<br>") + '</div><textarea id="oa" placeholder="Deine Antwort …"' + (phase !== "answer" ? " readonly" : "") + '>' + esc(UI.given || "") + '</textarea>' + hintArea(item) + below + '</div>',
    done ? '<span class="grow"></span><button class="btn primary lg" id="oa_next">Weiter</button>'
      : phase === "self" ? '<span class="grow"></span><button class="btn primary lg" disabled>Weiter</button>'
      : phase === "ai" ? '<span class="grow"></span><button class="btn primary lg loading">Prüfen</button>'
      : hintButton(item) + '<span class="grow"></span><span class="kb">⌘ ↵</span><button class="btn primary lg" id="oa_check">' + (TS.feedback ? "Antwort prüfen" : "Weiter") + '</button>');
  const ta = document.getElementById("oa");
  if (phase === "answer") {
    setTimeout(() => { if (window.innerWidth > 720) ta.focus(); }, 30);
    ta.oninput = () => { UI.given = ta.value; tsSaveDebounced(); };
    bindHint(item);
    document.getElementById("oa_check").onclick = () => checkOpen(item);
  }
  document.querySelectorAll("[data-rate]").forEach(b => b.onclick = () => {
    UI.rate = +b.dataset.rate; const res = Engine.withHints(UI.rate, UI.hints);
    applyExerciseResult(item, res, "self_assessment", { given: String(UI.given || "").slice(0, 500), self: UI.rate });
    record(res, { verdict: "self", given: UI.given }); tsSave(); renderOpen(item);
  });
  const nx = document.getElementById("oa_next"); if (nx) nx.onclick = nextItem;
}
const tsSaveDebounced = debounce(tsSave, 400);
async function checkOpen(item) {
  const ex = item.exercise; const given = UI.given || "";
  if (!given.trim()) { toast("Schreib zuerst eine Antwort.", true); return; }
  if (!TS.feedback) { record(null, { verdict: "open", given, pending: true }); UI = {}; nextItem(); return; }   // Prüfungsmodus: Auswertung am Ende
  const auto = Engine.checkExercise(ex, given);
  if (auto.result != null) { UI.auto = auto; UI.phase = "auto"; applyExerciseResult(item, Engine.withHints(auto.result, UI.hints), auto.result >= 0.5 ? "exercise_correct" : "exercise_wrong", { given, expected: auto.expected }); record(Engine.withHints(auto.result, UI.hints), { verdict: auto.verdict, given }); tsSave(); renderOpen(item); return; }
  if (AI.state !== "unavailable") {
    UI.phase = "ai"; tsSave(); renderOpen(item);
    try {
      const r = await AI.correct({ item, answer: given });
      UI.rubric = r; UI.phase = "rubric";
      const res = Engine.withHints(r.overall / 100, UI.hints);
      applyExerciseResult(item, res, "ai_feedback", { given: given.slice(0, 1500), rubric: r.criteria, mistakes: r.mistakes, overall: r.overall });
      record(res, { verdict: "ai", given });
      tsSave(); renderOpen(item); return;
    } catch (e) { UI.aiError = AI.errorText(e) + " Deine Antwort ist gespeichert."; }
  }
  UI.phase = "self"; tsSave(); renderOpen(item);
}
function rubricHtml(r) {
  if (!r) return "";
  return '<div class="rubric"><div class="rubric-h"><b>Rückmeldung der KI</b><span class="t-sub">Lernhilfe, keine Note</span></div>' +
    r.criteria.map(c => '<div class="meter" style="padding:8px 0"><span class="mt-l">' + esc(c.name) + (c.comment ? '<span class="mt-s">' + esc(c.comment) + '</span>' : '') + '</span><span class="mt-v">' + c.score + ' %</span>' + progBar(c.score, c.score < 60 ? "o" : "") + '</div>').join("") +
    (r.strengths.length ? '<div class="rb-sec"><b>Was war gut?</b><ul>' + r.strengths.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></div>' : '') +
    (r.missing.length ? '<div class="rb-sec"><b>Was fehlt?</b><ul>' + r.missing.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></div>' : '') +
    (r.next_steps.length ? '<div class="rb-sec"><b>Beim nächsten Versuch</b><ul>' + r.next_steps.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></div>' : '') + '</div>';
}
/* Hinweise in Stufen – nur außerhalb des Prüfungsmodus */
const HINT_LABELS = ["Kleiner Hinweis", "Konkreter Hinweis", "Lösungsweg", "Vollständige Erklärung"];
function hintButton(item) { if (!TS.hints || !item.exercise) return ""; const n = UI.hints || 0; if (n >= 4) return ""; return '<button class="btn plain" id="hint_btn">' + ICO.bulb + HINT_LABELS[n] + '</button>'; }
function hintArea(item) { if (!UI.hintTexts || !UI.hintTexts.length) return ""; return '<div class="hints">' + UI.hintTexts.map((h, i) => '<div class="hint-it"><div class="kind">' + HINT_LABELS[i] + '</div>' + esc(h).replace(/\n/g, "<br>") + '</div>').join("") + (UI.hintLoading ? '<div class="hint-it"><span class="spinner"></span> Hinweis wird erstellt …</div>' : '') + '</div>'; }
function bindHint(item) {
  const b = document.getElementById("hint_btn"); if (!b) return;
  b.onclick = async () => {
    const level = (UI.hints || 0) + 1;
    UI.hintTexts = UI.hintTexts || []; UI.hintLoading = true; renderSessionStage();
    try {
      const h = await AI.hint({ item, level, answer: UI.given || "" });
      UI.hintTexts.push(h); UI.hints = level;
    } catch (e) {
      const ex = item.exercise;
      if (level >= 3 && (ex.solution || ex.expected_answer)) { UI.hintTexts.push(ex.solution || ex.expected_answer); UI.hints = 4; }
      else toast(AI.errorText(e) + (ex.solution ? " Die Musterlösung kannst du als vollständige Erklärung ansehen." : ""), true);
      if (level < 3 && ex.solution) UI.hints = 2;   // nächster Klick zeigt die Musterlösung
    }
    UI.hintLoading = false; tsSave(); renderSessionStage();
  };
}

/* Freie Lernzeit */
function renderFree() {
  const kl = upcomingKL();
  setStage('<div style="text-align:center"><div class="fx-ctx">' + esc(TS.label) + '</div><div class="fx-big-time" data-tstime>' + tsClock() + '</div><p class="lead" style="margin:0 auto var(--s7)">Handy weg, ein Thema, Timer an. Alle 25 Minuten erinnert dich das Cockpit an eine kurze Pause.</p><label class="fld" style="max-width:360px;margin:0 auto;text-align:left">Wofür lernst du?<select id="fk_ref"><option value="">Allgemein</option>' + kl.map(k => '<option value="' + esc(k.id) + '"' + (String(TS.scope.exam_id) === String(k.id) ? " selected" : "") + '>' + esc(k.fach) + ' · ' + esc(klTitle(k)) + '</option>').join("") + '</select></label></div>',
    '<span class="grow"></span><button class="btn primary lg" id="fk_done">Fertig</button>');
  document.getElementById("fk_ref").onchange = e => { const k = klById(e.target.value); TS.scope.exam_id = k ? k.id : null; TS.scope.subject = k ? k.fach : null; TS.label = k ? "Lernzeit · " + k.fach : "Freie Lernzeit"; tsSave(); const l = ES.sessions.find(s => s.id === TS.id); if (l) Object.assign(l, { exam_id: TS.scope.exam_id, subject: TS.scope.subject, label: TS.label }); dbPatch("training_sessions", TS.id, { exam_id: TS.scope.exam_id, subject: TS.scope.subject, label: TS.label }); };
  document.getElementById("fk_done").onclick = () => tsFinish("completed");
}

/* Probeklausur mit eigener Aufgabe */
function renderMockOwn(item) {
  const k = klById(TS.scope.exam_id);
  setStage('<div class="fx-ctx">' + esc(TS.label) + '</div><h1 class="fx-title">Schreib jetzt – wie in der Klausur</h1><p class="lead">Keine Hilfen, kein Handy. Du kannst hier tippen oder auf Papier schreiben. Die Zeit oben läuft.</p>' +
    '<div class="fx-card"><div class="kind">Aufgabe</div>' + (item.task ? '<div class="task" style="white-space:pre-wrap;font-size:16px">' + esc(item.task) + '</div>' : '<div class="t-sub">Die Aufgabe liegt vor dir (Buch, alte Klausur oder Claude). ' + (k ? '<button class="linkbtn" id="mo_claude">Aufgabe bei Claude erstellen</button>' : '') + '</div>') +
    '<textarea id="mo_ans" style="min-height:300px;margin-top:var(--s4)" placeholder="Deine Lösung … (oder auf Papier)">' + esc(item.answer || "") + '</textarea></div>',
    '<span class="grow"></span><button class="btn primary lg" id="mo_done">Abgeben</button>');
  const ta = document.getElementById("mo_ans");
  ta.oninput = () => { item.answer = ta.value; tsSaveDebounced(); };
  const c = document.getElementById("mo_claude"); if (c) c.onclick = () => openInClaude(mockPrompt(k, Math.round(TS.time_limit_s / 60)));
  document.getElementById("mo_done").onclick = () => {
    openModal("Probeklausur abgeben?", '<p class="hint">Danach bewertest du deine Lösung – Thema für Thema.</p>', '<button class="btn" id="md_no">Weiterschreiben</button><button class="btn primary" id="md_yes">Abgeben</button>', () => {
      document.getElementById("md_no").onclick = closeModal;
      document.getElementById("md_yes").onclick = () => { closeModal(); tsFinish("completed"); };
    });
  };
}
const MOCK_RATE = [[1, "Gut"], [0.5, "Teils"], [0, "Schlecht"]];
/** Auswertung: jedes Thema ehrlich einschätzen (zählt wie eine Prüfungssimulation im Lernstand) */
function renderMockEval() {
  const k = klById(TS.scope.exam_id); const item = TS.items[0]; const subs = k ? subsOfExam(k.id) : [];
  TS.mockRatings = TS.mockRatings || {};
  const all = subs.every(s => TS.mockRatings[s.id] != null);
  setStage('<div class="fx-ctx">' + esc(TS.label) + '</div><h1 class="fx-title">Auswertung</h1><p class="lead">Vergleiche mit dem Erwartungshorizont (Buch, Lehrkraft) oder lass Claude korrigieren. Dann schätz jedes Thema ehrlich ein – daraus plant die App die nächsten Tage.</p>' +
    '<div class="card tight" style="margin-top:var(--s5)"><h2>Korrektur durch Claude</h2><p class="t-sub">Kopiert Aufgabe und Lösung und öffnet claude.ai. Claude vergibt Punkte, nennt die wichtigsten Fehler und was du noch üben solltest.</p><button class="btn" id="me_claude" style="margin-top:var(--s3)">' + ICO.ki + 'Mit Claude korrigieren</button>' +
    '<label class="fld" style="margin-top:var(--s4)">Punkte (0–15, optional)<input id="me_pts" type="number" min="0" max="15" value="' + (TS.mockPoints != null ? TS.mockPoints : "") + '" style="max-width:120px"></label></div>' +
    '<div class="card tight" style="margin-top:var(--s4)"><h2>Wie lief es pro Thema?</h2>' + (subs.length ? subs.map(s => '<div class="mrate"><span>' + esc(s.title) + '</span><div class="choice">' + MOCK_RATE.map(r => '<button data-mr="' + esc(s.id) + ':' + r[0] + '" class="' + (TS.mockRatings[s.id] === r[0] ? "on" : "") + '">' + r[1] + '</button>').join("") + '</div></div>').join("") : '<p class="t-sub">Für diese Klausur sind noch keine Themen eingetragen.</p>') + '</div>',
    '<span class="grow"></span><button class="btn primary lg" id="me_done"' + (all ? "" : " disabled") + '>' + (all ? "Auswertung speichern" : "Erst alle Themen bewerten") + '</button>');
  document.getElementById("me_claude").onclick = () => openInClaude(correctionPrompt(k, item.task, item.answer));
  document.getElementById("me_pts").oninput = e => { const v = e.target.value; TS.mockPoints = v === "" ? null : Math.max(0, Math.min(15, +v)); tsSave(); };
  document.querySelectorAll("[data-mr]").forEach(b => b.onclick = () => { const [id, v] = b.dataset.mr.split(":"); TS.mockRatings[id] = +v; tsSave(); renderMockEval(); });
  document.getElementById("me_done").onclick = () => {
    const vals = subs.map(s => TS.mockRatings[s.id]);
    subs.forEach(s => logEvent({ type: "exam_result", result: TS.mockRatings[s.id], exam_id: k.id, topic_id: s.topic_id, subtopic_id: s.id, subject: k.fach, session_id: TS.id, difficulty: 2, detail: { mode: "mock", points: TS.mockPoints, question: "Probeklausur" } }));
    const a = TS.answers[0] || (Engine.recordAnswer(TS, { result: null, verdict: "mock", given: item.answer }, Date.now()), TS.answers[0]);
    a.result = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null; a.pending = false;
    TS.evalPending = false; TS.evaluated = true; tsSave(); tsFinish("completed");
  };
}

/* Prüfungsmodus: Auswertung offener Antworten */
function renderEvaluation() {
  const open = TS.answers.map((a, idx) => ({ a, idx, item: TS.items[a.index] })).filter(x => x.a.pending);
  if (!open.length) { finalizeExam(); return; }
  const rows = open.map(x => '<div class="card tight" style="margin-bottom:var(--s3)"><div class="kind" style="font-size:12px;color:var(--text-3);font-weight:600">' + esc((subById(x.item.subtopic_id) || {}).title || "") + '</div><div class="t-headline" style="margin:4px 0 8px">' + esc(x.item.exercise.question) + '</div><div class="t-callout" style="white-space:pre-wrap;color:var(--text)">' + esc(x.a.given) + '</div>' + (x.a.rubric ? rubricHtml(x.a.rubric) : (x.item.exercise.solution || x.item.exercise.expected_answer ? '<div class="solution"><div class="kind">Musterlösung</div>' + esc(x.item.exercise.solution || x.item.exercise.expected_answer) + '</div>' : '') + '<div class="choice" style="margin-top:var(--s3)">' + RATE.map(r => '<button data-er="' + x.idx + ':' + r[0] + '" class="' + (x.a.self === r[0] ? "on" : "") + '">' + r[1] + '</button>').join("") + '</div>') + '</div>').join("");
  const allRated = open.every(x => x.a.rubric || x.a.self != null);
  setStage('<div class="fx-ctx">' + esc(TS.label) + '</div><h1 class="fx-title">Auswertung</h1><p class="lead">Die Zeit ist vorbei. ' + plural(open.length, "offene Antwort braucht", "offene Antworten brauchen") + ' noch eine Bewertung.' + (AI.state !== "unavailable" ? " Die KI kann sie prüfen – oder du schätzt dich selbst ein." : " Vergleiche mit der Musterlösung und schätze dich ein.") + '</p><div style="margin-top:var(--s6)">' + rows + '</div>',
    (AI.state !== "unavailable" && !allRated ? '<button class="btn" id="ev_ai">' + ICO.ki + 'Mit KI auswerten</button>' : '') + '<span class="grow"></span><button class="btn primary lg" id="ev_done"' + (allRated ? "" : " disabled") + '>Ergebnis anzeigen</button>');
  document.querySelectorAll("[data-er]").forEach(b => b.onclick = () => { const [i, v] = b.dataset.er.split(":"); TS.answers[+i].self = +v; tsSave(); renderEvaluation(); });
  const ai = document.getElementById("ev_ai");
  if (ai) ai.onclick = async () => {
    ai.classList.add("loading");
    for (const x of open) {
      if (x.a.rubric) continue;
      try { x.a.rubric = await AI.correct({ item: x.item, answer: x.a.given, examMode: true }); tsSave(); renderEvaluation(); }
      catch (e) { toast(AI.errorText(e) + " Bitte schätze die restlichen Antworten selbst ein.", true); break; }
    }
    renderEvaluation();
  };
  document.getElementById("ev_done").onclick = finalizeExam;
}
function finalizeExam() {
  // Ergebnisse als Lernereignisse speichern (Prüfungssimulation zählt im Lernstand ×1,5)
  TS.answers.forEach(a => {
    const item = TS.items[a.index]; if (!item || a.retry) return;
    if (a.pending) { a.result = a.rubric ? a.rubric.overall / 100 : a.self; a.pending = false; }
    if (item.kind === "exercise" && a.result != null) logEvent(Object.assign(evBase(item), { type: "exam_result", result: a.result, exercise_id: item.exercise.id || null, difficulty: item.exercise.difficulty || 2, detail: { question: String(item.exercise.question).slice(0, 300), mistakes: a.rubric ? a.rubric.mistakes : [], mode: "exam" } }));
  });
  TS.evalPending = false; TS.evaluated = true; tsSave(); tsFinish("completed");
}

/* Abschluss */
function renderSummary() {
  const sum = Engine.summary(TS, Date.now());
  const subs = Object.keys(TS.masteryBefore || {});
  const changes = subs.map(id => ({ st: subById(id), before: TS.masteryBefore[id], after: masteryOf(id).score })).filter(x => x.st);
  const plan = todayPlan(); const nextPlan = plan.items.find(i => !i.done && i.key !== TS.planKey);
  const mins = Math.max(0, Math.round(sum.activeSeconds / 60));
  if (TS.round && TS.status === "completed") return renderRoundSummary(sum, mins);
  setStage('<div class="fx-done"><div class="eyebrow">' + esc(modeName()) + ' · ' + esc(TS.label) + (TS.status === "abandoned" ? " · vorzeitig beendet" : "") + '</div>' +
    (TS.mode === "free" ? '<div class="num" style="margin:var(--s5) 0 var(--s2)">' + mins + '<span class="t-title" style="color:var(--text-3)"> Min.</span></div><div class="t-headline">konzentriert gelernt</div>'
      : sum.graded ? '<div class="num" style="margin:var(--s5) 0 var(--s2)">' + Math.round(sum.score * 100) + '<span class="t-title" style="color:var(--text-3)"> %</span></div><div class="t-headline">' + sum.correct + ' richtig · ' + (sum.partial ? sum.partial + ' teilweise · ' : '') + sum.wrong + ' falsch</div><p class="lead" style="margin:var(--s3) auto 0">' + mins + ' Minuten · ' + sum.answered + ' von ' + sum.total + ' Aufgaben</p>'
      : '<h2 class="fx-title" style="margin-top:var(--s5)">Keine Aufgabe bewertet</h2>') +
    '</div>' + (changes.length ? '<div class="card tight" style="margin-top:var(--s6)"><h2>Lernstand</h2>' + changes.map(c => '<div class="meter"><span class="mt-l">' + esc(c.st.title) + '<span class="mt-s">vorher ' + (c.before == null ? "keine Daten" : c.before + " %") + '</span></span><span class="mt-v">' + (c.after == null ? "—" : c.after + " %") + '</span>' + progBar(c.after || 0, (c.after || 0) < 60 ? "o" : "") + '</div>').join("") + '</div>' : '') +
    (TS.test ? testReviewList() : TS.mode === "exam" ? examReviewList() : ''),
    '<button class="btn" id="sm_close">Schließen</button><span class="grow"></span>' + (nextPlan ? '<button class="btn primary lg" id="sm_next">Weiter: ' + esc(nextPlan.title) + '</button>' : '<button class="btn primary lg" id="sm_done">Fertig</button>'));
  document.getElementById("sm_close").onclick = leaveTrainer;
  const d = document.getElementById("sm_done"); if (d) d.onclick = leaveTrainer;
  const n = document.getElementById("sm_next"); if (n) n.onclick = () => { TS = null; UI = {}; tsSave(); startPlanItem(nextPlan); };
}
/** Vokabeltest: Stand + falsche Antworten mit Lösung */
function testReviewList() {
  const k = klById(TS.scope.exam_id); const st = k ? testStatusOf(k) : null;
  const wrong = TS.answers.filter(a => !a.retry && a.verdict === "wrong").map(a => { const it = TS.items[a.index]; const c = it && cardById(it.vocab_id); if (!c) return ""; const sd = Engine.vocabSides(c, it.direction);
    return '<div class="meter"><span class="mt-l" style="white-space:normal">' + esc(sd.prompt) + '<span class="mt-s">' + (a.given ? "deine Antwort: " + esc(a.given) : "keine Antwort") + '</span></span><span class="mt-v" style="color:var(--text)">' + esc(sd.answer) + '</span></div>'; }).filter(Boolean);
  return (st ? '<div class="card tight" style="margin-top:var(--s6)"><h2>Bis zum Test</h2><div class="meter"><span class="mt-l">Erwartete Trefferquote im Test<span class="mt-s">' + st.secure + ' von ' + st.total + ' sitzen sicher · ' + (daysUntil(k.datum) > 0 ? "noch " + plural(daysUntil(k.datum), "Tag", "Tage") + " · " : "") + (st.unseen ? st.unseen + " noch nicht gelernt" : "alle schon gelernt") + '</span></span><span class="mt-v">' + (st.expected || 0) + ' %</span>' + progBar(st.expected || 0, (st.expected || 0) < 60 ? "o" : "") + '</div></div>' : '') +
    (wrong.length ? '<div class="card tight" style="margin-top:var(--s4)"><h2>Noch üben <span class="count">' + wrong.length + '</span></h2>' + wrong.join("") + '</div>' : '');
}
/** Ende einer Lernrunde: was geschafft ist, was sich im Gedächtnis verändert hat, wie es weitergeht */
function renderRoundSummary(sum, mins) {
  const ids = Object.keys(TS.prog || {}); const cards = ids.map(cardById).filter(Boolean);
  const up = cards.filter(c => Engine.stageOf(c).n > (TS.stageBefore[c.id] || 0)).length;
  const fresh = ids.filter(id => TS.prog[id].fresh).length;
  const firstWrong = ids.filter(id => TS.prog[id].wrong > 0).length;
  const k = TS.test ? klById(TS.scope.exam_id) : null; const col = TS.scope.collection_id ? colById(TS.scope.collection_id) : null;
  const pool = k ? testCards(k) : col ? cardsOf(col.id) : STATE.vo;
  const day = k ? { open: testQueueOf(k).length, tomorrow: 0 } : dayStatus(pool);
  const nextPlan = todayPlan().items.find(i => !i.done && i.key !== TS.planKey);
  const stages = ["new", "learning", "short", "mid", "long"]; const names = { new: "Neu", learning: "Lernen", short: "Kurzzeit", mid: "Gefestigt", long: "Langzeit" };
  const cnt = {}; pool.forEach(v => { const st = Engine.stageOf(v).key; cnt[st] = (cnt[st] || 0) + 1; });
  const ladder = '<div class="ladder">' + stages.map(st => '<div class="rung ' + st + '"><b>' + (cnt[st] || 0) + '</b><span>' + names[st] + '</span></div>').join("") + '</div>';
  const nextTxt = day.open ? "Heute ist noch etwas offen: " + plural(day.open, "Wort", "Wörter") + "."
    : k ? "Für heute bist du mit diesem Test fertig. Morgen geht es weiter."
    : "Fertig für heute. " + (day.tomorrow ? "Morgen " + (day.tomorrow === 1 ? "kommt 1 Wort" : "kommen " + day.tomorrow + " Wörter") + " wieder dran." : day.nextAt ? "Die nächste Wiederholung ist am " + new Date(day.nextAt).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) + "." : "");
  setStage('<div class="fx-done"><div class="done-mark">' + ICO.check + '</div><div class="eyebrow">' + esc(modeName()) + ' · ' + esc(TS.label) + '</div><h2 class="fx-title" style="margin-top:var(--s3)">' + (TS.extra ? "Zusatzrunde geschafft" : "Runde geschafft") + '</h2>' +
    '<p class="lead" style="margin:var(--s3) auto 0">' + plural(ids.length, "Wort", "Wörter") + (fresh === ids.length ? ' – jedes 3× richtig aus dem Kopf. ' : fresh ? ' – neue 3×, Wiederholungen 1× richtig aus dem Kopf. ' : ' – jedes richtig aus dem Kopf. ') + mins + ' Min.</p>' +
    '<div class="t-headline" style="margin-top:var(--s4)">' + (ids.length - firstWrong) + ' beim ersten Versuch richtig · ' + firstWrong + ' nachgelernt' + (up ? ' · ' + plural(up, "Wort", "Wörter") + ' eine Stufe höher' : '') + '</div></div>' +
    '<div class="card tight" style="margin-top:var(--s6)"><h2>' + esc(k ? vtName(k) : col ? col.name : "Alle Vokabeln") + ' im Gedächtnis</h2>' + ladder + '<p class="t-sub" style="margin-top:var(--s3)">' + esc(nextTxt) + '</p></div>' +
    (TS.test ? testReviewList() : ''),
    '<button class="btn" id="sm_close">Schließen</button><span class="grow"></span>' + (day.open ? '<button class="btn primary lg" id="sm_again">' + ICO.play + 'Nächste Runde</button>' : nextPlan ? '<button class="btn primary lg" id="sm_next">Weiter: ' + esc(nextPlan.title) + '</button>' : '<button class="btn primary lg" id="sm_done">Fertig</button>'));
  document.getElementById("sm_close").onclick = leaveTrainer;
  const nx = document.getElementById("sm_next"); if (nx) nx.onclick = () => { TS = null; UI = {}; tsSave(); startPlanItem(nextPlan); };
  const d = document.getElementById("sm_done"); if (d) d.onclick = leaveTrainer;
  const a = document.getElementById("sm_again"); if (a) a.onclick = () => { const cfg = TS.cfg; TS = null; UI = {}; tsSave(); startTraining(Object.assign({}, cfg, { force: true })); };
}
function examReviewList() {
  const rows = TS.answers.filter(a => !a.retry).map(a => { const it = TS.items[a.index]; const q = it.kind === "exercise" ? it.exercise.question : it.kind === "vocab_match" ? "Zuordnung" : it.prompt || (cardById(it.vocab_id) || {}).begriff; return '<div class="meter"><span class="mt-l" style="white-space:normal">' + esc(String(q).slice(0, 140)) + '</span><span class="mt-v">' + (a.result == null ? "—" : Math.round(a.result * 100) + " %") + '</span></div>'; }).join("");
  return rows ? '<div class="card tight" style="margin-top:var(--s4)"><h2>Aufgaben</h2>' + rows + '</div>' : "";
}

/* ---------------- Tagesplan starten ---------------- */
function startPlanItem(it) {
  if (!it) return;
  const k = it.exam_id != null ? klById(it.exam_id) : null;
  if (it.kind === "setup" && k) topicAssistant(k);
  else if (it.kind === "mock" && k) mockModal(k);
  else if (it.kind === "probe" && k) probeModal(k);
  else if ((it.kind === "review" || it.kind === "final") && k) { if (it.subtopic_id) startTraining({ mode: "topic", subtopic_id: it.subtopic_id, planKey: it.key }); else topicAssistant(k); }
  else if (it.kind === "test") startTraining({ mode: "test", exam_id: it.exam_id, planKey: it.key });
  else if (it.kind === "vocab") startTraining({ mode: "vocab", direction: "forward", count: 30, planKey: it.key });
  else if (it.kind === "errors") startTraining({ mode: "errors", direction: "forward", planKey: it.key });
  else if (it.kind === "subtopic") startTraining({ mode: "topic", subtopic_id: it.subtopic_id, planKey: it.key });
}
function startNextPlanItem() { const p = todayPlan(); const it = p.items.find(i => !i.done); if (it) startPlanItem(it); else toast("Dein Tagesplan ist erledigt."); }

/* ---------------- Ticker: Timer, Ablauf, Pille ---------------- */
function sessTick() {
  if (!TS) { const pill = document.getElementById("sessionPill"); if (pill && pill.innerHTML) pill.innerHTML = ""; return; }
  const now = Date.now();
  if (Engine.isExpired(TS, now) && !TS.evalPending) {
    if (TS.mode === "exam") { tsFinish("completed", true); toast("Die Zeit ist um."); renderSessionStage(); }
    else { tsFinish("completed", true); renderSessionStage(); }
  }
  document.querySelectorAll("[data-tstime]").forEach(e => { e.textContent = tsClock(); });
  document.querySelectorAll("[data-tsstate]").forEach(e => { e.classList.toggle("paused", TS.status === "paused"); e.classList.toggle("low", !!(TS.time_limit_s && Engine.remainingMs(TS, now) < 5 * 60000)); });
  const pill = document.getElementById("sessionPill");
  if (pill) {
    const show = tsActive() && !(ROUTE.name === "trainer" && ROUTE.sub === "session");
    if (!show) { if (pill.innerHTML) pill.innerHTML = ""; }
    else if (!pill.firstChild || pill.firstChild.dataset.id !== TS.id + TS.status) pill.innerHTML = '<div class="session-pill' + (TS.status === "paused" ? " paused" : "") + '" data-id="' + TS.id + TS.status + '" data-tsstate><i></i><b data-tstime>' + tsClock() + '</b><span class="lbl">' + esc(TS.label) + '</span><a class="btn primary sm" href="#/trainer/session">Fortsetzen</a></div>';
  }
  // sanfte Pausen-Erinnerung alle 25 Minuten
  if (TS.status === "active" && TS.mode !== "exam") { const blocks = Math.floor(Engine.elapsedMs(TS, now) / (25 * 60000)); if (blocks > (TS.notified || 0)) { TS.notified = blocks; tsSave(); notify(blocks * 25 + " Minuten konzentriert", "Gönn dir 5 Minuten Pause.", "lc-sess"); } }
}
setInterval(sessTick, 1000);
