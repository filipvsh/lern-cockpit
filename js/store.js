/* =====================================================================
   LERN-COCKPIT · STORE
   Lädt die Lerndaten (Fächer, Sammlungen, Themen, Unterthemen, Übungen,
   Lernereignisse, Sessions), übernimmt Altdaten in das neue Modell und
   stellt Selektoren (Lernstand, Bereitschaft, Plan, Schwachstellen) und
   Schreiboperationen bereit. Kennt kein DOM.
   Abhängigkeiten: Engine (js/engine.js), Api (js/api.js), STATE & Helfer
   aus index.html.
   ===================================================================== */
const ES = { subjects: [], collections: [], topics: [], subtopics: [], exercises: [], events: [], sessions: [], profile: null };
let ES_VER = 0;                         // Version für Memo-Caches
const bump = () => { ES_VER++; MEMO.clear(); };
const MEMO = new Map();
function memo(key, fn) { const k = ES_VER + ":" + key; if (MEMO.has(k)) return MEMO.get(k); const v = fn(); MEMO.set(k, v); return v; }

const LANG_CODE = { "Französisch": "fr", "Englisch": "en", "Latein": "la", "Spanisch": "es", "Deutsch": "de" };
const CODE_LANG = { fr: "Französisch", en: "Englisch", la: "Latein", es: "Spanisch", de: "Deutsch" };
const langName = c => CODE_LANG[c] || c || "—";
const isTermCollection = c => !!c && c.source_language === c.target_language;   // Fachbegriffe: Begriff → Erklärung
const groupName = code => code === "de" ? "Fachbegriffe" : langName(code);
/** Schulfach im Namen einer Sammlung (z. B. „Chemie“, „Mathe Grundbegriffe“) – nur Nicht-Fremdsprachen */
function subjectInName(name) {
  const s = String(name || "").toLowerCase();
  return FACHER.filter(f => !["Englisch", "Französisch"].includes(f)).find(f => s.includes(f.toLowerCase())) || null;
}
/** Sprache einer Altdaten-Lektion: erkannte Fremdsprache, sonst Fachbegriffe (nie mehr pauschal Französisch) */
const guessLangCode = name => Engine.guessLanguage(name) || "de";

/* ---------------- Laden ---------------- */
const SINCE_DAYS = 180;
async function loadEngine() {
  const since = new Date(Date.now() - SINCE_DAYS * 864e5).toISOString();
  const [subjects, collections, topics, subtopics, exercises, events, sessions, profile] = await Promise.all([
    Api.getAll("subjects", "select=*&order=name.asc"),
    Api.getAll("vocab_collections", "select=*&order=name.asc"),
    Api.getAll("topics", "select=*&order=sort.asc,created_at.asc"),
    Api.getAll("subtopics", "select=*&order=sort.asc,created_at.asc"),
    Api.getAll("exercises", "select=*&order=created_at.asc"),
    Api.getAll("learning_events", "select=id,type,result,difficulty,subject,exam_id,topic_id,subtopic_id,exercise_id,vocab_id,session_id,detail,created_at&created_at=gte." + since + "&order=created_at.asc", 2000),
    Api.getAll("training_sessions", "select=id,mode,status,label,subject,exam_id,topic_id,subtopic_id,collection_id,direction,started_at,completed_at,time_limit_s,active_seconds,question_count,correct_count,wrong_count,score&or=(started_at.gte." + since + ",status.in.(active,paused))&order=started_at.asc"),
    Api.get("profiles", "select=*&limit=1").then(r => r && r[0] || null)
  ]);
  Object.assign(ES, { subjects, collections, topics, subtopics, exercises, events, sessions, profile });
  bump();
}
const normVO = r => ({
  id: r.id, begriff: r.begriff || "", bedeutung: r.bedeutung || "", sprache: r.sprache || "", level: r.level || 0, next: r.next || "",
  collection_id: r.collection_id || null, subject_id: r.subject_id || null,
  source_language: r.source_language || null, target_language: r.target_language || null,
  alternatives: Array.isArray(r.alternatives) ? r.alternatives : [], example_sentence: r.example_sentence || "", notes: r.notes || "",
  difficulty: r.difficulty || 2, mastery: r.mastery || 0, interval_days: +r.interval_days || 0, ease: +r.ease || 2.5,
  reps: r.reps || 0, lapses: r.lapses || 0, next_review_at: r.next_review_at || null, last_reviewed_at: r.last_reviewed_at || null,
  last_result: r.last_result || null, correct_count: r.correct_count || 0, incorrect_count: r.incorrect_count || 0, created_at: r.created_at || null
});

/* ---------------- Schreiben (optimistisch, mit Offline-Puffer) ---------------- */
const TABLE_KEY = { subjects: "subjects", vocab_collections: "collections", topics: "topics", subtopics: "subtopics", exercises: "exercises", learning_events: "events", training_sessions: "sessions" };
function localList(table) { return table === "vokabeln" ? STATE.vo : ES[TABLE_KEY[table]]; }
async function dbInsert(table, row, conflict) {
  row.id = row.id || Engine.uuid();
  const list = localList(table); if (list && !list.some(x => x.id === row.id)) list.push(row);
  bump();
  const res = await Api.write("POST", table, conflict ? "on_conflict=" + conflict : null, stripLocal(row));
  return Object.assign({ row }, res);
}
async function dbPatch(table, id, patch) {
  const list = localList(table); const it = list && list.find(x => x.id === id); if (it) Object.assign(it, patch);
  bump();
  return Api.write("PATCH", table, "id=eq." + encodeURIComponent(id), stripLocal(patch));
}
async function dbDelete(table, id) {
  const list = localList(table); if (list) { const i = list.findIndex(x => x.id === id); if (i >= 0) list.splice(i, 1); }
  bump();
  return Api.write("DELETE", table, "id=eq." + encodeURIComponent(id));
}
const stripLocal = o => { const c = {}; Object.keys(o).forEach(k => { if (!k.startsWith("_")) c[k] = o[k]; }); return c; };

/* ---------------- Übernahme der Altdaten ----------------
   Läuft nach jedem Laden (idempotent):
     • Fächer anlegen, die in Stundenplan/Prüfungen vorkommen
     • Vokabeln ohne Sammlung → Sammlung aus dem bisherigen Feld „sprache“
     • Prüfungen mit alter Themenliste → Thema + Unterthemen
   Routinen, die weiterhin im alten Format schreiben, werden so laufend
   in das neue Modell überführt. */
async function normalizeEngine() {
  const names = new Set(FACHER.concat(["Französisch", "Englisch"]).concat(STATE.kl.map(k => k.fach).filter(Boolean)));
  for (const n of names) {
    if (!ES.subjects.some(s => s.name === n)) await dbInsert("subjects", { name: n, color: fcol(n), language_code: LANG_CODE[n] || null }, "user_id,name");
  }
  // Vokabeln → Sammlungen
  const orphan = STATE.vo.filter(v => !v.collection_id);
  const byDeck = {}; orphan.forEach(v => { const k = (v.sprache || "Allgemein").trim(); (byDeck[k] = byDeck[k] || []).push(v); });
  for (const [name, cards] of Object.entries(byDeck)) {
    let col = ES.collections.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!col) {
      const code = guessLangCode(name);
      col = (await dbInsert("vocab_collections", { name, source_language: code, target_language: "de", subject_id: code === "de" ? subjectId(subjectInName(name)) : subjectId(langName(code)) }, "user_id,name")).row;
    }
    const patch = { collection_id: col.id, source_language: col.source_language, target_language: col.target_language, subject_id: col.subject_id || null };
    cards.forEach(v => Object.assign(v, patch));
    for (let i = 0; i < cards.length; i += 150) {
      const ids = cards.slice(i, i + 150).map(v => encodeURIComponent(v.id)).join(",");
      await Api.write("PATCH", "vokabeln", "id=in.(" + ids + ")", patch);
    }
  }
  // Korrektur: Lektionen mit Fachnamen (z. B. „Chemie“), die beim ersten Übernehmen als Französisch eingeordnet wurden
  for (const c of ES.collections) {
    const subj = subjectInName(c.name);
    if (c.source_language !== "fr" || c.target_language !== "de" || Engine.guessLanguage(c.name) || !subj) continue;
    const fix = { source_language: "de", target_language: "de", subject_id: subjectId(subj) };
    await dbPatch("vocab_collections", c.id, fix);
    const cards = cardsOf(c.id); cards.forEach(v => Object.assign(v, { source_language: "de", target_language: "de", subject_id: fix.subject_id }));
    for (let i = 0; i < cards.length; i += 150) await Api.write("PATCH", "vokabeln", "id=in.(" + cards.slice(i, i + 150).map(v => encodeURIComponent(v.id)).join(",") + ")", { source_language: "de", target_language: "de", subject_id: fix.subject_id });
  }
  // Alte Themenlisten → Thema + Unterthemen (+ bisherige Selbsteinschätzungen als Ereignis)
  for (const k of STATE.kl) {
    if (k._topicsMigrated || k.topics_migrated) continue;
    const has = ES.topics.some(t => t.exam_id === k.id);
    if (!has && k.themen && k.themen.length) {
      const topic = (await dbInsert("topics", { title: klTitle(k), exam_id: k.id, subject_id: subjectId(k.fach), priority: 2, status: "active" })).row;
      for (let i = 0; i < k.themen.length; i++) {
        const t = k.themen[i];
        const st = (await dbInsert("subtopics", { topic_id: topic.id, title: String(t.text || "Unterthema").slice(0, 160), difficulty: 2, sort: i })).row;
        const prior = t.done ? 1 : (t.score != null ? +t.score / 100 : null);
        if (prior != null) await logEvent({ type: "self_assessment", result: prior, subject: k.fach, exam_id: k.id, topic_id: topic.id, subtopic_id: st.id, detail: { source: "übernommen aus der alten Themenliste" } });
      }
    }
    k._topicsMigrated = true;
    await Api.write("PATCH", "klausuren", "id=eq." + encodeURIComponent(k.id), { topics_migrated: true }).catch(() => {});
  }
  bump();
}

/* ---------------- Lernereignisse ---------------- */
function logEvent(e) {
  const row = Object.assign({ id: Engine.uuid(), created_at: new Date().toISOString(), detail: {} }, e);
  if (row.result != null) row.result = Math.round(Math.max(0, Math.min(1, row.result)) * 1000) / 1000;
  ES.events.push(row); bump();
  Api.write("POST", "learning_events", null, row).catch(err => { console.warn("Lernereignis", err); toast("Lernereignis konnte nicht gespeichert werden: " + err.message, true); });
  return row;
}
/** Lernstand-Cache in subtopics.mastery_score aktualisieren (für Abfragen außerhalb der App) */
function syncMasteryCache(subIds) {
  [...new Set(subIds)].forEach(id => {
    const st = ES.subtopics.find(s => s.id === id); if (!st) return;
    const m = masteryOf(id).score;
    if (st.mastery_score !== m) dbPatch("subtopics", id, { mastery_score: m, updated_at: new Date().toISOString() });
  });
}

/* ---------------- Selektoren ---------------- */
const subjectId = name => { const s = ES.subjects.find(x => x.name === name); return s ? s.id : null; };
const topicById = id => ES.topics.find(t => t.id === id) || null;
const subById = id => ES.subtopics.find(s => s.id === id) || null;
const exById = id => ES.exercises.find(e => e.id === id) || null;
const colById = id => ES.collections.find(c => c.id === id) || null;
const topicsOfExam = examId => ES.topics.filter(t => t.exam_id === examId).sort((a, b) => a.sort - b.sort || String(a.created_at).localeCompare(String(b.created_at)));
const subsOfTopic = topicId => ES.subtopics.filter(s => s.topic_id === topicId).sort((a, b) => a.sort - b.sort || String(a.created_at).localeCompare(String(b.created_at)));
const exercisesOf = subId => ES.exercises.filter(e => e.subtopic_id === subId);
const subsOfExam = examId => topicsOfExam(examId).flatMap(t => subsOfTopic(t.id).map(s => Object.assign({ priority: t.priority }, s)));
const examOfSub = st => { const t = st && topicById(st.topic_id); return t && t.exam_id != null ? klById(t.exam_id) : null; };
const cardsOf = colId => STATE.vo.filter(v => v.collection_id === colId);
function eventsBySub() { return memo("ebs", () => { const m = {}; ES.events.forEach(e => { if (e.subtopic_id) (m[e.subtopic_id] = m[e.subtopic_id] || []).push(e); }); return m; }); }
function masteryOf(subId) { return memo("m:" + subId, () => Engine.subtopicMastery(eventsBySub()[subId] || [], Date.now())); }
function lastExerciseResult(exId) { for (let i = ES.events.length - 1; i >= 0; i--) { const e = ES.events[i]; if (e.exercise_id === exId && e.result != null) return +e.result; } return null; }
function recentMistakes(subId, n) {
  const out = [];
  (eventsBySub()[subId] || []).slice().reverse().forEach(e => {
    if (out.length >= (n || 5)) return;
    const d = e.detail || {};
    (d.mistakes || []).forEach(x => { if (out.length < (n || 5) && !out.includes(x)) out.push(x); });
    if (+e.result < 0.5 && d.mistake && !out.includes(d.mistake)) out.push(d.mistake);
  });
  return out;
}
/** Vokabel-Lernstand einer Sammlung – nur wenn schon abgefragt (sonst null) */
function collectionMastery(colId) {
  const cards = cardsOf(colId); if (!cards.length || !cards.some(c => !Engine.isNew(c))) return null;
  return Engine.vocabStats(cards, Date.now()).mastery;
}
function linkedCollections(k) {
  const loc = (!k.vokabel_lektionen || !k.vokabel_lektionen.length) ? lsGet("lc_kl_" + k.id, {}).vokabel_lektionen : null;
  const names = (loc || k.vokabel_lektionen || []).map(x => String(x).toLowerCase());
  return ES.collections.filter(c => names.includes(c.name.toLowerCase()));
}
/* ---------------- Vokabeltests (Prüfung mit fester Sammlung, z. B. „Voc. 7A p. 222/223“) ---------------- */
const VT_PREFIX = "Vokabeltest: ";
const isVocabTest = k => !!k && (k.description === "Vokabeltest" || /^vokabeltest\b/i.test(k.thema || ""));
const vtName = k => String(k.thema || "").replace(/^vokabeltest:?\s*/i, "") || "Vokabeltest";
const upcomingTests = () => upcomingKL().filter(isVocabTest);
const testCards = k => { const ids = linkedCollections(k).map(c => c.id); return STATE.vo.filter(v => ids.includes(v.collection_id)); };
const testDayMs = k => new Date(k.datum + "T08:00:00").getTime();
function testStatusOf(k) { return memo("ts:" + k.id, () => Engine.testStatus(testCards(k), testDayMs(k))); }
function testQueueOf(k) { return memo("tq:" + k.id, () => Engine.testQueue(testCards(k), { now: Date.now(), daysLeft: daysUntil(k.datum), testDay: testDayMs(k) })); }
/** Anstehender Test, zu dem diese Sammlung gehört (für die Begrenzung der Wiederholungsabstände) */
const testForCollection = colId => upcomingTests().find(k => linkedCollections(k).some(c => c.id === colId)) || null;
function readinessOf(k) {
  if (isVocabTest(k)) return memo("r:" + k.id, () => { const s = testStatusOf(k); return { score: s.expected, total: s.total, withData: s.seen, secure: s.secure, test: true }; });
  return memo("r:" + k.id, () => Engine.examReadiness(subsOfExam(k.id), id => masteryOf(id).score, linkedCollections(k).map(c => collectionMastery(c.id))));
}
function minutesTodayFor(pred) {
  const t = todayISO();
  return Math.round(ES.sessions.filter(s => s.started_at && isoLocal(new Date(s.started_at)) === t && pred(s)).reduce((a, s) => a + (s.active_seconds || 0), 0) / 60);
}
function priorities() {
  return memo("prio", () => Engine.prioritize({
    now: Date.now(), subtopics: ES.subtopics, topicById, examById: id => klById(id),
    masteryOf: id => masteryOf(id), minutesToday: id => minutesTodayFor(s => s.subtopic_id === id)
  }));
}
function focusCollections() { const tr = getTrainer(); if (!tr.on || !tr.lessons.length) return null; const n = tr.lessons.map(x => x.toLowerCase()); return ES.collections.filter(c => n.includes(c.name.toLowerCase())).map(c => c.id); }
function vocabDue() {
  return memo("due", () => {
    const now = Date.now(); const focus = focusCollections();
    return ES.collections.filter(c => !focus || focus.includes(c.id)).map(c => ({ id: c.id, name: c.name, count: cardsOf(c.id).filter(v => Engine.isDue(v, now)).length })).filter(x => x.count > 0);
  });
}
/* ---------------- Tagesziel Vokabeln ----------------
   Höchstens NEW_PER_DAY neue Wörter pro Tag (Successive Relearning: wenige neue,
   dafür sicher). „Fertig für heute“ = nichts fällig und Tageskontingent erreicht. */
const NEW_PER_DAY = 10;
function newToday(colIds) {
  const t = todayISO();
  return ES.events.filter(e => e.vocab_id && e.detail && e.detail.fresh && isoLocal(new Date(e.created_at)) === t && (!colIds || colIds.includes((cardById(e.vocab_id) || {}).collection_id))).length;
}
const newLeftToday = () => Math.max(0, NEW_PER_DAY - newToday());
const cardById = id => STATE.vo.find(v => String(v.id) === String(id));
/** pool: Karten-Auswahl (Sammlung o. ä.) → was heute noch offen ist */
function dayStatus(pool) {
  const now = Date.now(); pool = pool || STATE.vo;
  const due = pool.filter(v => Engine.isDue(v, now)).length;
  const fresh = Math.min(newLeftToday(), pool.filter(Engine.isNew).length);
  const tomorrowEnd = Engine.startOfDay(now) + 2 * Engine.DAY;
  const tomorrow = pool.filter(v => !Engine.isNew(v) && !Engine.isDue(v, now) && v.next_review_at && new Date(v.next_review_at).getTime() < tomorrowEnd).length;
  const nextAt = pool.filter(v => !Engine.isNew(v) && v.next_review_at && new Date(v.next_review_at).getTime() > now).map(v => new Date(v.next_review_at).getTime()).sort((a, b) => a - b)[0] || null;
  return { due, fresh, open: due + fresh, done: due + fresh === 0, tomorrow, nextAt };
}
const troubleCards = () => STATE.vo.filter(Engine.isTrouble);
const troubleExercises = () => ES.exercises.filter(e => { const r = lastExerciseResult(e.id); return r != null && r < 0.5; });
const budgetMinutes = () => (ES.profile && ES.profile.daily_minutes) || 30;
/** Tagesplan: einmal pro Tag berechnet und gespeichert, damit er sich nicht unter der Hand umsortiert */
function todayPlan(forceNew) {
  const key = "lc_plan_" + todayISO();
  let plan = forceNew ? null : lsGet(key, null);
  // neu berechnen, sobald neue Themen/Prüfungen/Sammlungen dazukommen (z. B. nach dem Themen-Assistenten)
  const sig = ES.subtopics.length + ":" + upcomingKL().length + ":" + ES.collections.length;
  if (!plan || plan.v !== 4 || plan.sig !== sig) {
    // Sammlungen eines anstehenden Vokabeltests plant der Test selbst
    const tcols = new Set(upcomingTests().flatMap(k => linkedCollections(k).map(c => c.id)));
    const focus = focusCollections(); const fresh = Math.min(newLeftToday(), STATE.vo.filter(v => Engine.isNew(v) && !tcols.has(v.collection_id) && (!focus || focus.includes(v.collection_id))).length);
    const p = Engine.dailyPlan({ budgetMin: budgetMinutes(), vocabDue: vocabDue().filter(x => !tcols.has(x.id)), vocabNew: fresh, priorities: priorities(), troubleCount: troubleCards().length + troubleExercises().length });
    plan = { v: 4, sig, budget: p.budget, items: p.items.map(i => ({ key: i.key, kind: i.kind, minutes: i.minutes, title: i.title, sub: i.sub, reasons: i.reasons, subtopic_id: i.ref ? i.ref.subtopic.id : null })) };
    lsSet(key, plan);
  }
  // Auftrag für heute: Themen festlegen → Vokabeltests → Probeklausur/Nacharbeiten/Vortag → Rest.
  // Live berechnet (nicht im Tages-Cache), damit erledigte Schritte sofort abgehakt sind.
  const exams = upcomingKL().filter(k => !isVocabTest(k));
  const examItems = exams.flatMap(examMissionItems);
  const setup = examItems.filter(i => i.kind === "setup"), phase = examItems.filter(i => i.kind !== "setup");
  const tests = upcomingTests().flatMap(testPlanItems);
  // Am Tag der Probeklausur und am Vortag keine zusätzlichen Einzelthemen derselben Klausur
  const busy = new Set(phase.filter(i => i.kind === "mock" || i.kind === "final").map(i => String(i.exam_id)));
  const rest = plan.items.filter(i => i.kind !== "test" && !(i.kind === "subtopic" && busy.has(String((examOfSub(subById(i.subtopic_id)) || {}).id))));
  plan = Object.assign({}, plan, { items: setup.concat(tests, phase, rest) });
  // Reihenfolge bleibt stabil; Begründungen und Fortschritt sind immer aktuell
  const prio = priorities();
  plan.items.forEach(i => {
    if (i.kind === "subtopic") { const p = prio.find(x => x.subtopic.id === i.subtopic_id); const st = subById(i.subtopic_id); if (p) i.reasons = p.reasons; if (st) i.title = st.title; }
    if (["test", "probe", "setup", "mock", "review", "final"].includes(i.kind)) return;
    i.doneMin = i.kind === "vocab" ? minutesTodayFor(s => s.mode === "vocab" && s.status === "completed" && s.exam_id == null)
      : i.kind === "errors" ? minutesTodayFor(s => s.mode === "errors")
      : minutesTodayFor(s => s.subtopic_id === i.subtopic_id);
    if (i.kind === "vocab") {
      // erledigt = nichts mehr fällig und Tageskontingent neuer Wörter genutzt (wie „Fertig für heute“)
      const tcols = new Set(upcomingTests().flatMap(k => linkedCollections(k).map(c => c.id)));
      i.done = dayStatus(STATE.vo.filter(v => !tcols.has(v.collection_id))).done;
      if (i.done) i.doneMin = Math.max(i.doneMin, i.minutes);
    } else i.done = i.doneMin >= i.minutes * 0.8;
  });
  return plan;
}
/* ---------------- Klausur-Fahrplan (Engine.examRoadmap) ---------------- */
const KLAUSUR_HORIZON = 21;   // ab 3 Wochen vorher plant die App mit
const sameDay = iso => iso && isoLocal(new Date(iso)) === todayISO();
function mockInfo(k) {
  const ms = ES.sessions.filter(s => s.mode === "exam" && String(s.exam_id) === String(k.id) && s.status === "completed" && s.started_at).map(s => s.started_at).sort();
  const last = ms[ms.length - 1]; if (!last) return null;
  return { at: last, daysAgo: Engine.calDays(new Date(last).getTime(), Date.now()) };
}
const reviewSessions = (k, mock) => mock ? ES.sessions.filter(s => String(s.exam_id) === String(k.id) && ["topic", "mixed", "errors"].includes(s.mode) && s.status === "completed" && s.started_at > mock.at) : [];
function roadmapOf(k) {
  const mock = mockInfo(k);
  return Engine.examRoadmap({ daysLeft: daysUntil(k.datum), hasTopics: subsOfExam(k.id).length > 0, mockDoneDaysAgo: mock ? mock.daysAgo : null, reviewDone: reviewSessions(k, mock).length > 0 });
}
const weakestSubs = (k, n) => subsOfExam(k.id).map(s => ({ s, m: masteryOf(s.id).score })).sort((a, b) => (a.m == null ? -1 : a.m) - (b.m == null ? -1 : b.m)).slice(0, n || 2).map(x => x.s);
const mockMinutes = k => Math.min(k.dauer || 90, 135);
/** Schritte einer Klausur für heute (Themen festlegen, Probeklausur, Nacharbeiten, Vortag) */
function examMissionItems(k) {
  const d = daysUntil(k.datum); if (d < 1 || d > KLAUSUR_HORIZON) return [];
  const when = d === 1 ? "morgen" : "in " + d + " Tagen";
  const base = (kind, minutes, title, sub, reasons, done) => ({ key: kind + ":" + k.id, kind, exam_id: k.id, minutes, title, sub: k.fach + "-Klausur " + when + " · " + sub, reasons, done, doneMin: done ? minutes : 0 });
  const today = roadmapOf(k).filter(s => s.day === 0).map(s => s.kind);
  const mock = mockInfo(k); const out = [];
  if (today.includes("setup")) out.push(base("setup", 5, "Festlegen, was in " + k.fach + " drankommt", "Themen aus Heft und Unterricht ankreuzen", ["Ohne Themenliste weiß die App nicht, was du üben sollst"], false));
  if (today.includes("mock") || (mock && mock.daysAgo === 0)) out.push(base("mock", mockMinutes(k), "Probeklausur " + k.fach, mockMinutes(k) + " Min. wie echt, ohne Hilfen", ["Zeigt die Lücken, solange noch Zeit ist (" + Engine.MOCK_DAYS_BEFORE + " Tage vorher)"], !!(mock && mock.daysAgo === 0)));
  const rv = reviewSessions(k, mock);
  if (today.includes("review") || rv.some(s => sameDay(s.started_at))) {
    const w = weakestSubs(k, 1)[0];
    out.push(Object.assign(base("review", 15, "Probeklausur nacharbeiten" + (w ? ": " + w.title : ""), "dein schwächster Bereich", ["Fehler direkt nach der Probeklausur schließen"], rv.some(s => sameDay(s.started_at))), { subtopic_id: w ? w.id : null }));
  }
  if (today.includes("final")) {
    const min = minutesTodayFor(s => String(s.exam_id) === String(k.id));
    const w = weakestSubs(k, 2);
    out.push(Object.assign(base("final", 20, "Letzte Wiederholung " + k.fach, w.length ? w.map(s => s.title).join(" · ") : "die zwei schwächsten Themen", ["Am Vortag nur festigen, nichts Neues – dann früh schlafen"], min >= 15), { subtopic_id: w[0] ? w[0].id : null, doneMin: min }));
  }
  return out;
}
/** Vokabeltest: Lernrunde, am Vortag zusätzlich Probetest */
function testPlanItems(k) {
  const it = testPlanItem(k); if (!it) return [];
  const out = [it]; const d = daysUntil(k.datum);
  if (d <= 1) {
    const probe = ES.sessions.find(s => s.mode === "exam" && String(s.exam_id) === String(k.id) && s.status === "completed" && sameDay(s.started_at));
    out.push({ key: "probe:" + k.id, kind: "probe", exam_id: k.id, minutes: 15, title: "Probetest: " + vtName(k), sub: "Vokabeltest " + (d === 0 ? "heute" : "morgen") + " · alle Wörter, mit Zeitlimit, wie in der Schule" + (probe && probe.score != null ? " · " + Math.round(probe.score * 100) + " %" : ""), reasons: ["Prüft, ob es ohne Hilfe klappt – Fehlerwörter kommen danach in die Lernrunde"], done: !!probe, doneMin: probe ? 15 : 0 });
  }
  return out;
}
function testPlanItem(k) {
  const cards = testCards(k); if (!cards.length) return null;
  const d = daysUntil(k.datum); const q = testQueueOf(k); const st = testStatusOf(k);
  const fresh = q.filter(Engine.isNew).length, rev = q.length - fresh;
  const doneMin = minutesTodayFor(s => String(s.exam_id) === String(k.id));
  const when = d === 0 ? "heute" : d === 1 ? "morgen" : "in " + d + " Tagen";
  return { key: "test:" + k.id, kind: "test", exam_id: k.id, minutes: Math.max(5, Math.min(25, Math.ceil(Math.max(q.length, 1) * 0.4))),
    title: vtName(k), sub: "Vokabeltest " + when + " · " + (q.length ? (fresh ? fresh + " neue" : "") + (fresh && rev ? " + " : "") + (rev ? rev + " Wiederholungen" : "") : "für heute erledigt") + " · " + (st.expected == null ? "noch nicht begonnen" : "erwartet " + st.expected + " % im Test"),
    reasons: [d <= 1 ? "Letzte Runde: alle Wörter noch einmal" : "Verteilt bis zum Test"], doneMin, done: !q.length };
}
/** Schwachstellen: geübte Unterthemen unter 70 % und Sammlungen mit Fehlerkarten */
function weakSpots(limit) {
  return memo("weak:" + limit, () => {
    const out = [];
    ES.subtopics.forEach(st => {
      // Schwachstelle = nachweislich schwache Leistung oder wiederholte Fehler – nicht bloß wenige Daten
      const m = masteryOf(st.id); if (m.score == null || m.score >= 70) return;
      if (m.base >= 0.7 && m.recentErrors < 2) return;
      const t = topicById(st.topic_id); const ex = examOfSub(st);
      if (ex && (ex.punkte != null || daysUntil(ex.datum) < 0)) return;
      out.push({ kind: "subtopic", id: st.id, label: st.title, sub: (ex ? ex.fach + " · " : "") + (t ? t.title : ""), pct: m.score, errors: m.recentErrors, daysSince: m.daysSince, mistakes: recentMistakes(st.id, 2), href: "#/trainer/start?mode=topic&sub=" + st.id });
    });
    ES.collections.forEach(c => {
      const cards = cardsOf(c.id); const tr = cards.filter(Engine.isTrouble).length; if (!tr) return;
      const st = Engine.vocabStats(cards, Date.now());
      out.push({ kind: "collection", id: c.id, label: c.name, sub: "Vokabeln · " + groupName(c.source_language) + " · " + plural(tr, "Fehlerkarte", "Fehlerkarten"), pct: st.mastery, errors: tr, href: "#/trainer/start?mode=errors&col=" + c.id });
    });
    return out.sort((a, b) => a.pct - b.pct || b.errors - a.errors).slice(0, limit || 5);
  });
}
/** Lernzeit in Minuten je Tag (Sessions + ältere Fokus-Einträge) */
function minutesByDay() {
  return memo("mbd", () => {
    const m = {};
    ES.sessions.forEach(s => { if (!s.started_at || !s.active_seconds) return; const d = isoLocal(new Date(s.started_at)); m[d] = (m[d] || 0) + s.active_seconds / 60; });
    STATE.log.filter(l => l.art === "fokus").forEach(l => { m[l.datum] = (m[l.datum] || 0) + (l.minuten || 0); });
    return m;
  });
}
function activeDays() {
  return memo("ad", () => {
    const set = new Set();
    Object.entries(minutesByDay()).forEach(([d, v]) => { if (v >= 1) set.add(d); });
    ES.events.forEach(e => set.add(isoLocal(new Date(e.created_at))));
    STATE.log.filter(l => l.art === "vokabel" && l.anzahl > 0).forEach(l => set.add(l.datum));
    return set;
  });
}
const learnStreak = () => Engine.streak(activeDays(), Date.now());
