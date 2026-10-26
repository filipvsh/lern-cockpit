// Unit-Tests der Lern-Engine · Ausführen: node --test tests/engine.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");

const NOW = new Date("2026-10-02T18:00:00").getTime();
const DAY = E.DAY;

/* ---------- Antwortprüfung ---------- */
test("Antwort: Groß-/Kleinschreibung, Leerzeichen, Satzzeichen egal", () => {
  const v = E.answerVariants("Guten Tag");
  assert.equal(E.checkAnswer("  guten   TAG. ", v, "de").verdict, "correct");
});
test("Antwort: akzeptierte Alternativen (Komma, Semikolon, Schrägstrich, Alternativen-Feld)", () => {
  const v = E.answerVariants("gelingen, schaffen; erfolgreich sein", ["hinkriegen"]);
  for (const a of ["gelingen", "schaffen", "erfolgreich sein", "hinkriegen"]) assert.equal(E.checkAnswer(a, v, "de").verdict, "correct", a);
  assert.equal(E.checkAnswer("versuchen", v, "de").verdict, "wrong");
});
test("Antwort: Klammerinhalt ist optional", () => {
  const v = E.answerVariants("die Zukunft (Zeit)");
  assert.equal(E.checkAnswer("die Zukunft", v, "de").verdict, "correct");
  assert.equal(E.checkAnswer("die Zukunft Zeit", v, "de").verdict, "correct");
});
test("Antwort: fehlender deutscher Artikel = fast richtig, falscher französischer Artikel = falsch", () => {
  assert.equal(E.checkAnswer("Zukunft", E.answerVariants("die Zukunft"), "de").verdict, "almost");
  assert.equal(E.checkAnswer("le gare", E.answerVariants("la gare"), "fr").verdict, "wrong");
  assert.equal(E.checkAnswer("la gare", E.answerVariants("la gare"), "fr").verdict, "correct");
});
test("Antwort Französisch: Artikel fehlt = falsch, gleiches Geschlecht (une/la, un/le, des/les) = richtig", () => {
  assert.equal(E.checkAnswer("casquette", E.answerVariants("une casquette"), "fr").verdict, "wrong");
  assert.equal(E.checkAnswer("la casquette", E.answerVariants("une casquette"), "fr").verdict, "correct");
  assert.equal(E.checkAnswer("le casquette", E.answerVariants("une casquette"), "fr").verdict, "wrong");
  assert.equal(E.checkAnswer("le short", E.answerVariants("un short"), "fr").verdict, "correct");
  assert.equal(E.checkAnswer("les chaussures", E.answerVariants("des chaussures"), "fr").verdict, "correct");
  assert.equal(E.checkAnswer("un anorak", E.answerVariants("l'anorak"), "fr").verdict, "correct");
  assert.equal(E.checkAnswer("des anorak", E.answerVariants("l'anorak"), "fr").verdict, "wrong");
});
test("Antwort: englisches „to“ beim Verb ist optional", () => {
  assert.equal(E.checkAnswer("resolve", E.answerVariants("to resolve"), "en").verdict, "correct");
});
test("Antwort: fehlende Akzente und kleine Tippfehler = fast richtig", () => {
  assert.equal(E.checkAnswer("reussir", E.answerVariants("réussir"), "fr").verdict, "almost");
  assert.equal(E.checkAnswer("Bahnhoof", E.answerVariants("der Bahnhof"), "de").verdict, "wrong", "Artikel fehlt UND Tippfehler → nicht großzügig");
  assert.equal(E.checkAnswer("der Bahnhoof", E.answerVariants("der Bahnhof"), "de").verdict, "almost");
});
test("Antwort: kurze Wörter ohne Tippfehler-Toleranz, leere Antwort falsch", () => {
  assert.equal(E.checkAnswer("bon", E.answerVariants("bin"), "fr").verdict, "wrong");
  assert.equal(E.checkAnswer("", E.answerVariants("bonjour"), "fr").verdict, "wrong");
});
test("Antwort: typografische Apostrophe werden vereinheitlicht", () => {
  assert.equal(E.checkAnswer("l’avenir", E.answerVariants("l'avenir"), "fr").verdict, "correct");
});

/* ---------- Spaced Repetition ---------- */
test("SRS (FSRS): richtig verlängert die Abstände über die Tage, falsch setzt zurück", () => {
  let c = { reps: 0, interval_days: 0, last_reviewed_at: null };
  let t = NOW; const gaps = [];
  for (let i = 0; i < 4; i++) { c = Object.assign(c, E.srsSchedule(c, "correct", t)); const g = E.calDays(t, new Date(c.next_review_at).getTime()); gaps.push(g); t = new Date(c.next_review_at).getTime() + 9 * 3600e3; }
  assert.ok(gaps.every((g, i) => i === 0 || g > gaps[i - 1]), "wachsende Abstände: " + gaps);
  assert.equal(c.correct_count, 4); assert.equal(c.reps, 4);
  const S = c.interval_days, D = c.ease;
  c = Object.assign(c, E.srsSchedule(c, "wrong", t));
  assert.ok(c.interval_days < S / 2, "Stabilität bricht ein"); assert.ok(c.ease > D, "Wort gilt als schwerer");
  assert.equal(c.reps, 0); assert.equal(c.lapses, 1); assert.equal(c.incorrect_count, 1);
  assert.equal(new Date(c.next_review_at).getTime(), t + 10 * 60000, "falsch → in 10 Minuten wieder fällig");
});
test("SRS: Fälligkeit liegt auf Tagesbeginn, Lernstand folgt der Stabilität", () => {
  const r = E.srsSchedule({ reps: 0, last_reviewed_at: null }, "correct", NOW);
  assert.equal(new Date(r.next_review_at).getHours(), 0);
  assert.equal(r.mastery, E.masteryFromInterval(r.interval_days));
  assert.equal(E.masteryFromInterval(0), 0); assert.equal(E.masteryFromInterval(7), 60); assert.equal(E.masteryFromInterval(90), 100);
  assert.equal(E.stageOf({ reps: 0 }).key, "new");
  assert.equal(E.stageOf(Object.assign({ last_reviewed_at: "x" }, r)).key, "learning");
  assert.equal(E.stageOf({ reps: 5, last_reviewed_at: "x", interval_days: 40, ease: 14, last_result: "correct" }).key, "long");
});
test("SRS: Warteschlange – fällige (zuletzt falsche zuerst) vor neuen, Limit für neue", () => {
  const cards = [
    { id: 1, reps: 2, last_reviewed_at: "x", next_review_at: new Date(NOW - 3 * DAY).toISOString(), last_result: "correct" },
    { id: 2, reps: 0, last_reviewed_at: "x", next_review_at: new Date(NOW - 1 * DAY).toISOString(), last_result: "wrong" },
    { id: 3, reps: 4, last_reviewed_at: "x", next_review_at: new Date(NOW + 5 * DAY).toISOString() },
    ...Array.from({ length: 15 }, (_, i) => ({ id: 10 + i, reps: 0 }))
  ];
  const q = E.buildVocabQueue(cards, { now: NOW, limit: 20 });
  assert.deepEqual(q.slice(0, 2).map(c => c.id), [2, 1]);
  assert.ok(!q.some(c => c.id === 3), "nicht fällige Karte bleibt draußen");
  assert.equal(q.filter(c => c.id >= 10).length, E.SRS.newPerSession);
  const err = E.buildVocabQueue(cards, { now: NOW, mode: "errors" });
  assert.deepEqual(err.map(c => c.id), [2]);
});

/* ---------- Session & Timer ---------- */
test("Timer: zeitbasiert, Pausen zählen nicht, Reload-sicher", () => {
  const s = E.createSession({ mode: "exam", items: [{ key: "a" }, { key: "b" }], timeLimitS: 45 * 60, now: NOW });
  assert.equal(E.remainingMs(s, NOW + 5 * 60000), 40 * 60000);
  E.pause(s, NOW + 5 * 60000);
  assert.equal(E.remainingMs(s, NOW + 30 * 60000), 40 * 60000, "während der Pause steht die Zeit");
  const restored = JSON.parse(JSON.stringify(s));                       // wie nach einem Reload aus localStorage
  E.resume(restored, NOW + 30 * 60000);
  assert.equal(E.remainingMs(restored, NOW + 35 * 60000), 35 * 60000);
  assert.equal(E.isExpired(restored, NOW + 71 * 60000), true);
});
test("Session: Abschluss nach Ablauf endet am Zeitlimit; Auswertung zählt nur erste Versuche", () => {
  const s = E.createSession({ mode: "vocab", items: [{ key: "a", kind: "vocab" }, { key: "b", kind: "vocab" }], timeLimitS: 600, now: NOW });
  E.recordAnswer(s, { result: 0 }, NOW + 1000); E.requeue(s, 1); E.advance(s);
  E.recordAnswer(s, { result: 1 }, NOW + 2000); E.advance(s);
  E.recordAnswer(s, { result: 1 }, NOW + 3000); E.advance(s);   // Wiederholung von a
  assert.equal(s.items.length, 3);
  E.finish(s, NOW + 3600 * 1000);
  const sum = E.summary(s, NOW + 3600 * 1000);
  assert.equal(sum.total, 2); assert.equal(sum.correct, 1); assert.equal(sum.wrong, 1); assert.equal(sum.score, 0.5);
  assert.equal(sum.activeSeconds, 600, "Zeit endet am Limit");
  assert.equal(s.status, "completed");
  E.finish(s, NOW + 7200 * 1000, "abandoned"); assert.equal(s.status, "completed", "abgeschlossene Session bleibt abgeschlossen");
});

/* ---------- Mastery ---------- */
const ev = (daysAgo, result, type = "exercise_correct", difficulty = 2) => ({ type, result, difficulty, created_at: new Date(NOW - daysAgo * DAY).toISOString() });
test("Mastery: ohne Daten null, wenige Versuche vorsichtig, viele Versuche voll", () => {
  assert.equal(E.subtopicMastery([], NOW).score, null);
  assert.equal(E.subtopicMastery([ev(0, 1)], NOW).score, 25);
  assert.equal(E.subtopicMastery([ev(0, 1), ev(0, 1), ev(0, 1), ev(0, 1)], NOW).score, 100);
});
test("Mastery: neuere Ergebnisse zählen mehr", () => {
  const improving = E.subtopicMastery([ev(0, 1), ev(0, 1), ev(1, 0), ev(1, 0)], NOW).score;
  const worsening = E.subtopicMastery([ev(0, 0), ev(0, 0), ev(1, 1), ev(1, 1)], NOW).score;
  assert.ok(improving > 50 && worsening < 50, improving + " / " + worsening);
});
test("Mastery: Vergessen nach Pause, Fehler der letzten 14 Tage gezählt", () => {
  const fresh = E.subtopicMastery([ev(1, 1), ev(1, 1), ev(1, 1), ev(1, 0)], NOW);
  const old = E.subtopicMastery([ev(13, 1), ev(13, 1), ev(13, 1), ev(13, 0)], NOW);
  assert.ok(old.score < fresh.score); assert.ok(old.explanation.some(x => /nicht geübt/.test(x)));
  assert.equal(fresh.recentErrors, 1);
});
test("Bereitschaft: null ohne Übung, sonst gewichteter Ø inkl. ungeübter Themen", () => {
  const subs = [{ id: "a", priority: 2 }, { id: "b", priority: 2 }];
  assert.equal(E.examReadiness(subs, () => null).score, null);
  const r = E.examReadiness(subs, id => id === "a" ? 80 : null);
  assert.equal(r.score, 40); assert.equal(r.withData, 1); assert.equal(r.total, 2);
});

/* ---------- Lernplan ---------- */
test("Planer: schwache Themen der nahen Prüfung vor starken; Prüfungsnähe zählt", () => {
  const exams = { e1: { id: "e1", fach: "Englisch", datum: E.isoDay(NOW + 8 * DAY), punkte: null }, e2: { id: "e2", fach: "Deutsch", datum: E.isoDay(NOW + 40 * DAY), punkte: null } };
  const topics = { t1: { id: "t1", exam_id: "e1", title: "Short Story", priority: 2 }, t2: { id: "t2", exam_id: "e2", title: "Gespräch", priority: 2 } };
  const subs = [{ id: "np", topic_id: "t1", title: "Narrative Perspective", difficulty: 2 }, { id: "str", topic_id: "t1", title: "Structure", difficulty: 2 }, { id: "g", topic_id: "t2", title: "Sprechakte", difficulty: 2 }];
  const m = { np: { score: 42, attempts: 6, recentErrors: 3, daysSince: 1 }, str: { score: 83, attempts: 6, recentErrors: 0, daysSince: 1 }, g: { score: 42, attempts: 6, recentErrors: 3, daysSince: 1 } };
  const p = E.prioritize({ now: NOW, subtopics: subs, topicById: id => topics[id], examById: id => exams[id], masteryOf: id => m[id] });
  const score = id => p.find(x => x.subtopic.id === id).score;
  assert.equal(p[0].subtopic.id, "np", "schwach + nahe Prüfung zuerst");
  assert.ok(score("np") > 2 * score("g"), "gleiche Schwäche, aber Prüfung erst in 40 Tagen → deutlich später");
  assert.ok(score("np") > score("str"), "gleiche Prüfung, sicheres Thema → später");
  assert.ok(p[0].reasons.includes("Prüfung in 8 Tagen"));
});
test("Tagesplan: Budget wird eingehalten, Vokabeln zuerst", () => {
  const pri = [1, 2, 3, 4, 5].map(i => ({ subtopic: { id: "s" + i, title: "S" + i }, topic: { title: "T" }, exam: { fach: "Englisch" }, days: 8, score: 0.5, reasons: [] }));
  const plan = E.dailyPlan({ budgetMin: 30, vocabDue: [{ name: "Unité 4", count: 25 }], priorities: pri, troubleCount: 3 });
  assert.equal(plan.items[0].kind, "vocab"); assert.equal(plan.items[0].minutes, 10);
  assert.ok(plan.planned <= 30, String(plan.planned));
});

/* ---------- Übungen ---------- */
test("Übungen: Multiple Choice, Zuordnung, Übersetzung", () => {
  assert.equal(E.checkExercise({ type: "multiple_choice", options: ["a", "b"], correct_index: 1 }, 1).result, 1);
  assert.equal(E.checkExercise({ type: "matching", options: [["a", "1"], ["b", "2"]] }, [0, 0]).result, 0.5);
  assert.equal(E.checkExercise({ type: "translation", expected_answer: "the house" }, "The house.").result, 1);
  assert.equal(E.checkExercise({ type: "translation", expected_answer: "the house is big" }, "the home is large").result, null, "lange Sätze nicht automatisch als falsch werten");
  assert.equal(E.checkExercise({ type: "free_text" }, "...").result, null);
  assert.equal(E.withHints(1, 2), 0.7);
});
test("Lernrichtung: Abfrage folgt der gewählten Richtung", () => {
  const card = { id: 1, begriff: "bonjour", bedeutung: "guten Tag", source_language: "fr", target_language: "de" };
  assert.equal(E.vocabSides(card, "forward").prompt, "bonjour");
  const rev = E.vocabSides(card, "reverse");
  assert.equal(rev.prompt, "guten Tag"); assert.equal(rev.lang, "fr");
  assert.equal(E.checkAnswer("Bonjour", rev.answers, rev.lang).verdict, "correct");
});
test("Vokabel-Übungsformen: MC enthält genau eine richtige Antwort", () => {
  const pool = ["a", "b", "c", "d", "e"].map((x, i) => ({ id: i, begriff: x, bedeutung: x.toUpperCase() }));
  const mc = E.makeMC(pool[0], pool, "forward", () => 0.3);
  assert.equal(mc.options.length, 4); assert.equal(mc.options[mc.correct_index], "A");
});
test("Sprache aus Sammlungsnamen (Altdaten)", () => {
  assert.equal(E.guessLanguage("Unité 1"), "fr");
  assert.equal(E.guessLanguage("Leçon 3"), "fr");
  assert.equal(E.guessLanguage("Unit 4"), "en");
  assert.equal(E.guessLanguage("Unit4"), "en");
  assert.equal(E.guessLanguage("Englisch"), "en");
  assert.equal(E.guessLanguage("Mathe-Begriffe"), null);
});
test("Streak: zählt Tage in Folge, heute optional", () => {
  const days = [0, 1, 2, 4].map(d => E.isoDay(NOW - d * DAY));
  assert.equal(E.streak(days, NOW), 3);
  assert.equal(E.streak(days.slice(1), NOW), 2);
});

/* ---------- Vokabeltest ---------- */
const tcard = (id, o) => Object.assign({ id, begriff: "w" + id, bedeutung: "b" + id, reps: 0, last_reviewed_at: null, next_review_at: null, last_result: null }, o || {});
test("Vokabeltest: neue Karten werden bis zum Vortag verteilt", () => {
  assert.equal(E.testNewQuota(42, 4), 14);   // Sa–Mo je 14, Di nur Wiederholung
  assert.equal(E.testNewQuota(42, 1), 42);   // morgen Test → alles heute
  assert.equal(E.testNewQuota(42, 0), 42);
  assert.equal(E.testNewQuota(0, 4), 0);
});
test("Vokabeltest: Warteschlange = fällige (falsche zuerst) + Tagesanteil neuer Karten", () => {
  const cards = [];
  for (let i = 0; i < 30; i++) cards.push(tcard(i));
  cards.push(tcard("d1", { reps: 1, last_reviewed_at: NOW - DAY, next_review_at: new Date(NOW - 3600e3).toISOString(), last_result: "correct" }));
  cards.push(tcard("d2", { reps: 0, last_reviewed_at: NOW - DAY, next_review_at: new Date(NOW - 60e3).toISOString(), last_result: "wrong" }));
  cards.push(tcard("later", { reps: 1, last_reviewed_at: NOW - 3600e3, next_review_at: new Date(NOW + DAY).toISOString(), last_result: "correct" }));
  const q = E.testQueue(cards, { now: NOW, daysLeft: 4 });
  assert.equal(q[0].id, "d2"); assert.equal(q[1].id, "d1");
  assert.equal(q.length, 2 + 10);
  assert.ok(!q.some(c => c.id === "later"));
});
test("Vokabeltest: am letzten Tag kommt jede Karte dran, die heute noch nicht abgefragt wurde", () => {
  const cards = [
    tcard("sec", { reps: 2, last_reviewed_at: NOW - 2 * DAY, next_review_at: new Date(NOW + DAY).toISOString(), last_result: "correct" }),
    tcard("weak", { reps: 1, last_reviewed_at: NOW - 2 * DAY, next_review_at: new Date(NOW + DAY).toISOString(), last_result: "almost" }),
    tcard("done", { reps: 2, last_reviewed_at: NOW - 60e3, next_review_at: new Date(NOW + DAY).toISOString(), last_result: "correct" }),
    tcard("neu")
  ];
  const ids = E.testQueue(cards, { now: NOW, daysLeft: 1 }).map(c => c.id);
  assert.deepEqual(ids, ["neu", "weak", "sec"]);
});
test("Vokabeltest: Bereitschaft = Anteil der Karten, die 2× hintereinander richtig waren", () => {
  const s = E.testStatus([tcard(1, { reps: 2, last_reviewed_at: NOW, last_result: "correct" }), tcard(2, { reps: 1, last_reviewed_at: NOW, last_result: "correct" }), tcard(3, { reps: 0, last_reviewed_at: NOW, last_result: "wrong" }), tcard(4)]);
  assert.deepEqual([s.total, s.secure, s.seen, s.unseen, s.wrong, s.score], [4, 1, 3, 1, 1, 25]);
  assert.equal(E.testStatus([tcard(1)]).score, null);
});
test("Vokabeltest: Wiederholung spätestens am Tag vor dem Test, frühestens morgen", () => {
  const testDay = "2026-10-07";
  const far = new Date(E.startOfDay(NOW) + 10 * DAY).toISOString();
  assert.equal(new Date(E.testCap(far, testDay, NOW)).getTime(), E.startOfDay(new Date("2026-10-07T00:00:00").getTime()) - DAY);
  const soon = new Date(E.startOfDay(NOW) + DAY).toISOString();
  assert.equal(E.testCap(soon, testDay, NOW), soon);
  const tomorrowTest = new Date(E.startOfDay(NOW) + DAY);
  assert.equal(new Date(E.testCap(far, tomorrowTest.getTime(), NOW)).getTime(), E.startOfDay(NOW) + DAY);
});
test("Liste einfügen: übliche Trenner, Nummerierung, Bindestriche im Wort bleiben", () => {
  const r = E.parseVocabList("1. la gare – der Bahnhof\nest-ce que\tFrageformel\npeut-être = vielleicht\nréussir ; gelingen; schaffen\n• le copain / la copine - der Freund / die Freundin\n\nnur ein Wort");
  assert.deepEqual(r.items.map(x => x.begriff), ["la gare", "est-ce que", "peut-être", "réussir", "le copain / la copine"]);
  assert.deepEqual(r.items.map(x => x.bedeutung), ["der Bahnhof", "Frageformel", "vielleicht", "gelingen; schaffen", "der Freund / die Freundin"]);
  assert.deepEqual(r.skipped, ["nur ein Wort"]);
});

/* ---------- FSRS-6 gegen die Referenz-Implementierung (py-fsrs) ---------- */
test("FSRS-6: Stabilität, Schwierigkeit und Intervall stimmen mit py-fsrs überein", () => {
  const ref = require("./fsrs-reference.json");
  let n = 0;
  ref.cases.forEach((steps, ci) => {
    let mem = null;
    steps.forEach((st, i) => {
      mem = E.fsrsStep(mem, st.g, st.gap);
      assert.ok(Math.abs(mem.S - st.S) < 1e-6 * Math.max(1, st.S), `Fall ${ci} Schritt ${i}: S ${mem.S} ≠ ${st.S}`);
      assert.ok(Math.abs(mem.D - st.D) < 1e-6, `Fall ${ci} Schritt ${i}: D ${mem.D} ≠ ${st.D}`);
      assert.equal(Math.min(365, Math.max(1, Math.round(E.fsrsInterval(mem.S)))), Math.min(365, st.ivl));
      n++;
    });
  });
  assert.ok(n > 150);
});
test("FSRS-6: nach S Tagen 90 % Abrufwahrscheinlichkeit", () => {
  assert.ok(Math.abs(E.fsrsRetrievability(10, 10) - 0.9) < 1e-9);
  assert.ok(E.fsrsRetrievability(20, 10) < 0.9 && E.fsrsRetrievability(5, 10) > 0.9);
});
test("FSRS-Planung: falsch = in 10 Minuten wieder, richtig = ganze Tage, Obergrenze für Tests", () => {
  const card = { reps: 0, last_reviewed_at: null };
  const ok = E.srsSchedule(card, "correct", NOW);
  assert.equal(ok.interval_days, 2.31); assert.equal(new Date(ok.next_review_at).getTime(), E.startOfDay(NOW) + 2 * DAY);
  assert.ok(ok.ease >= 10, "FSRS-Kennzeichnung");
  const bad = E.srsSchedule(Object.assign({}, card, ok), "wrong", NOW + 2 * DAY);
  assert.equal(new Date(bad.next_review_at).getTime(), NOW + 2 * DAY + 10 * 60000);
  assert.equal(bad.lapses, 1); assert.equal(bad.reps, 0);
  const capped = E.srsSchedule(Object.assign({}, card, ok), "correct", NOW + 2 * DAY, { cap: E.startOfDay(NOW) + 3 * DAY });
  assert.equal(new Date(capped.next_review_at).getTime(), E.startOfDay(NOW) + 3 * DAY);
  const retry = E.srsSchedule(Object.assign({}, card, bad), "correct", NOW + 2 * DAY + 600000, { retry: true });
  assert.equal(retry.correct_count, bad.correct_count, "Wiederholung in der Runde zählt nicht doppelt");
});
test("FSRS: alte SM-2-Karten werden sinnvoll übernommen", () => {
  const m = E.memoryOf({ reps: 3, last_reviewed_at: "2026-09-01", interval_days: 12, ease: 2.5, last_result: "correct" });
  assert.equal(m.S, 12); assert.ok(m.D > 4 && m.D < 6);
});

/* ---------- Lernrunde (Successive Relearning) ---------- */
function playRound(cards, answers) {
  const r = E.buildRound(cards, { direction: "reverse" });
  const s = E.createSession({ mode: "vocab", items: r.items, now: NOW }); s.prog = r.prog;
  const log = [];
  let guard = 0;
  while (s.index < s.items.length && guard++ < 500) {
    const it = E.current(s);
    if (it.kind === "vocab_study") { log.push("S" + it.vocab_id); E.roundAfter(s, it, "studied"); }
    else { const ok = answers(it, log); log.push((ok ? "+" : "-") + it.vocab_id); E.roundAfter(s, it, ok ? "correct" : "wrong"); }
    E.advance(s);
  }
  return { s, log };
}
test("Lernrunde: neues Wort = ansehen, dann 3× richtig mit wachsendem Abstand; Runde endet", () => {
  const cards = [tcard("n1"), tcard("r1", { reps: 2, last_reviewed_at: "x" }), tcard("r2", { reps: 2, last_reviewed_at: "x" })];
  const { s, log } = playRound(cards, () => true);
  assert.equal(log.filter(x => x === "+n1").length, 3, "neues Wort 3× abgerufen");
  assert.equal(log.filter(x => x === "+r1").length, 1, "Wiederholung 1×");
  assert.ok(log.indexOf("Sn1") < log.indexOf("+n1"), "erst ansehen, dann abrufen");
  assert.deepEqual(E.roundProgress(s), { need: 5, got: 5, left: 0, words: 3, doneWords: 3 });
});
test("Lernrunde: Fehler → später erneut aus dem Kopf, mit Abstand, bis richtig", () => {
  const cards = Array.from({ length: 10 }, (_, i) => tcard("r" + i, { reps: 2, last_reviewed_at: "x" }));
  let firstTry = true;
  const { s, log } = playRound(cards, it => { if (it.vocab_id === "r0" && firstTry) { firstTry = false; return false; } return true; });
  const i1 = log.indexOf("-r0"), i2 = log.indexOf("+r0");
  assert.ok(i2 - i1 >= 6, "Wiederholung erst nach mehreren anderen Karten: " + (i2 - i1));
  assert.equal(s.prog.r0.wrong, 1); assert.equal(E.roundProgress(s).left, 0);
});
test("Korrektur: falsche Buchstaben werden markiert", () => {
  const parts = E.diffParts("reusir", "réussir");
  assert.equal(parts.map(p => p.text).join(""), "réussir");
  assert.deepEqual(parts.filter(p => !p.ok).map(p => p.text), ["é", "s"]);
  assert.deepEqual(E.diffParts("", "la gare"), [{ text: "la gare", ok: false }]);
});
test("Vokabeltest: erwartete Trefferquote = Abrufwahrscheinlichkeit am Testtag", () => {
  const testDay = NOW + 4 * DAY;
  const fresh = E.srsSchedule({ reps: 0 }, "correct", NOW);
  const strong = { reps: 5, last_reviewed_at: new Date(NOW).toISOString(), interval_days: 60, ease: 13, last_result: "correct" };
  const s = E.testStatus([Object.assign({ id: 1 }, fresh), Object.assign({ id: 2 }, strong), tcard(3)], testDay);
  assert.equal(s.secure, 1, "nur das stabile Wort sitzt sicher");
  const exp = Math.round((E.recallProbability(fresh, testDay) + E.recallProbability(strong, testDay)) / 3 * 100);
  assert.equal(s.expected, exp); assert.ok(s.expected > 50 && s.expected < 70, s.expected);
});

/* ---------- Klausur-Fahrplan ---------- */
const kinds = o => E.examRoadmap(o).map(s => s.kind);
test("Fahrplan: eine Woche vorher, ohne Themen → festlegen, üben, Probeklausur 4 Tage vorher, nacharbeiten, Vortag locker", () => {
  assert.deepEqual(kinds({ daysLeft: 7, hasTopics: false, mockDoneDaysAgo: null }),
    ["setup", "learn", "learn", "learn", "mock", "review", "learn", "final", "exam"]);
});
test("Fahrplan: wenig Zeit → Probeklausur sofort; am Vortag keine mehr", () => {
  assert.deepEqual(kinds({ daysLeft: 3, hasTopics: true, mockDoneDaysAgo: null }), ["mock", "review", "final", "exam"]);
  assert.deepEqual(kinds({ daysLeft: 2, hasTopics: true, mockDoneDaysAgo: null }), ["mock", "final", "exam"]);
  assert.deepEqual(kinds({ daysLeft: 1, hasTopics: true, mockDoneDaysAgo: null }), ["final", "exam"]);
});
test("Fahrplan: Probeklausur geschrieben → am nächsten Tag nacharbeiten, keine zweite", () => {
  assert.deepEqual(kinds({ daysLeft: 3, hasTopics: true, mockDoneDaysAgo: 1, reviewDone: false }), ["review", "learn", "final", "exam"]);
  assert.deepEqual(kinds({ daysLeft: 3, hasTopics: true, mockDoneDaysAgo: 1, reviewDone: true }), ["learn", "learn", "final", "exam"]);
  assert.ok(!E.examRoadmap({ daysLeft: 6, hasTopics: true, mockDoneDaysAgo: 0 }).some(s => s.kind === "mock" && s.day > 0), "keine zweite Probeklausur");
});
test("Fahrplan: Probeklausur heute geschrieben → heute abgehakt, morgen nacharbeiten", () => {
  assert.deepEqual(kinds({ daysLeft: 4, hasTopics: true, mockDoneDaysAgo: 0, reviewDone: false }), ["mock", "review", "learn", "final", "exam"]);
});
test("Lernrunde beide Richtungen: jedes Wort in beide Richtungen richtig, sonst nicht fertig", () => {
  const cards = [tcard("n1"), tcard("r1", { reps: 2, last_reviewed_at: "x" }), tcard("r2", { reps: 2, last_reviewed_at: "x" })];
  const r = E.buildRound(cards, { direction: "both" });
  const s = E.createSession({ mode: "vocab", items: r.items, now: NOW }); s.prog = r.prog;
  const seen = {}; let guard = 0;
  while (s.index < s.items.length && guard++ < 200) {
    const it = E.current(s);
    assert.ok(it.direction === "forward" || it.direction === "reverse", "immer konkrete Richtung");
    if (it.kind === "vocab_study") E.roundAfter(s, it, "studied");
    else { (seen[it.vocab_id] = seen[it.vocab_id] || new Set()).add(it.direction); E.roundAfter(s, it, "correct"); }
    E.advance(s);
  }
  for (const id of ["n1", "r1", "r2"]) assert.equal(seen[id].size, 2, id + " in beide Richtungen abgefragt");
  assert.equal(E.roundProgress(s).left, 0);
});

/* ---------- Leichte Wörter / „Kann ich schon“ ---------- */
test("Sehr leichte Wörter werden erkannt, normale nicht", () => {
  const c = (b, m) => ({ begriff: b, bedeutung: m, source_language: "fr" });
  for (const [b, m] of [["bonjour", "guten Tag"], ["cool", "cool"], ["moderne", "modern"], ["élégant / élégante", "elegant"], ["beige", "beige"], ["orange", "orange"], ["Merci", "danke"]]) assert.ok(E.isTrivial(c(b, m)), b);
  for (const [b, m] of [["le pantalon", "die Hose"], ["classique", "klassisch"], ["le prix", "der Preis"], ["chic", "schick"], ["rose", "rosa"], ["acheter", "kaufen"]]) assert.ok(!E.isTrivial(c(b, m)), b);
});
test("Kann ich schon: Langzeit, nächste Kontrolle in 60 Tagen", () => {
  const p = E.markKnown({ reps: 0 }, NOW);
  assert.equal(p.interval_days, 60); assert.equal(E.stageOf(Object.assign({ last_reviewed_at: "x" }, p)).key, "long");
  assert.equal(new Date(p.next_review_at).getTime(), E.startOfDay(NOW) + 60 * DAY);
});
test("Lernrunde: „Kenne ich schon“ beendet das Wort sofort, ohne weitere Abfragen", () => {
  const cards = [tcard("n1"), tcard("n2")];
  const r = E.buildRound(cards, { direction: "forward" });
  const s = E.createSession({ mode: "vocab", items: r.items, now: NOW }); s.prog = r.prog;
  let guard = 0; const asked = [];
  while (s.index < s.items.length && guard++ < 100) {
    const it = E.current(s);
    if (it.kind === "vocab_study") E.roundAfter(s, it, it.vocab_id === "n1" ? "known" : "studied");
    else { asked.push(it.vocab_id); E.roundAfter(s, it, "correct"); }
    E.advance(s);
  }
  assert.ok(!asked.includes("n1")); assert.ok(asked.includes("n2"));
  assert.equal(E.roundProgress(s).left, 0);
});

/* ---------- Französisch: Konjugation & Pronomen ---------- */
const G = require("../js/fr-grammar.js");
test("Konjugation: j' vor Vokal, Stamm + Endung, Sonderformen", () => {
  const t = G.tasks(["acheter", "porter", "aller", "avoir", "coûter"]);
  const find = (verb, fr) => t.find(x => x.verb === verb && x.pr.fr === fr);
  assert.equal(find("acheter", "je").answer, "j'achète");
  assert.equal(find("acheter", "nous").answer, "nous achetons");
  assert.equal(find("porter", "je").answer, "je porte");
  assert.equal(find("aller", "ils").answer, "ils vont");
  assert.equal(find("avoir", "je").answer, "j'ai");
  assert.equal(find("acheter", "on").answer, "on achète");
  assert.ok(!find("coûter", "je"), "je coûte gibt es nicht als Aufgabe");
  assert.deepEqual(G.split("acheter", 3), { stem: "achet", ending: "ons", form: "achetons" });
  assert.equal(G.split("acheter", 0).stem, "achèt");
});
test("Verb-Puzzle: richtige Teile immer auswählbar, Prüfung erkennt Fehler und Varianten", () => {
  for (const task of G.tasks()) {
    const pz = G.puzzle(task, () => 0.5);
    pz.rows.forEach(r => assert.ok(r.options.includes(r.correct), task.answer + " " + r.key));
    const pick = Object.fromEntries(pz.rows.map(r => [r.key, r.correct]));
    assert.equal(G.checkPuzzle(task, pick).text, task.answer); assert.ok(G.checkPuzzle(task, pick).ok);
  }
  const task = G.tasks(["acheter"]).find(x => x.pr.fr === "nous");
  const bad = G.checkPuzzle(task, { pronoun: "nous", stem: "achet", ending: "ez" });
  assert.ok(!bad.ok); assert.equal(bad.parts.ending, false); assert.equal(bad.parts.stem, true);
  const pay = G.tasks(["payer"]).find(x => x.pr.fr === "je");
  assert.ok(G.checkPuzzle(pay, { pronoun: "je", stem: "pay", ending: "e" }).ok, "je paye geht auch");
});

/* ---------- Lektion (Duolingo-Stil) ---------- */
const L = require("../js/lesson.js");
test("Lektion: Sätze passen zu ihren Lücken und Wörtern", () => {
  const VET = require("fs").readFileSync(__dirname + "/../js/content-packs.js", "utf8");
  for (const s of L.SENTENCES) {
    assert.ok(s.fr.includes(s.gap), "Lücke im Satz: " + s.fr);
    assert.ok(!s.opts.includes(s.gap), "Lösung nicht doppelt: " + s.fr);
    assert.ok(VET.includes('["' + s.key + '"'), "Wort aus der Sammlung: " + s.key);
  }
});
test("Lektion: gemischte Aufgaben, jede lösbar; Satz bauen prüft ohne Satzzeichen/Großschreibung", () => {
  const VET = require("fs").readFileSync(__dirname + "/../js/content-packs.js", "utf8");
  const words = [...VET.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].slice(0, 51).map((m, i) => ({ id: i, begriff: m[1], bedeutung: m[2] }));
  let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ls = L.buildLesson({ cards: words, speech: true, rng });
  const types = new Set(ls.map(x => x.type));
  for (const t of ["pic", "mc", "pairs", "gap", "build", "listen"]) assert.ok(types.has(t), "Typ " + t);
  for (const x of ls) {
    if (x.opts) assert.ok(x.correct >= 0, x.type + " hat richtige Antwort");
    if (x.tiles) { const tl = x.tiles.slice(); L.tokens(x.target).forEach(w => { const i = tl.indexOf(w); assert.ok(i >= 0, "Kachel fehlt: " + w); tl.splice(i, 1); }); }
    if (x.type === "pairs") assert.equal(new Set(x.right.map(r => r.text)).size, 5);
  }
  assert.ok(L.checkBuild(["je", "porte", "un", "pantalon", "noir"], "Je porte un pantalon noir."));
  assert.ok(!L.checkBuild(["porte", "je", "un", "pantalon", "noir"], "Je porte un pantalon noir."));
  assert.deepEqual(L.buildLesson({ cards: words.slice(0, 3) }), [], "zu wenig Wörter → keine Lektion");
});
test("Lektion: Lücke ist ein ganzes Wort an der ersten Stelle im Satz", () => {
  for (const s of L.SENTENCES) {
    const i = s.fr.indexOf(s.gap);
    const before = s.fr[i - 1] || " ", after = s.fr[i + s.gap.length] || " ";
    assert.ok(/[\s'’]/.test(before) && /[\s.,!?]/.test(after), "Lücke mitten im Wort: " + s.fr);
  }
});

/* ---------- Schreib-Check & Nachsprechen ---------- */
const C = require("../js/fr-check.js");
test("Schreib-Check: Elision, Genus, Angleichung, Konjugation, Akzente – Satzanfang bleibt groß", () => {
  const f = t => C.check(t).map(e => [e.wrong, e.fix, e.kind]);
  assert.deepEqual(f("Je achète une robe vert."), [["Je achète", "J'achète", "elision"], ["vert", "verte", "agree"]]);
  assert.deepEqual(f("Nous achète un robe."), [["achète", "achetons", "verb"], ["un robe", "une robe", "gender"]]);
  assert.deepEqual(f("des baskets blanche"), [["blanche", "blanches", "agree"]]);
  assert.deepEqual(f("Ca coute tres cher."), [["Ca", "Ça", "accent"], ["coute", "coûte", "accent"], ["tres", "très", "accent"]]);
  assert.deepEqual(f("Tu porte un pull verte."), [["porte", "portes", "verb"], ["verte", "vert", "agree"]]);
});
test("Schreib-Check: korrekter Text ohne Fehlalarm (auch je vous aime, marron, je paye)", () => {
  const ok = "Hier, je suis allée au magasin avec ma mère. J'ai acheté un pull bleu et une casquette noire. Le pull est très confortable : il coûte 20 euros. Elle porte une robe rouge et des baskets blanches. Je vous aime. Des chaussures marron. Je paye. Nous allons au magasin. Vous essayez la jupe ?";
  assert.deepEqual(C.check(ok), []);
  assert.equal(C.wordCount("J'ai un pull."), 4);
});
test("Nachsprechen: kleine Erkennungsfehler zählen, falsche Wörter nicht", () => {
  assert.ok(L.speechOk(["je porte un pantalon noir"], "Je porte un pantalon noir."));
  assert.ok(L.speechOk(["xyz", "la robe"], "la robe"), "eine der Alternativen reicht");
  assert.ok(!L.speechOk(["le pull"], "la jupe"));
  const VET = require("fs").readFileSync(__dirname + "/../js/content-packs.js", "utf8");
  const words = [...VET.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].slice(0, 51).map((m, i) => ({ id: i, begriff: m[1], bedeutung: m[2] }));
  const ls = L.buildLesson({ cards: words, speech: true, mic: true });
  assert.equal(ls.filter(x => x.type === "speak").length, 2); assert.ok(ls.length <= 14);
});

/* ---------- Alle App-Dateien sind gültiges JavaScript ---------- */
test("Syntax: jede Datei in js/ und sw.js lässt sich parsen", () => {
  const fs = require("fs"), vm = require("vm"), path = require("path");
  const dir = path.join(__dirname, "../js");
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".js")).map(x => path.join(dir, x)).concat([path.join(__dirname, "../sw.js")]))
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(f, "utf8"), { filename: f }), f);
});
test("Version in index.html passt zum Cache-Namen in sw.js", () => {
  const fs = require("fs"), path = require("path");
  const v = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8").match(/const APP_VERSION="(\d+)"/)[1];
  assert.match(fs.readFileSync(path.join(__dirname, "../sw.js"), "utf8"), new RegExp('const CACHE="lc-v' + v + '"'), "beim Update beide erhöhen");
});
test("Keine doppelten globalen const/let-Namen über index.html und js/ (sonst startet die App nicht)", () => {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  inline.forEach((src, i) => assert.doesNotThrow(() => new vm.Script(src, { filename: "index.html#script" + i })));
  const files = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => fs.readFileSync(path.join(__dirname, "..", m[1]), "utf8"));
  const seen = {};
  inline.concat(files).forEach((src, i) => [...src.matchAll(/^(?:const|let)\s+([A-Za-z_$][\w$]*)/gm)].forEach(m => { assert.ok(!seen[m[1]], "doppelt: " + m[1]); seen[m[1]] = true; }));
});

/* ---------- Grammatik-Drill ---------- */
const DR = require("../js/drill.js");
test("Drill: Stiefel-Verben richtig konjugiert, Stiefel = je/tu/il/ils", () => {
  assert.deepEqual(DR.BOOT, [0, 1, 2, 5]);
  for (const [v, d] of Object.entries(DR.VERBS)) d.forms.forEach((f, p) => {
    const stem = d.stems[d.boot.includes(p) ? 0 : 1];
    assert.equal(stem + d.end[p], f, v + " " + p);
  });
  assert.equal(DR.pron(0, "achète"), "j'"); assert.equal(DR.pron(0, "préfère"), "je");
  assert.deepEqual(DR.parts("acheter", 0), { pre: "ach", ch: "è", post: "t", end: "e", inBoot: true });
});
test("Drill: jede Aufgabe hat 3 falsche, eindeutige Ablenker – y-Variante zählt als richtig", () => {
  for (const t of DR.TOPICS) for (const it of DR.items(t.id)) {
    const d = DR.distractors(it, () => 0.5);
    assert.ok(d.length >= 3 || (it.options && d.length === it.options.length - 1), it.key);
    assert.ok(!d.includes(it.answer) && !d.includes(DR.altOf(it)), it.key + ": " + d);
  }
  const ess = DR.items("stiefel").find(i => i.key === "essayer:5");
  assert.equal(DR.check("essayent", ess.answer, ess), "ok");
  assert.equal(DR.check("achètons", "achetons"), "accent"); assert.equal(DR.check("achetez", "achetons"), "wrong");
});
test("Drill: ce/cet/cette/ces, quel…, beau/bel/belle", () => {
  const n = w => DR.NOUNS.find(x => x.w === w);
  assert.equal(DR.demo(n("acteur")), "cet"); assert.equal(DR.demo(n("CD")), "ce"); assert.equal(DR.demo(n("amie")), "cette"); assert.equal(DR.demo(n("films")), "ces");
  assert.equal(DR.quel(n("acteur")), "quel"); assert.equal(DR.quel(n("chaussures")), "quelles"); assert.equal(DR.quel(n("films")), "quels");
  const b = DR.items("beau").find(i => i.key === "vieux:avion"); assert.equal(b.answer, "vieil");
  assert.equal(DR.items("beau").find(i => i.key === "nouveau:maison").answer, "nouvelle");
});
test("Drill: Runde startet mit den schwächsten, alles wird geschrieben; Fehler setzt zurück", () => {
  let st = {}; ["acheter:0", "acheter:1"].forEach(k => { st = DR.learn(st, k, true); st = DR.learn(st, k, true); });
  const r = DR.round("stiefel", st, 30, () => 0.5);
  assert.equal(r.length, 30); assert.ok(r.slice(0, 28).every(i => i.box === 0), "ungeübte zuerst");
  assert.ok(r.every(i => i.type === "type"), "keine Auswahl mehr");
  assert.equal(r.find(i => i.key === "acheter:5").fmt, "ending", "neu → erst nur die Endung"); assert.equal(r.find(i => i.key === "acheter:5").answer, "ent");
  assert.equal(r.find(i => i.key === "acheter:0").fmt, "form", "Box 2 → selbst schreiben mit Spickzettel"); assert.ok(r.find(i => i.key === "acheter:0").lenient);
  const vs = DR.round("stiefel", {}, 12).map(i => i.verb); assert.deepEqual([...new Set(vs)].sort(), ["acheter", "essayer"], "ein Verb nach dem anderen");
  st = DR.learn(st, "acheter:0", false); assert.equal(st["acheter:0"].b, 0);
  const bp = DR.byPerson("stiefel", st); assert.equal(bp.length, 6); assert.equal(bp[0].pct, 67);
});

test("Drill: Formate – Satz, Umformen, Fehler finden, Passé composé – passen zur Lösung", () => {
  let n = 1; const rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  const all = DR.TOPICS.flatMap(t => DR.items(t.id));
  for (const it of all) for (const lv of [0, 1, 2, 3, 3, 3]) {
    const v = DR.variant(it, lv, rng);
    assert.equal(v.type, "type"); assert.equal((v.prompt.match(/___/g) || []).length, 1, v.prompt);
    assert.ok(v.answer && DR.FMT[v.fmt], it.key);
    if (v.wrong) { assert.notEqual(v.wrong, v.answer); assert.notEqual(v.wrong, DR.altOf(it)); }
    if (v.fmt === "um") assert.ok(v.from && !v.from.endsWith(" " + v.answer), v.from);
    if (/J'___|j'___/.test(v.prompt)) assert.ok(/^[aeiouéèh]/.test(v.answer), v.prompt + " " + v.answer);
    if (/\b[Jj]e ___/.test(v.prompt)) assert.ok(!/^[aeiouéè]/.test(v.answer), v.prompt + " " + v.answer);
    if (it.verb && v.fmt === "form") assert.ok(v.hint && !v.hint.includes(v.answer), "Tipp verrät nicht die Lösung: " + v.hint);
    if (v.fmt === "ending") { assert.equal(v.stem + v.answer, v.full); assert.ok(/^[a-z]+$/.test(v.answer), "Endung ohne Akzent"); }
    if (v.fmt === "build") assert.ok(v.blocks.stems.some(st => v.blocks.ends.some(e => st + e === v.answer)), "Lösung aus Bausteinen baubar");
    assert.equal(!!v.lenient, lv <= 2, "Akzent nur am Anfang großzügig");
  }
  const pc = DR.variant(DR.items("pc").find(i => i.key === "pc:mettre:3"), 3, rng); assert.equal(pc.answer, "avons mis"); assert.ok(pc.prompt.startsWith("Hier, "));
});
test("Drill: Probe-Arbeit mischt alle Themen, 20 Aufgaben, Note nach Prozent", () => {
  const t = DR.testRound({}, () => 0.3);
  assert.equal(t.length, 20); assert.equal(new Set(t.map(x => x.topic + x.key)).size, 20);
  assert.deepEqual([...new Set(t.map(x => x.topic))].sort(), ["beau", "ce", "mettre", "pc", "quel", "stiefel"]);
  assert.ok(t.every(x => x.type === "type" && !x.hint && !x.lenient && !x.spick && !["ending", "build"].includes(x.fmt)));
  assert.deepEqual([100, 92, 85, 70, 55, 40, 10].map(DR.grade), [1, 1, 2, 3, 4, 5, 6]);
  const it = k => DR.items("stiefel").find(i => i.key === k);
  assert.deepEqual(DR.accentsFor(it("acheter:0")), ["è"]); assert.deepEqual(DR.accentsFor(it("payer:0")), []); assert.deepEqual(DR.accentsFor(DR.items("ce")[0]), []);
});
