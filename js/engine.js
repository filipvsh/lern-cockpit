/* =====================================================================
   LERN-COCKPIT · ENGINE
   Reine Lernlogik ohne DOM und ohne Datenbank. Alle Funktionen sind
   deterministisch (Zeit `now` und Zufall `rng` werden übergeben) und in
   tests/engine.test.js abgedeckt.

   Inhalt
     1. Antwortprüfung (Normalisierung, Alternativen, Artikel, Tippfehler)
     2. Spaced Repetition für Vokabeln
     3. Trainings-Session (Status, zeitbasierter Timer, Ergebnisse)
     4. Lernstand (Mastery) für Unterthemen und Prüfungen
     5. Lernplan: Prioritäten und Tagesplan
     6. Übungen: Prüfung, Vokabel-Übungsformen, Session-Aufbau
     7. Kennzahlen für Fortschritt
   ===================================================================== */
(function (root, factory) {
  const E = factory();
  if (typeof module === "object" && module.exports) module.exports = E;
  else root.Engine = E;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const DAY = 86400000, MIN = 60000;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const round1 = x => Math.round(x * 10) / 10;
  const toMs = t => t == null ? null : (typeof t === "number" ? t : new Date(t).getTime());
  const startOfDay = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const isoDay = ms => { const d = new Date(ms); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const daysBetween = (aMs, bMs) => Math.round((startOfDay(bMs) - startOfDay(aMs)) / DAY);
  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });
  }
  function shuffle(arr, rng) { rng = rng || Math.random; const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ===================================================================
     1. ANTWORTPRÜFUNG
     =================================================================== */
  const LANG_NAMES = { fr: "Französisch", en: "Englisch", de: "Deutsch", la: "Latein", es: "Spanisch" };
  const ARTICLES = {
    de: ["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer"],
    fr: ["le", "la", "les", "l'", "un", "une", "des", "du", "de la", "de l'"],
    en: ["the", "a", "an"],
    es: ["el", "la", "los", "las", "un", "una"],
    la: []
  };
  function normalize(s) {
    return String(s == null ? "" : s).normalize("NFC").toLowerCase()
      .replace(/[’‘`´]/g, "'").replace(/[“”„«»]/g, '"')
      .replace(/\s+/g, " ").trim()
      .replace(/^["']+|["']+$/g, "").replace(/[.!?;:,]+$/g, "").trim();
  }
  const stripAccents = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
  function splitArticle(s, lang) {
    const list = (ARTICLES[lang] || []).slice().sort((a, b) => b.length - a.length);
    for (const a of list) {
      if (a.endsWith("'")) { if (s.startsWith(a)) return { article: a, rest: s.slice(a.length).trim() }; }
      else if (s.startsWith(a + " ")) return { article: a, rest: s.slice(a.length + 1).trim() };
    }
    if (lang === "en" && s.startsWith("to ")) return { article: "to", rest: s.slice(3).trim(), optional: true };
    return { article: "", rest: s };
  }
  // Mögliche richtige Antworten aus der gespeicherten Übersetzung + Alternativen
  function answerVariants(translation, alternatives) {
    const raw = [translation].concat(alternatives || []).filter(Boolean).join(";");
    const parts = raw.split(/\s*[;|\/]\s*|,\s+(?![^(]*\))/).map(x => x.trim()).filter(Boolean);
    const out = new Set();
    parts.forEach(p => {
      out.add(normalize(p));
      if (/\(.*\)/.test(p)) {
        out.add(normalize(p.replace(/\s*\([^)]*\)\s*/g, " ")));          // Klammer optional
        out.add(normalize(p.replace(/[()]/g, "")));                       // Klammerinhalt mitgeschrieben
      }
    });
    out.delete("");
    return [...out];
  }
  function levenshtein(a, b) {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  /**
   * Prüft eine Freitext-Antwort.
   * verdict: "correct" | "almost" (zählt als richtig, mit Hinweis) | "wrong"
   * Bewusst NICHT tolerant bei falschem Artikel (Genus-Fehler) oder anderen Wörtern.
   */
  function checkAnswer(given, expectedList, lang) {
    const g = normalize(given);
    const variants = (expectedList || []).map(normalize).filter(Boolean);
    if (!g) return { verdict: "wrong", note: "Keine Antwort", expected: variants[0] || "" };
    let best = null;
    const consider = (verdict, v, note) => { const rank = { correct: 3, almost: 2, wrong: 1 }[verdict]; if (!best || rank > best.rank) best = { verdict, matched: v, note, rank }; };
    for (const v of variants) {
      if (g === v) { consider("correct", v); continue; }
      const ga = splitArticle(g, lang), va = splitArticle(v, lang);
      if (ga.rest === va.rest) {
        if (va.optional || ga.optional) consider("correct", v);
        else if (va.article && !ga.article) consider("almost", v, "Achte auf den Artikel: " + v);
        else if (!va.article && ga.article) consider("correct", v);
        else consider("wrong", v, "Falscher Artikel – richtig ist „" + v + "“");
        continue;
      }
      if (stripAccents(g) === stripAccents(v)) { consider("almost", v, "Achte auf die Akzente: " + v); continue; }
      const len = Math.max(g.length, v.length);
      const tol = len >= 10 ? 2 : len >= 5 ? 1 : 0;
      if (tol && levenshtein(stripAccents(ga.rest), stripAccents(va.rest)) <= tol && ga.article === va.article) consider("almost", v, "Kleiner Tippfehler – richtig: " + v);
    }
    if (!best || best.verdict === "wrong") return { verdict: "wrong", note: best && best.note || "", expected: variants[0] || "" };
    return { verdict: best.verdict, note: best.note || "", expected: best.matched };
  }

  /* ===================================================================
     2. SPACED REPETITION
     Neu → 1 Tag → 3 Tage → Intervall × Leichtigkeit (ease, 1,3–3,0).
     Falsch: Intervall zurück auf 0, in 10 Minuten wieder fällig.
     Fast richtig (Akzent/Artikel/Tippfehler): kleiner Fortschritt.
     =================================================================== */
  const SRS = { minEase: 1.3, maxEase: 3.0, againMinutes: 10, newPerSession: 10, secureFrom: 60 };
  // Lernstand einer Karte aus ihrem Intervall – nachvollziehbare Stufen
  const MASTERY_STEPS = [[0, 0], [1, 20], [3, 40], [7, 60], [14, 75], [30, 90], [60, 100]];
  function masteryFromInterval(days) {
    if (!(days > 0)) return 0;
    for (let i = 1; i < MASTERY_STEPS.length; i++) {
      const [d1, m1] = MASTERY_STEPS[i - 1], [d2, m2] = MASTERY_STEPS[i];
      if (days <= d2) return Math.round(m1 + (m2 - m1) * (days - d1) / (d2 - d1));
    }
    return 100;
  }
  const difficultyFromEase = ease => ease < 1.8 ? 3 : ease < 2.4 ? 2 : 1;
  function srsSchedule(card, verdict, now) {
    const reps = +card.reps || 0, ease = +card.ease || 2.5, prev = +card.interval_days || 0;
    let nReps, nInt, nEase = ease, lapses = +card.lapses || 0, next;
    if (verdict === "wrong") {
      nReps = 0; nInt = 0; nEase = Math.max(SRS.minEase, ease - 0.2); lapses += 1;
      next = now + SRS.againMinutes * MIN;
    } else {
      nReps = reps + 1;
      if (verdict === "almost") {
        nEase = Math.max(SRS.minEase, ease - 0.15);
        nInt = nReps === 1 ? 1 : nReps === 2 ? 2 : Math.max(prev + 1, round1(prev * 1.2));
      } else {
        nEase = Math.min(SRS.maxEase, ease + 0.05);
        nInt = nReps === 1 ? 1 : nReps === 2 ? 3 : Math.max(prev + 1, round1(prev * ease));
      }
      nInt = Math.min(nInt, 365);
      next = startOfDay(now) + Math.round(nInt) * DAY;   // ganzer Tag verfügbar
    }
    return {
      reps: nReps, interval_days: nInt, ease: Math.round(nEase * 100) / 100, lapses,
      next_review_at: new Date(next).toISOString(), last_reviewed_at: new Date(now).toISOString(),
      last_result: verdict,
      correct_count: (+card.correct_count || 0) + (verdict === "wrong" ? 0 : 1),
      incorrect_count: (+card.incorrect_count || 0) + (verdict === "wrong" ? 1 : 0),
      mastery: masteryFromInterval(nInt), difficulty: difficultyFromEase(nEase)
    };
  }
  const isNew = c => !(+c.reps) && !c.last_reviewed_at;
  const isDue = (c, now) => !isNew(c) && (!c.next_review_at || toMs(c.next_review_at) <= now);
  const isTrouble = c => c.last_result === "wrong" || ((+c.incorrect_count || 0) > 0 && (+c.mastery || 0) < SRS.secureFrom);
  /**
   * Reihenfolge einer Vokabel-Session:
   *   1. fällige Karten, zuletzt falsche zuerst, dann am längsten überfällig
   *   2. neue Karten (höchstens newLimit)
   * mode "errors": nur Karten mit Schwierigkeiten, die meisten Fehler zuerst.
   */
  function buildVocabQueue(cards, opts) {
    const o = Object.assign({ limit: 20, newLimit: SRS.newPerSession, mode: "review", now: Date.now() }, opts);
    if (o.mode === "errors") {
      return cards.filter(isTrouble).sort((a, b) => ((b.last_result === "wrong") - (a.last_result === "wrong")) || ((+b.incorrect_count || 0) - (+a.incorrect_count || 0))).slice(0, o.limit);
    }
    const due = cards.filter(c => isDue(c, o.now)).sort((a, b) => ((b.last_result === "wrong") - (a.last_result === "wrong")) || (toMs(a.next_review_at) || 0) - (toMs(b.next_review_at) || 0));
    const fresh = cards.filter(isNew).slice(0, o.newLimit);
    let q = due.concat(fresh).slice(0, o.limit);
    if (!q.length && o.allowAhead) q = cards.filter(c => !isNew(c)).sort((a, b) => (toMs(a.next_review_at) || 0) - (toMs(b.next_review_at) || 0)).slice(0, o.limit);
    return q;
  }
  /* ---------- Vokabeltest (fester Termin) ----------
     „Sitzt“ = mindestens 2× hintereinander richtig und zuletzt nicht falsch.
     Neue Karten werden auf die Tage bis zum Vortag verteilt; der letzte
     Tag vor dem Test (und der Testtag) ist Wiederholung aller Karten. */
  const TEST_SECURE_REPS = 2;
  const isTestSecure = c => (+c.reps || 0) >= TEST_SECURE_REPS && c.last_result !== "wrong";
  function testStatus(cards) {
    const s = { total: cards.length, secure: 0, seen: 0, unseen: 0, wrong: 0, score: null };
    cards.forEach(c => { if (isNew(c)) s.unseen++; else s.seen++; if (isTestSecure(c)) s.secure++; if (c.last_result === "wrong") s.wrong++; });
    if (s.seen) s.score = Math.round(s.secure / s.total * 100);
    return s;
  }
  /** daysLeft = Tage bis zum Test (0 = heute) → neue Karten für heute */
  function testNewQuota(unseen, daysLeft) {
    if (unseen <= 0) return 0;
    const d = Math.max(0, daysLeft);
    return d <= 1 ? unseen : Math.ceil(unseen / (d - 1));
  }
  function testQueue(cards, o) {
    const now = o.now != null ? o.now : Date.now(); const days = Math.max(0, o.daysLeft);
    const fresh = cards.filter(isNew);
    const due = cards.filter(c => isDue(c, now)).sort((a, b) => ((b.last_result === "wrong") - (a.last_result === "wrong")) || (toMs(a.next_review_at) || 0) - (toMs(b.next_review_at) || 0));
    let q = due.concat(fresh.slice(0, testNewQuota(fresh.length, days)));
    if (days <= 1) {
      // Letzter Tag: jede Karte, die heute noch nicht dran war – unsichere zuerst
      const today = startOfDay(now);
      const rest = cards.filter(c => !isNew(c) && !q.includes(c) && !(c.last_reviewed_at && toMs(c.last_reviewed_at) >= today))
        .sort((a, b) => isTestSecure(a) - isTestSecure(b));
      q = q.concat(rest);
    }
    return o.limit ? q.slice(0, o.limit) : q;
  }
  /** Nächste Wiederholung spätestens am Tag vor dem Test (frühestens morgen) */
  function testCap(nextIso, testDay, now) {
    const cap = Math.max(startOfDay(now) + DAY, startOfDay(toMs(testDay)) - DAY);
    return toMs(nextIso) > cap ? new Date(cap).toISOString() : nextIso;
  }
  /** Eingefügte Liste → [{begriff, bedeutung}]; Trenner: Tab, „ = “, „;“, „ - “, „ – “, „ — “, „ : “ */
  function parseVocabList(text) {
    const items = [], skipped = [];
    String(text || "").split(/\r?\n/).forEach(line => {
      const l = line.replace(/^\s*(?:\d+[.)]|[•·*-])\s+/, "").trim(); if (!l) return;
      const m = l.match(/^(.+?)(?:\t+|\s+=\s+|\s*;\s*|\s+[-–—]\s+|\s+:\s+)(.+)$/);
      if (!m || !m[1].trim() || !m[2].trim()) { skipped.push(l); return; }
      items.push({ begriff: m[1].trim(), bedeutung: m[2].trim() });
    });
    return { items, skipped };
  }
  function vocabStats(cards, now) {
    const s = { total: cards.length, due: 0, fresh: 0, learning: 0, secure: 0, mastered: 0, trouble: 0, mastery: 0 };
    let sum = 0;
    cards.forEach(c => {
      const m = +c.mastery || 0; sum += m;
      if (isNew(c)) s.fresh++; else if (m >= 90) { s.mastered++; s.secure++; } else if (m >= SRS.secureFrom) s.secure++; else s.learning++;
      if (isDue(c, now)) s.due++;
      if (isTrouble(c)) s.trouble++;
    });
    s.mastery = cards.length ? Math.round(sum / cards.length) : 0;
    return s;
  }

  /* ===================================================================
     3. TRAININGS-SESSION
     Zeit wird IMMER aus Zeitstempeln berechnet (kein Herunterzählen):
       vergangen = jetzt − Start − Pausensumme − (laufende Pause)
       verbleibend = Zeitlimit − vergangen
     =================================================================== */
  const STATUSES = ["idle", "active", "paused", "completed", "abandoned"];
  function createSession(o) {
    const now = o.now != null ? o.now : Date.now();
    return {
      id: o.id || uuid(), v: 3, mode: o.mode, status: "active", label: o.label || "", href: o.href || "",
      scope: Object.assign({ subject: null, exam_id: null, topic_id: null, subtopic_id: null, collection_id: null }, o.scope || {}),
      direction: o.direction || null, items: o.items || [], index: 0, answers: [],
      started_at: now, paused_at: null, paused_ms: 0, completed_at: null,
      time_limit_s: o.timeLimitS || null, hints: o.hints !== false, feedback: o.feedback !== false
    };
  }
  function elapsedMs(s, now) {
    if (!s) return 0;
    const end = s.completed_at || now;
    const pausedRunning = s.status === "paused" && s.paused_at ? Math.max(0, end - s.paused_at) : 0;
    return Math.max(0, end - s.started_at - (s.paused_ms || 0) - pausedRunning);
  }
  function remainingMs(s, now) { return s && s.time_limit_s ? Math.max(0, s.time_limit_s * 1000 - elapsedMs(s, now)) : null; }
  const isExpired = (s, now) => !!(s && s.time_limit_s && s.status === "active" && remainingMs(s, now) <= 0);
  function pause(s, now) { if (s.status === "active") { s.status = "paused"; s.paused_at = now; } return s; }
  function resume(s, now) { if (s.status === "paused") { s.paused_ms = (s.paused_ms || 0) + Math.max(0, now - (s.paused_at || now)); s.paused_at = null; s.status = "active"; } return s; }
  function finish(s, now, status) {
    if (s.status === "completed" || s.status === "abandoned") return s;
    if (s.status === "paused") resume(s, now);
    // Bei abgelaufenem Zeitlimit endet die Zeit am Limit, nicht beim späten Klick
    const end = s.time_limit_s ? Math.min(now, s.started_at + (s.paused_ms || 0) + s.time_limit_s * 1000) : now;
    s.completed_at = end; s.status = status || "completed"; return s;
  }
  const current = s => s.items[s.index] || null;
  /** answer: { result 0..1, verdict, given, ... } – nur der erste Versuch je Aufgabe zählt für die Auswertung */
  function recordAnswer(s, answer, now) {
    const item = current(s); if (!item) return s;
    s.answers.push(Object.assign({ index: s.index, key: item.key, kind: item.kind, retry: !!item.retry, at: now }, answer));
    return s;
  }
  function requeue(s, gap) {
    const item = current(s); if (!item || item.retry) return s;
    const pos = Math.min(s.items.length, s.index + 1 + (gap || 4));
    s.items.splice(pos, 0, Object.assign({}, item, { retry: true }));
    return s;
  }
  function advance(s) { s.index = Math.min(s.items.length, s.index + 1); return s; }
  function summary(s, now) {
    const first = s.answers.filter(a => !a.retry);
    const graded = first.filter(a => a.result != null);
    const score = graded.length ? graded.reduce((x, a) => x + a.result, 0) / graded.length : null;
    return {
      total: s.items.filter(i => !i.retry).length, answered: first.length, graded: graded.length,
      correct: graded.filter(a => a.result >= 0.75).length, partial: graded.filter(a => a.result > 0.25 && a.result < 0.75).length,
      wrong: graded.filter(a => a.result <= 0.25).length,
      score: score == null ? null : Math.round(score * 1000) / 1000,
      activeSeconds: Math.round(elapsedMs(s, now) / 1000)
    };
  }

  /* ===================================================================
     4. LERNSTAND (MASTERY)
     Unterthema = gewichteter Durchschnitt der letzten 12 Ergebnisse
       • neuere Ergebnisse zählen mehr (Faktor 0,8 je Schritt zurück)
       • schwere Übungen zählen mehr (0,8 / 1 / 1,25)
       • Prüfungssimulation ×1,5, KI-Korrektur ×1,2, Selbsteinschätzung ×0,6
     × Sicherheit der Einschätzung: unter 4 Versuchen anteilig (1/4 … 4/4)
     × Vergessen: ab 4 Tagen ohne Übung −2 % pro Tag, höchstens −30 %
     =================================================================== */
  const MASTERY = { window: 12, recency: 0.8, minAttempts: 4, decayAfterDays: 3, decayPerDay: 0.02, maxDecay: 0.3,
    typeWeight: { exam_result: 1.5, ai_feedback: 1.2, self_assessment: 0.6, exercise_correct: 1, exercise_wrong: 1 },
    diffWeight: { 1: 0.8, 2: 1, 3: 1.25 } };
  const MASTERY_TYPES = Object.keys(MASTERY.typeWeight);
  function subtopicMastery(events, now) {
    const ev = (events || []).filter(e => MASTERY_TYPES.includes(e.type) && e.result != null)
      .sort((a, b) => toMs(b.created_at) - toMs(a.created_at));
    const recentErrors = ev.filter(e => (+e.result) < 0.5 && now - toMs(e.created_at) <= 14 * DAY).length;
    if (!ev.length) return { score: null, attempts: 0, recentErrors: 0, lastAt: null, daysSince: null, explanation: ["Noch keine Übung zu diesem Unterthema."] };
    const win = ev.slice(0, MASTERY.window);
    let sw = 0, s = 0;
    win.forEach((e, i) => { const w = Math.pow(MASTERY.recency, i) * (MASTERY.diffWeight[e.difficulty] || 1) * (MASTERY.typeWeight[e.type] || 1); sw += w; s += w * clamp(+e.result, 0, 1); });
    const base = s / sw;
    const confidence = Math.min(1, ev.length / MASTERY.minAttempts);
    const lastAt = toMs(ev[0].created_at);
    const daysSince = daysBetween(lastAt, now);
    const decay = daysSince > MASTERY.decayAfterDays ? Math.min(MASTERY.maxDecay, (daysSince - MASTERY.decayAfterDays) * MASTERY.decayPerDay) : 0;
    const score = Math.round(100 * base * confidence * (1 - decay));
    const explanation = ["Ø deiner letzten " + win.length + " Ergebnisse: " + Math.round(base * 100) + " %"];
    if (confidence < 1) explanation.push("Erst " + ev.length + (ev.length === 1 ? " Übung" : " Übungen") + " – vorsichtige Einschätzung (×" + confidence.toFixed(2).replace(".", ",") + ")");
    if (decay > 0) explanation.push(daysSince + " Tage nicht geübt – −" + Math.round(decay * 100) + " %");
    return { score, attempts: ev.length, recentErrors, lastAt, daysSince, base, confidence, decay, explanation };
  }
  const PRIORITY_WEIGHT = { 1: 0.75, 2: 1, 3: 1.3 };
  /**
   * Prüfungsbereitschaft = gewichteter Ø aller Unterthemen der Prüfung
   * (Unterthemen ohne Übung zählen mit 0 %), Gewicht = Priorität des Themas.
   * Ohne eine einzige Übung: null → „noch nicht genug Daten“.
   */
  function examReadiness(subs, masteryOf, extra) {
    const parts = [];
    subs.forEach(x => parts.push({ w: PRIORITY_WEIGHT[x.priority] || 1, m: masteryOf(x.id) }));
    (extra || []).forEach(x => parts.push({ w: 1, m: x }));   // z. B. gekoppelte Vokabel-Sammlungen
    const withData = parts.filter(p => p.m != null).length;
    if (!parts.length || !withData) return { score: null, coverage: 0, withData, total: parts.length };
    const sw = parts.reduce((a, p) => a + p.w, 0);
    const score = Math.round(parts.reduce((a, p) => a + p.w * (p.m || 0), 0) / sw);
    return { score, coverage: withData / parts.length, withData, total: parts.length };
  }

  /* ===================================================================
     5. LERNPLAN
     Priorität eines Unterthemas =
       (Bedarf·0,6 + Fehler + Pause + fehlende Daten) × Dringlichkeit × Relevanz
       Bedarf       = 1 − Lernstand
       Fehler       = 0,06 je Fehler der letzten 14 Tage (max. 0,3)
       Pause        = länger nicht geübt (max. 0,2), nie geübt 0,15
       Dringlichkeit= 1 / (1 + Tage bis Prüfung / 7)
       Relevanz     = Priorität des Themas × Schwierigkeit
     Heute schon ≥ 10 Minuten geübt → ×0,4 (Abwechslung).
     =================================================================== */
  const DIFF_WEIGHT = { 1: 0.9, 2: 1, 3: 1.1 };
  function prioritize(o) {
    const now = o.now, out = [];
    (o.subtopics || []).forEach(st => {
      const tp = o.topicById(st.topic_id); if (!tp || tp.status === "done" || tp.status === "paused") return;
      const ex = tp.exam_id != null ? o.examById(tp.exam_id) : null;
      let days = null;
      if (ex) { if (ex.punkte != null) return; days = daysBetween(now, toMs(ex.datum + "T00:00:00")); if (days < 0 || days > 60) return; }
      const m = o.masteryOf(st.id) || { score: null, attempts: 0, recentErrors: 0 };
      const need = 1 - (m.score == null ? 0 : m.score / 100);
      const errors = Math.min(0.3, 0.06 * (m.recentErrors || 0));
      const stale = m.daysSince == null ? 0.15 : Math.min(0.2, Math.max(0, m.daysSince - 4) * 0.02);
      const lowEvidence = (m.attempts || 0) < 2 ? 0.1 : 0;
      const urgency = days == null ? 0.25 : 1 / (1 + days / 7);
      const relevance = (PRIORITY_WEIGHT[tp.priority] || 1) * (DIFF_WEIGHT[st.difficulty] || 1);
      const today = o.minutesToday ? o.minutesToday(st.id) : 0;
      let score = (need * 0.6 + errors + stale + lowEvidence) * urgency * relevance;
      if (today >= 10) score *= 0.4;
      const reasons = [];
      if (days != null) reasons.push(days === 0 ? "Prüfung heute" : days === 1 ? "Prüfung morgen" : "Prüfung in " + days + " Tagen");
      reasons.push(m.score == null ? "noch nicht geübt" : "Lernstand " + m.score + " %");
      if (m.recentErrors) reasons.push(m.recentErrors + (m.recentErrors === 1 ? " Fehler" : " Fehler") + " zuletzt");
      if (m.daysSince != null && m.daysSince >= 5) reasons.push(m.daysSince + " Tage nicht geübt");
      if (tp.priority === 3) reasons.push("hohe Priorität");
      out.push({ subtopic: st, topic: tp, exam: ex, days, mastery: m.score, score: Math.round(score * 1000) / 1000, reasons });
    });
    return out.sort((a, b) => b.score - a.score);
  }
  /**
   * Tagesplan im Zeitbudget: zuerst fällige Vokabeln (≈ 0,4 Min. je Karte,
   * 5–15 Min.), dann die wichtigsten Unterthemen (10 Min., kurz vor der
   * Prüfung 15 Min.), dann Fehlertraining, falls Zeit bleibt.
   */
  function dailyPlan(o) {
    const budget = o.budgetMin || 30; let left = budget; const items = [];
    const dueTotal = (o.vocabDue || []).reduce((a, x) => a + x.count, 0);
    const fresh = Math.min(SRS.newPerSession, o.vocabNew || 0);
    if (dueTotal + fresh > 0) {
      const top = (o.vocabDue || []).slice().sort((a, b) => b.count - a.count);
      const min = clamp(Math.ceil(dueTotal * 0.4 + fresh * 0.6), 5, 15);
      const title = dueTotal ? plural(dueTotal, "fällige Vokabel", "fällige Vokabeln") + (fresh ? " + " + fresh + " neue" : "") : plural(fresh, "neue Vokabel", "neue Vokabeln");
      items.push({ key: "vocab", kind: "vocab", minutes: min, title, sub: top.length ? top.slice(0, 2).map(x => x.name + " (" + x.count + ")").join(" · ") : "Neue Karten kennenlernen", reasons: [dueTotal ? "Wiederholung nach Plan" : "Neue Karten"] });
      left -= min;
    }
    for (const p of (o.priorities || [])) {
      if (left < 5 || items.filter(i => i.kind === "subtopic").length >= 4) break;
      if (p.score < 0.05) break;
      const min = Math.min(left, p.days != null && p.days <= 3 ? 15 : 10);
      items.push({ key: "st:" + p.subtopic.id, kind: "subtopic", minutes: min, title: p.subtopic.title, sub: (p.exam ? p.exam.fach + " · " : "") + p.topic.title, reasons: p.reasons, ref: p });
      left -= min;
    }
    if (left >= 5 && (o.troubleCount || 0) > 0) items.push({ key: "errors", kind: "errors", minutes: Math.min(10, left), title: "Fehlertraining", sub: plural(o.troubleCount, "Aufgabe mit Fehlern", "Aufgaben mit Fehlern"), reasons: ["Fehler gezielt wiederholen"] });
    return { budget, planned: items.reduce((a, i) => a + i.minutes, 0), items };
  }
  function plural(n, s, p) { return n + " " + (n === 1 ? s : p); }

  /* ===================================================================
     6. ÜBUNGEN
     =================================================================== */
  const HINT_PENALTY = 0.15;
  const withHints = (result, hints) => Math.max(0, Math.round((result * (1 - HINT_PENALTY * (hints || 0))) * 1000) / 1000);
  /** Automatisch prüfbare Übungen. Freitext/Schreiben → null (KI oder Selbsteinschätzung). */
  function checkExercise(ex, answer) {
    if (ex.type === "multiple_choice") {
      const ok = +answer === +ex.correct_index;
      return { result: ok ? 1 : 0, verdict: ok ? "correct" : "wrong", expected: (ex.options || [])[ex.correct_index] };
    }
    if (ex.type === "matching") {
      const pairs = ex.options || []; if (!pairs.length) return { result: null };
      let right = 0; pairs.forEach((p, i) => { if (answer && answer[i] === i) right++; });
      const r = right / pairs.length;
      return { result: Math.round(r * 1000) / 1000, verdict: r === 1 ? "correct" : r >= 0.5 ? "almost" : "wrong", right, total: pairs.length };
    }
    if (ex.type === "translation" && ex.expected_answer) {
      const c = checkAnswer(answer, answerVariants(ex.expected_answer), ex.lang || null);
      if (c.verdict !== "wrong") return { result: c.verdict === "correct" ? 1 : 0.75, verdict: c.verdict, note: c.note, expected: c.expected };
      return { result: null, verdict: "unsure", expected: ex.expected_answer };   // längere Sätze: nicht automatisch als falsch werten
    }
    return { result: null, verdict: "open" };
  }
  // Vokabel-Übungsformen
  function vocabSides(card, direction) {
    const fwd = direction !== "reverse";
    return { prompt: fwd ? card.begriff : card.bedeutung, answer: fwd ? card.bedeutung : card.begriff,
      answers: fwd ? answerVariants(card.bedeutung, card.alternatives) : answerVariants(card.begriff),
      lang: fwd ? (card.target_language || "de") : (card.source_language || "fr") };
  }
  function makeMC(card, pool, direction, rng) {
    const s = vocabSides(card, direction);
    const others = shuffle(pool.filter(c => c.id !== card.id && normalize(vocabSides(c, direction).answer) !== normalize(s.answer)), rng).slice(0, 3).map(c => vocabSides(c, direction).answer);
    if (others.length < 2) return null;
    const options = shuffle(others.concat([s.answer]), rng);
    return { kind: "vocab_mc", key: "vmc:" + card.id, vocab_id: card.id, prompt: s.prompt, options, correct_index: options.indexOf(s.answer), direction };
  }
  function makeMatching(cards, direction, rng) {
    if (cards.length < 3) return null;
    const pairs = cards.slice(0, 5).map(c => { const s = vocabSides(c, direction); return [s.prompt, s.answer]; });
    return { kind: "vocab_match", key: "vm:" + cards.map(c => c.id).join(","), vocab_ids: cards.slice(0, 5).map(c => c.id), pairs, order: shuffle(pairs.map((_, i) => i), rng), direction };
  }
  // Übungsvorlagen, wenn ein Unterthema (noch) keine gespeicherten Übungen hat
  const TEMPLATES = [
    ["free_text", 1, "Erkläre in eigenen Worten, worum es bei „{s}“ geht."],
    ["free_text", 2, "Nenne drei typische Merkmale von „{s}“ und gib zu jedem ein Beispiel."],
    ["free_text", 2, "Welche Fehler passieren bei „{s}“ häufig – und wie vermeidest du sie?"],
    ["short_writing", 3, "Schreibe einen kurzen Abschnitt (ca. 150 Wörter), in dem du „{s}“ gezielt einsetzt."]
  ];
  function templateItems(st, topic) {
    return TEMPLATES.map((t, i) => ({ kind: "exercise", key: "tpl:" + st.id + ":" + i, template: true, subtopic_id: st.id, topic_id: topic && topic.id,
      exercise: { id: null, type: t[0], difficulty: t[1], question: t[2].replace(/\{s\}/g, st.title), subtopic_id: st.id } }));
  }
  function exerciseItem(ex, st, topic) { return { kind: "exercise", key: "ex:" + ex.id, subtopic_id: st.id, topic_id: topic && topic.id, exercise: ex }; }
  /** Übungen eines Unterthemas: gespeicherte zuerst (zuletzt falsche vorn), aufgefüllt mit Vorlagen */
  function buildTopicItems(st, topic, exercises, lastResultOf, max) {
    const own = exercises.filter(e => e.subtopic_id === st.id)
      .sort((a, b) => ((lastResultOf(a.id) ?? 2) - (lastResultOf(b.id) ?? 2)))
      .map(e => exerciseItem(e, st, topic));
    const items = own.concat(own.length >= 3 ? [] : templateItems(st, topic).slice(0, Math.max(1, 3 - own.length)));
    return items.slice(0, max || 6);
  }
  /** Gemischtes Training: Vokabeln in drei Formen + Übungen, abwechselnd */
  function buildMixedItems(o) {
    const rng = o.rng || Math.random; const dir = o.direction || "forward";
    const cards = o.cards || [];
    const v = [];
    const typed = cards.slice(0, 6), mcPool = o.pool || cards;
    typed.forEach((c, i) => {
      if (i % 3 === 1) { const mc = makeMC(c, mcPool, dir, rng); if (mc) { v.push(mc); return; } }
      v.push({ kind: "vocab", key: "v:" + c.id, vocab_id: c.id, direction: dir });
    });
    const match = makeMatching(cards.slice(6, 11).length >= 3 ? cards.slice(6, 11) : cards.slice(0, 5), dir, rng);
    if (match) v.push(match);
    const ex = (o.exerciseItems || []).slice(0, 6);
    const out = []; const n = Math.max(v.length, ex.length);
    for (let i = 0; i < n; i++) { if (v[i]) out.push(v[i]); if (ex[i]) out.push(ex[i]); }
    return out;
  }
  /** Prüfungsmodus: Übungen über die schwächsten Unterthemen verteilt */
  function buildExamItems(o) {
    const per = {}; const out = [];
    const ordered = o.priorities.length ? o.priorities.map(p => p.subtopic) : o.subtopics;
    for (let round = 0; round < 3 && out.length < (o.count || 8); round++) {
      for (const st of ordered) {
        if (out.length >= (o.count || 8)) break;
        const list = o.itemsFor(st); const i = per[st.id] || 0;
        if (list[i]) { out.push(Object.assign({}, list[i], { key: list[i].key + ":exam" })); per[st.id] = i + 1; }
      }
    }
    return out;
  }

  /* ===================================================================
     7. KENNZAHLEN
     =================================================================== */
  /** Tage in Folge mit Lernaktivität (heute zählt, wenn schon gelernt; sonst ab gestern) */
  /** Sprache einer Sammlung aus ihrem Namen raten (nur für Altdaten ohne Sprachangabe) */
  function guessLanguage(name) {
    const s = String(name || "").toLowerCase();
    if (/le[çc]on|unit[ée](?=\s|\d|$)|fran[çc]/.test(s)) return "fr";
    if (/^unit(?=\s|\d|$)|engl/.test(s)) return "en";
    if (/latein|lectio/.test(s)) return "la";
    if (/span|lecci[óo]n/.test(s)) return "es";
    return null;
  }
  function streak(activeDays, now) {
    const set = activeDays instanceof Set ? activeDays : new Set(activeDays);
    let d = startOfDay(now); if (!set.has(isoDay(d))) d -= DAY;
    let n = 0; while (set.has(isoDay(d))) { n++; d -= DAY; }
    return n;
  }
  function milestones(o) {
    const out = [];
    if (o.streak >= 7) out.push({ key: "streak7", title: o.streak + " Tage in Folge gelernt" });
    [500, 250, 100, 50].some(n => { if (o.secureVocab >= n) { out.push({ key: "vocab" + n, title: n + " Vokabeln sicher gelernt" }); return true; } return false; });
    [20, 10, 5].some(n => { if (o.hoursTotal >= n) { out.push({ key: "hours" + n, title: n + " Stunden konzentriert gelernt" }); return true; } return false; });
    return out;
  }

  return {
    DAY, uuid, shuffle, isoDay, startOfDay, daysBetween,
    LANG_NAMES, normalize, stripAccents, answerVariants, levenshtein, checkAnswer,
    SRS, masteryFromInterval, srsSchedule, isNew, isDue, isTrouble, buildVocabQueue, vocabStats,
    isTestSecure, testStatus, testNewQuota, testQueue, testCap, parseVocabList,
    STATUSES, createSession, elapsedMs, remainingMs, isExpired, pause, resume, finish, current, recordAnswer, requeue, advance, summary,
    MASTERY, subtopicMastery, examReadiness,
    prioritize, dailyPlan,
    HINT_PENALTY, withHints, checkExercise, vocabSides, makeMC, makeMatching, TEMPLATES, templateItems, exerciseItem, buildTopicItems, buildMixedItems, buildExamItems,
    streak, milestones, guessLanguage
  };
});
