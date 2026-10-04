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
test("SRS: neu → 1 → 3 → Intervall × Leichtigkeit; richtig verlängert, falsch setzt zurück", () => {
  let c = { reps: 0, ease: 2.5, interval_days: 0 };
  c = Object.assign(c, E.srsSchedule(c, "correct", NOW)); assert.equal(c.interval_days, 1);
  c = Object.assign(c, E.srsSchedule(c, "correct", NOW)); assert.equal(c.interval_days, 3);
  c = Object.assign(c, E.srsSchedule(c, "correct", NOW)); assert.ok(c.interval_days >= 7.5 && c.interval_days <= 8, c.interval_days);
  assert.equal(c.correct_count, 3);
  const before = c.ease;
  c = Object.assign(c, E.srsSchedule(c, "wrong", NOW));
  assert.equal(c.interval_days, 0); assert.equal(c.reps, 0); assert.equal(c.lapses, 1); assert.equal(c.incorrect_count, 1);
  assert.ok(c.ease < before);
  assert.equal(new Date(c.next_review_at).getTime(), NOW + 10 * 60000, "falsch → in 10 Minuten wieder fällig");
});
test("SRS: Fälligkeit liegt auf Tagesbeginn, Mastery folgt dem Intervall", () => {
  const r = E.srsSchedule({ reps: 2, ease: 2.5, interval_days: 3 }, "correct", NOW);
  const due = new Date(r.next_review_at); assert.equal(due.getHours(), 0);
  assert.ok(r.mastery >= 60 && r.mastery < 75);
  assert.equal(E.masteryFromInterval(0), 0); assert.equal(E.masteryFromInterval(7), 60); assert.equal(E.masteryFromInterval(90), 100);
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
