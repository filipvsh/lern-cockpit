// Ende-zu-Ende-Tests im echten Browser (Chromium) gegen ein In-Memory-Supabase.
// Ausführen: node tests/e2e.mjs   ·   Screenshots: SHOTS=/pfad node tests/e2e.mjs
import { MockBackend, seed } from "./mock-backend.mjs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

let pw;
try { pw = await import("playwright"); } catch (e) { pw = await import("/opt/node-tools/node_modules/playwright/index.mjs"); }
const { chromium } = pw.default || pw;
const APP = "file://" + fileURLToPath(new URL("../index.html", import.meta.url));
const SHOTS = process.env.SHOTS || ""; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const only = process.argv[2] || "";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
let passed = 0, failed = 0;
const errors = [];

async function open(backend, o = {}) {
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_FAILED/.test(m.text())) errors.push("console: " + m.text()); });
  page.on("dialog", d => d.accept());
  await page.route("**/*", r => backend.handle(r));
  await page.goto(APP + (o.hash || "#/dashboard"));
  return { ctx, page };
}
async function login(page) {
  // Das Anmeldeformular kann direkt nach dem Laden noch einmal neu gezeichnet werden → bei Bedarf erneut ausfüllen
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector("#auth_form");
    await page.fill("#a_mail", "filip@example.org"); await page.fill("#a_pw", "geheim123");
    await page.click("#a_go");
    try { await page.waitForSelector(".dash", { timeout: i < 2 ? 6000 : 15000 }); return; }
    catch (e) { if (i === 2 || !(await page.$("#auth_form"))) throw e; }
  }
}
/** Spielt die laufende Lernrunde durch: Einprägen (abschreiben), Abruf, bei Fehlern Lösung abtippen. wrong(n) → diese Antwort absichtlich falsch */
async function playRoundUI(page, wrong) {
  let n = 0;
  for (let guard = 0; guard < 120; guard++) {
    const it = await page.evaluate(() => { const it = TS && TS.status === "active" && Engine.current(TS); if (!it) return null; const c = cardById(it.vocab_id); const sd = Engine.vocabSides(c, it.direction); return { kind: it.kind, ans: sd.answers[0], raw: sd.answer }; });
    if (!it) break;
    if (it.kind === "vocab_study") { await page.fill("#vc", it.ans); await page.click("#st_next"); continue; }
    const bad = wrong && wrong(n++);
    await page.fill("#va", bad ? "falsch" : it.ans); await page.click("#va_check");
    if (bad) { await page.fill("#vc", it.ans); }
    await page.click("#va_next");
  }
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: SHOTS + "/" + name + ".png", fullPage: true }); };
const go = async (page, hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(250); };
async function scenario(name, fn) {
  if (only && !name.toLowerCase().includes(only.toLowerCase())) return;
  const before = errors.length;
  try { await fn(); if (errors.length > before) throw new Error(errors.slice(before).join("\n")); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.log("  ✗ " + name + "\n    " + String(e.stack || e).split("\n").slice(0, 4).join("\n    ")); }
}

console.log("Ende-zu-Ende");

await scenario("Anmeldung + Übernahme der Altdaten in das neue Modell", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b);
  await login(page);
  assert.ok(b.db.klausuren.every(k => k.user_id), "Altdaten übernommen");
  assert.deepEqual(b.db.vocab_collections.map(c => c.name).sort(), ["Chemie", "Unit 1", "Unité 1"]);
  const chem = b.db.vocab_collections.find(c => c.name === "Chemie");
  assert.equal(chem.source_language, "de", "Fach-Lektion wird Fachbegriffe, nicht Französisch");
  assert.equal(chem.subject_id, b.db.subjects.find(s => s.name === "Chemie").id);
  assert.ok(b.db.vokabeln.every(v => v.collection_id), "jede Vokabel hat eine Sammlung");
  assert.equal(b.db.vocab_collections.find(c => c.name === "Unit 1").source_language, "en");
  const topic = b.db.topics.find(t => t.title === "Short Story Writing"); assert.ok(topic, "Thema aus alter Themenliste");
  assert.deepEqual(b.db.subtopics.filter(s => s.topic_id === topic.id).map(s => s.title), ["Structure", "Narrative Perspective", "Characterisation"]);
  assert.equal(b.db.learning_events.filter(e => e.type === "self_assessment").length, 1, "nur „erledigt“ wird als Selbsteinschätzung übernommen");
  assert.ok(b.db.klausuren.every(k => k.topics_migrated), "Migration markiert");
  // erneutes Laden erzeugt keine Duplikate
  b.log.length = 0; await page.reload(); await page.waitForSelector(".dash"); await page.waitForTimeout(300);
  assert.equal(b.db.topics.length, 1); assert.equal(b.db.vocab_collections.length, 3);
  assert.deepEqual(b.log.filter(l => !l.startsWith("GET") && !l.includes("/rpc/")), [], "zweites Laden schreibt nichts");
  await shot(page, "01-dashboard");
  const text = await page.textContent(".dash");
  assert.ok(/fällige Vokabel|neue Vokabel/.test(text), "Tagesplan enthält Vokabeln");
  assert.ok(text.includes("Narrative Perspective") || text.includes("Characterisation"), "Tagesplan enthält Unterthema der nahen Prüfung");
  assert.ok(!/NaN|undefined/.test(text), "keine kaputten Werte");
  await ctx.close();
});

await scenario("Reparatur: früher als Französisch eingeordnete Fach-Lektion wird zu Fachbegriffen", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b); await login(page);
  const chem = b.db.vocab_collections.find(c => c.name === "Chemie");
  Object.assign(chem, { source_language: "fr", subject_id: null });               // Zustand nach dem alten Fehler
  b.db.vokabeln.filter(v => v.collection_id === chem.id).forEach(v => v.source_language = "fr");
  const fr = b.db.vocab_collections.find(c => c.name === "Unité 1");
  await page.reload(); await page.waitForSelector(".dash"); await page.waitForTimeout(400);
  assert.equal(chem.source_language, "de"); assert.ok(chem.subject_id);
  assert.ok(b.db.vokabeln.filter(v => v.collection_id === chem.id).every(v => v.source_language === "de"));
  assert.equal(fr.source_language, "fr", "echte Französisch-Sammlung bleibt unberührt");
  await go(page, "#/vokabeln"); await page.waitForSelector(".tiles");
  const groups = await page.$$eval(".lang-h h2", els => els.map(e => e.textContent));
  assert.deepEqual(groups, ["Französisch", "Englisch", "Fachbegriffe"]);
  await go(page, "#/vokabeln/" + chem.id); await page.waitForSelector(".dirsw");
  assert.ok((await page.textContent(".dirsw")).includes("Begriff → Erklärung"));
  await shot(page, "02b-fachbegriffe");
  await ctx.close();
});

await scenario("Vokabeln: Sammlung anlegen, Vokabel anlegen, bearbeiten, löschen, suchen", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b); await login(page);
  await go(page, "#/vokabeln"); await page.click("#col_new");
  await page.fill("#c_name", "Unité 4"); await page.selectOption("#c_src", "fr"); await page.click("#c_save");
  await page.waitForSelector("text=Leere Sammlung");
  const col = b.db.vocab_collections.find(c => c.name === "Unité 4"); assert.ok(col);
  await page.click("#v_new");
  await page.fill("#e_term", "le quartier"); await page.fill("#e_tr", "das Viertel"); await page.fill("#e_alt", "der Stadtteil"); await page.click("#e_save");
  await page.waitForFunction(() => STATE.vo.some(x => x.begriff === "le quartier"), null, { timeout: 5000 }); await page.click("#e_cancel"); await page.waitForTimeout(200);
  const v = b.db.vokabeln.find(x => x.begriff === "le quartier"); assert.ok(v, "gespeichert"); assert.equal(v.collection_id, col.id); assert.deepEqual(v.alternatives, ["der Stadtteil"]);
  await page.click(`[data-editvo="${v.id}"]`); await page.fill("#e_tr", "das Stadtviertel"); await page.click("#e_save"); await page.waitForTimeout(300);
  assert.equal(b.db.vokabeln.find(x => x.id === v.id).bedeutung, "das Stadtviertel");
  await go(page, "#/vokabeln"); await page.fill("#v_filter", "stadt"); await page.waitForTimeout(450);
  assert.ok(await page.isVisible(`[data-editvo="${v.id}"]`), "Suche findet über Übersetzung");
  await page.click(`[data-editvo="${v.id}"]`); await page.click("#e_del"); await page.waitForTimeout(300);
  assert.ok(!b.db.vokabeln.some(x => x.id === v.id), "gelöscht");
  await shot(page, "02-vokabeln");
  await ctx.close();
});

await scenario("Vokabeltraining: Richtung, richtig, falsch, Spaced Repetition, Lernereignisse", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b); await login(page);
  const col = b.db.vocab_collections.find(c => c.name === "Unité 1");
  await go(page, "#/vokabeln/" + col.id);
  await page.click('[data-vdir="reverse"]'); await page.click('[data-vstart="vocab"]');
  await page.waitForSelector("#vs_go"); await page.click("#vs_go");
  await page.waitForSelector("#va");
  assert.ok(await page.textContent(".fx-ctx").then(t => t.includes("Deutsch → Französisch")), "Richtung Teil der Session");
  const prompt = (await page.textContent(".term")).trim();
  const card = b.db.vokabeln.find(v => v.bedeutung.split(",")[0].trim() === prompt || v.bedeutung === prompt);
  assert.ok(card, "Abfrage zeigt die deutsche Seite: " + prompt);
  await page.fill("#va", card.begriff.toUpperCase() + "  "); await page.click("#va_check");
  await page.waitForSelector(".fb.ok"); await page.evaluate(() => Api.idle());
  let row = b.db.vokabeln.find(v => v.id === card.id);
  assert.equal(row.correct_count, 1); assert.ok(row.next_review_at > new Date().toISOString(), "Intervall verlängert");
  assert.ok(b.db.learning_events.some(e => e.type === "vocabulary_correct" && e.vocab_id === card.id && e.detail.direction === "reverse"));
  await page.click("#va_next");
  const prompt2 = (await page.textContent(".term")).trim();
  await page.fill("#va", "völlig falsch"); await page.click("#va_check");
  await page.waitForSelector(".fb.bad"); await page.evaluate(() => Api.idle());
  const wrong = b.db.learning_events.filter(e => e.type === "vocabulary_wrong"); assert.equal(wrong.length, 1);
  const wcard = b.db.vokabeln.find(v => v.id === wrong[0].vocab_id); assert.equal(wcard.incorrect_count, 1);
  assert.ok(new Date(wcard.next_review_at).getTime() - Date.now() < 15 * 60000, "falsch → gleich noch einmal");
  assert.ok(await page.$eval("#va_next", b => b.disabled), "erst weiter, wenn die Lösung abgetippt ist");

  // „Ich hatte recht“ korrigiert Ereignis und Planung
  await page.click("#va_override"); await page.waitForTimeout(200); await page.evaluate(() => Api.idle());
  const fixed = b.db.learning_events.find(e => e.id === wrong[0].id); assert.equal(fixed.type, "vocabulary_correct");
  assert.ok(!b.db.vokabeln.find(v => v.id === wcard.id).alternatives.includes("völlig falsch"), "Richtung DE→FR: französische Antwort wird nicht als deutsche Übersetzung gespeichert");
  assert.ok(b.db.vokabeln.find(v => v.id === wcard.id).interval_days > 0, "nach Korrektur wie „richtig“ geplant");
  await shot(page, "03-vokabel-session");
  assert.ok(prompt2);
  await ctx.close();
});

await scenario("Trainer: Pause, Fortsetzen, Reload-sicherer Timer, Beenden", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b); await login(page);
  await go(page, "#/trainer"); await page.click('[data-mode="exam"]'); await page.waitForSelector("#xm_go");
  await page.click('[data-xmin="15"]'); await page.click("#xm_go");
  await page.waitForSelector(".timer.countdown");
  const ts = b.db.training_sessions[0]; assert.equal(ts.mode, "exam"); assert.equal(ts.time_limit_s, 900);
  // 5 Minuten zurückdatieren: wie wenn seit Start 5 Minuten vergangen sind
  await page.evaluate(() => { TS.started_at -= 5 * 60000; tsSave(); });
  await page.reload(); await page.waitForSelector(".timer.countdown");
  const t1 = await page.textContent("[data-tstime]"); assert.ok(/^(9|10):\d\d$/.test(t1), "nach Reload ~10:00 statt 15:00: " + t1);
  await page.click("#ts_pause"); await page.waitForSelector("text=Pausiert");
  assert.equal(b.db.training_sessions[0].status, "paused");
  const p1 = await page.textContent("[data-tstime]"); await page.waitForTimeout(1600);
  assert.equal(await page.textContent("[data-tstime]"), p1, "Timer steht in der Pause");
  await page.click("#ts_resume"); assert.equal(b.db.training_sessions[0].status, "active");
  // Session-Pille außerhalb des Trainers
  await go(page, "#/dashboard"); await page.waitForSelector(".session-pill");
  assert.ok((await page.textContent(".dash")).includes("Weitermachen"));
  await page.click(".session-pill .btn"); await page.waitForSelector("#oa");
  await page.fill("#oa", "Meine Antwort unter Prüfungsbedingungen."); await page.click("#oa_check");
  assert.equal(await page.$(".fb"), null, "keine Rückmeldung im Prüfungsmodus");
  assert.equal(await page.$("#hint_btn"), null, "keine Hinweise im Prüfungsmodus");
  await page.click("#ts_end"); await page.click("#ce_yes");
  await page.waitForSelector("text=Auswertung");
  await shot(page, "04-pruefung-auswertung");
  await ctx.close();
});

await scenario("Lernplan: Prüfung, Thema, Unterthema, Übung anlegen, üben, Lernstand ändert sich", async () => {
  const b = new MockBackend({ ai: false }); const { ctx, page } = await open(b); await login(page);
  await go(page, "#/lernplan"); await page.click("#lp_new");
  await page.selectOption("#k_fach", "Mathe"); await page.fill("#k_thema", "Funktionen");
  await page.fill("#k_datum", new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10)); await page.click("#k_add");
  await page.waitForSelector(".topic-head");
  const exam = b.db.klausuren.find(k => k.thema === "Funktionen"); assert.ok(exam);
  const topic = b.db.topics.find(t => t.exam_id === exam.id); assert.equal(topic.title, "Funktionen");
  await page.fill(`[data-subadd="${topic.id}"]`, "Ableitungen"); await page.press(`[data-subadd="${topic.id}"]`, "Enter"); await page.waitForTimeout(250);
  const st = b.db.subtopics.find(s => s.title === "Ableitungen"); assert.ok(st);
  await page.click(`details[data-sid="${st.id}"] summary`); await page.click(`[data-exnew="${st.id}"]`);
  await page.selectOption("#x_type", "multiple_choice"); await page.fill("#x_q", "Ableitung von x²?");
  await page.fill("#x_opts", "x\n* 2x\nx³"); await page.click("#x_save"); await page.waitForTimeout(250);
  const ex = b.db.exercises.find(e => e.subtopic_id === st.id); assert.equal(ex.correct_index, 1);
  assert.ok((await page.textContent(`details[data-sid="${st.id}"]`)).includes("Noch kein Lernstand"));
  await page.click(`[data-practice="${st.id}"]`); await page.waitForSelector(".choices");
  await page.click('[data-pick="1"]'); await page.click("#ch_check"); await page.waitForSelector("#ch_next");
  const ev = b.db.learning_events.find(e => e.exercise_id === ex.id); assert.equal(ev.type, "exercise_correct"); assert.equal(ev.subtopic_id, st.id);
  // restliche Vorlagen ohne KI: Selbsteinschätzung
  await page.click("#ch_next"); await page.waitForSelector("#oa");
  await page.fill("#oa", "Die Ableitung beschreibt die Steigung."); await page.click("#oa_check");
  await page.waitForSelector("[data-rate]"); await page.click('[data-rate="0.5"]'); await page.click("#oa_next");
  await page.waitForSelector("#oa"); await page.click("#ts_end"); await page.click("#ce_yes");
  await page.waitForSelector("text=Lernstand");
  await shot(page, "05-session-ergebnis");
  await page.click("#sm_close"); await page.waitForSelector(".topic-head");
  const subText = await page.textContent(`details[data-sid="${st.id}"] summary`);
  assert.ok(/\d+ %/.test(subText), "Lernstand angezeigt: " + subText);
  assert.ok(b.db.subtopics.find(s => s.id === st.id).mastery_score > 0, "Lernstand-Cache gespeichert");
  await page.click(`details[data-sid="${st.id}"] summary`);
  await shot(page, "06-lernplan-detail");
  await ctx.close();
});

await scenario("KI: Erklären, Übung erzeugen + lösen, Prüfen, Korrigieren, Sokratisch, Hinweise", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b); await login(page);
  const st = b.db.subtopics.find(s => s.title === "Narrative Perspective");
  await go(page, "#/ki?sub=" + st.id + "&mode=erklaeren"); await page.waitForSelector("#ki_send");
  await page.click("#ki_send"); await page.waitForSelector(".kq");
  assert.equal(b.lastAi.subtopic_id, st.id, "Kontext-IDs werden mitgeschickt");
  await page.click('[data-ki="ueben"]'); await page.click("#ki_send"); await page.waitForSelector("[data-kpick]");
  const ex = b.db.exercises.find(e => e.source === "ai"); assert.ok(ex, "KI-Übung gespeichert");
  await page.click('[data-kpick$=":0"]'); await page.waitForTimeout(200);
  assert.ok(b.db.learning_events.some(e => e.exercise_id === ex.id && e.type === "exercise_correct"));
  await page.click('[data-ki="pruefen"]'); await page.click("#ki_send"); await page.waitForSelector(".kq");
  await page.fill("#ki_in", "Der personale Erzähler weiß alles."); await page.click("#ki_send"); await page.waitForSelector(".verdict.wrong");
  assert.ok(b.db.learning_events.some(e => e.detail && e.detail.mistake === "Personal vs. auktorial verwechselt"), "Fehler gespeichert");
  await page.click('[data-ki="korrigieren"]'); await page.fill("#ki_in", "I walked into the room. She looked at me."); await page.click("#ki_send");
  await page.waitForSelector(".rubric"); assert.ok((await page.textContent(".rubric")).includes("Lernhilfe, keine Note"));
  assert.ok(b.db.learning_events.some(e => e.type === "ai_feedback" && e.subtopic_id === st.id));
  await shot(page, "07-ki-korrektur");
  await page.click('[data-ki="sokratisch"]'); await page.click("#ki_send"); await page.waitForSelector(".kq");
  // Hinweise im Trainer
  await page.evaluate(id => startTraining({ mode: "topic", subtopic_id: id }), st.id);
  await page.waitForSelector(".fx-card");
  if (await page.$("#hint_btn")) { await page.click("#hint_btn"); await page.waitForSelector(".hint-it"); assert.equal(b.lastAi.level, 1); }
  // Weakspots und Weiterlernen auf dem Dashboard
  await page.click("#ts_end"); await page.click("#ce_yes"); await page.click("#sm_close");
  await go(page, "#/dashboard"); await page.waitForSelector(".dash");
  const dash = await page.textContent(".dash");
  assert.ok(dash.includes("Narrative Perspective"), "Dashboard kennt das Unterthema");
  await shot(page, "08-dashboard-nach-lernen");
  await ctx.close();
});

await scenario("KI nicht eingerichtet: klare Meldung, Eingabe bleibt erhalten, Rest funktioniert", async () => {
  const b = new MockBackend({ ai: false }); const { ctx, page } = await open(b); await login(page);
  const st = b.db.subtopics.find(s => s.title === "Narrative Perspective");
  await go(page, "#/ki?sub=" + st.id + "&mode=korrigieren"); await page.waitForSelector("#ki_in");
  await page.fill("#ki_in", "Mein Text"); await page.click("#ki_send"); await page.waitForTimeout(400);
  assert.ok((await page.textContent("#view")).includes("noch nicht eingerichtet"));
  await page.reload(); await page.waitForSelector("#ki_in");
  assert.equal(await page.inputValue("#ki_in"), "Mein Text", "Entwurf gespeichert");
  await ctx.close();
});

await scenario("Offline: Antworten werden gepuffert und nach der Verbindung nachgereicht", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b); await login(page);
  await page.evaluate(() => startTraining({ mode: "vocab", count: 5 })); await page.waitForSelector("#va");
  b.offline = true;
  await page.fill("#va", "xyz"); await page.click("#va_check"); await page.waitForSelector(".fb");
  await page.waitForFunction(() => Api.pending > 0, null, { timeout: 3000 }).catch(() => {});
  const pending = await page.evaluate(() => Api.pending); assert.ok(pending > 0, "Schreibvorgänge gepuffert: " + pending);
  assert.equal(b.db.learning_events.filter(e => e.type.startsWith("vocabulary")).length, 0);
  b.offline = false; await page.evaluate(() => Api.flush()); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => Api.pending), 0);
  assert.equal(b.db.learning_events.filter(e => e.type === "vocabulary_wrong").length, 1, "nachgereicht, ohne Duplikat");
  // Offline-Start aus dem gespeicherten Stand
  await page.evaluate(() => saveSnap());
  b.offline = true; await page.reload(); await page.waitForSelector("#va");   // laufende Session offline wiederhergestellt
  await go(page, "#/dashboard"); await page.waitForSelector(".dash");
  assert.ok((await page.textContent("#view")).includes("Offline"), "Offline-Hinweis statt leerer Seite");
  b.offline = false; await ctx.close();
});

await scenario("Abmelden und erneut anmelden: Daten und aktive Session bleiben", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b); await login(page);
  await page.evaluate(() => startTraining({ mode: "free" })); await page.waitForSelector(".fx-big-time");
  await page.reload(); await page.waitForSelector(".fx-big-time"); // Session nach Reload wieder offen
  await go(page, "#/einstellungen"); await page.click("#s_logout"); await page.waitForSelector("#auth_form");
  assert.equal(b.db.training_sessions[0].status, "abandoned", "Session beim Abmelden sauber beendet");
  await login(page);
  assert.ok((await page.textContent(".dash")).includes("Short Story Writing"));
  await ctx.close();
});

await scenario("Ohne Migration: Einrichtungshinweis, Schulseiten funktionieren weiter", async () => {
  const b = new MockBackend({ engine: false }); const { ctx, page } = await open(b);
  await page.waitForSelector(".dash"); assert.ok((await page.textContent(".dash")).includes("Lern-Engine einrichten"));
  await go(page, "#/aufgaben"); await page.waitForSelector("text=S. 42");
  await go(page, "#/vokabeln"); assert.ok((await page.textContent("#view")).includes("003_learning_engine.sql"));
  await ctx.close();
});

await scenario("Mobil: Dashboard, Trainer und Lernplan ohne horizontales Scrollen", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b, { viewport: { width: 390, height: 844 } }); await login(page);
  for (const h of ["#/dashboard", "#/vokabeln", "#/lernplan/" + b.db.klausuren[0].id, "#/fortschritt", "#/ki", "#/trainer"]) {
    await go(page, h); await page.waitForTimeout(300);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(w <= 392, h + " zu breit: " + w);
    await shot(page, "m-" + h.replace(/[#\/]/g, "_"));
  }
  await page.evaluate(() => startTraining({ mode: "mixed" })); await page.waitForSelector(".fx-card");
  await shot(page, "m-trainer-session");
  await ctx.close();
});

await scenario("Fortschritt zeigt nur echte Werte und sinnvolle Leerzustände", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b); await login(page);
  await go(page, "#/fortschritt"); await page.waitForSelector(".kpis");
  const t = await page.textContent("#view");
  assert.ok(!/NaN|undefined|Infinity/.test(t));
  assert.ok(t.includes("Noch keine Lernzeit"), "ehrlicher Leerzustand");
  await shot(page, "09-fortschritt");
  await ctx.close();
});

await scenario("Vokabeltest: eintragen, Liste einfügen, verteilt lernen, Probetest", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b); await login(page);
  const testDay = await page.evaluate(() => addDays(todayISO(), 4));
  await go(page, "#/lernplan"); await page.click("#lp_vt"); await page.waitForSelector("#vt_name");
  await page.fill("#vt_name", "Voc. 7A p. 222/223"); await page.fill("#vt_date", testDay);
  await page.click("#vt_save");
  await page.waitForSelector("#im_txt");
  const list = ["la rentrée - der Schulbeginn", "le collège - die Gesamtschule", "avoir peur de qc = Angst haben vor etw.", "la cantine\tdie Kantine", "peut-être ; vielleicht", "l'emploi du temps – der Stundenplan", "le/la prof - der/die Lehrer/in", "réussir - schaffen, gelingen", "la récré - die Pause", "nur ein Wort", "la cantine - doppelt"];
  await page.fill("#im_txt", list.join("\n")); await page.waitForTimeout(300);
  assert.match(await page.textContent("#im_prev"), /9 Vokabeln erkannt · ist schon drin|9 Vokabeln erkannt/);
  await shot(page, "vt-01-import");
  await page.click("#im_go"); await page.waitForSelector("#vt_learn");
  const k = b.db.klausuren.find(x => /^Vokabeltest: Voc\. 7A/.test(x.thema)); assert.ok(k, "Test gespeichert");
  assert.equal(k.datum, testDay); assert.equal(k.description, "Vokabeltest");
  const col = b.db.vocab_collections.find(c => c.name === "Voc. 7A p. 222/223"); assert.ok(col); assert.equal(col.source_language, "fr");
  assert.deepEqual(k.vokabel_lektionen, [col.name]);
  const cards = b.db.vokabeln.filter(v => v.collection_id === col.id); assert.equal(cards.length, 9);
  const t = await page.textContent("#view");
  assert.ok(t.includes("Noch keine Vorhersage"), "ehrliche Bereitschaft");
  assert.ok(t.includes("3 neue Vokabeln"), "9 Wörter auf 3 Lerntage verteilt");
  assert.ok(t.includes("Alles wiederholen + Probetest"));
  await shot(page, "vt-02-detail");
  // Tagesplan: Test steht oben
  await go(page, "#/dashboard"); await page.waitForSelector(".dash");
  assert.ok((await page.textContent(".mission")).includes("Vokabeltest in 4 Tagen"));
  assert.ok((await page.textContent(".a-cont")).includes("Voc. 7A p. 222/223"), "Als Nächstes: der Test");
  // Lernen: Deutsch → Französisch, eine Antwort falsch
  await go(page, "#/lernplan/" + k.id); await page.click("#vt_learn"); await page.waitForSelector(".fx-card");
  await playRoundUI(page, n => n === 0);
  await page.waitForSelector(".fx-done");
  const sum = await page.textContent("#fxStage");
  assert.ok(sum.includes("Noch üben"), "falsche Wörter mit Lösung"); assert.ok(sum.includes("Bis zum Test"));
  assert.ok(sum.includes("Runde geschafft"), "klares Ende"); assert.ok(sum.includes("nachgelernt"));
  await shot(page, "vt-03-summary");
  const ev = b.db.learning_events.filter(e => e.vocab_id && cards.some(c => c.id === e.vocab_id));
  assert.equal(ev.filter(e => e.type === "vocabulary_correct").length, 2 , "2 richtig");
  const reviewed = b.db.vokabeln.filter(v => v.collection_id === col.id && v.last_reviewed_at);
  assert.equal(reviewed.length, 3, "heute nur der Tagesanteil");
  const cap = await page.evaluate(d => new Date(d + "T00:00:00").getTime() - 864e5, testDay);
  assert.ok(reviewed.every(v => new Date(v.next_review_at).getTime() <= cap), "Wiederholung spätestens am Vortag");
  const sess = b.db.training_sessions.find(s => String(s.exam_id) === String(k.id)); assert.equal(sess.mode, "vocab");
  // Probetest: alle Wörter, Zeitlimit, ohne Rückmeldung
  await page.click("#sm_close").catch(() => {}); await page.waitForTimeout(200);
  await go(page, "#/lernplan/" + k.id); await page.click("#vt_probe"); await page.click("#pm_go"); await page.waitForSelector("#va");
  assert.ok(await page.evaluate(() => TS.mode === "exam" && TS.items.length === 9 && !TS.feedback && TS.time_limit_s > 0));
  for (let i = 0; i < 9; i++) { await page.fill("#va", "x"); await page.click("#va_check"); }
  await page.waitForSelector(".fx-done");
  assert.ok((await page.textContent("#fxStage")).includes("Probetest"));
  assert.ok(await page.evaluate(() => TS.items.length === 9), "keine Wiederholungen im Probetest");
  // Vortag des Tests: Auftrag = alle Wörter wiederholen + Probetest (heute schon geschrieben → abgehakt)
  const steps = await page.evaluate(id => { const k = klById(id); k.datum = addDays(todayISO(), 1); bump(); return todayPlan().items.filter(i => String(i.exam_id) === String(id)).map(i => i.kind + (i.kind === "probe" ? ":" + i.done : "")); }, k.id);
  assert.deepEqual(steps, ["test", "probe:true"], steps.join());
  await ctx.close();
});

await scenario("Geräte-Abgleich: Training auf dem Handy fortsetzen, Stand zurück am Laptop", async () => {
  const b = new MockBackend();
  const A = await open(b); await login(A.page);
  await A.page.evaluate(() => startTraining({ mode: "vocab", count: 5 })); await A.page.waitForSelector("#va");
  await A.page.fill("#va", "egal"); await A.page.click("#va_check");
  if (await A.page.$("#vc")) await A.page.fill("#vc", await A.page.evaluate(() => Engine.vocabSides(cardById(Engine.current(TS).vocab_id), Engine.current(TS).direction).answers[0]));
  await A.page.click("#va_next");
  await A.page.evaluate(async () => { tsSync(); await Api.idle(); });
  const idA = await A.page.evaluate(() => TS.id);
  // Handy: übernimmt das laufende Training
  const B = await open(b, { viewport: { width: 390, height: 844 } }); await login(B.page);
  assert.equal(await B.page.evaluate(() => TS && TS.id), idA, "Session übernommen");
  assert.equal(await B.page.evaluate(() => TS.answers.length), 1, "bisherige Antwort ist dabei");
  await B.page.evaluate(() => { location.hash = "#/trainer/session"; }); await B.page.waitForSelector("#va");
  await B.page.fill("#va", "auch egal"); await B.page.click("#va_check");
  if (await B.page.$("#vc")) await B.page.fill("#vc", await B.page.evaluate(() => Engine.vocabSides(cardById(Engine.current(TS).vocab_id), Engine.current(TS).direction).answers[0]));
  await B.page.click("#va_next");
  await B.page.evaluate(async () => { tsSync(); await Api.idle(); });
  // Laptop holt den neueren Stand
  await A.page.evaluate(() => refreshData("test")); await A.page.waitForTimeout(300);
  assert.equal(await A.page.evaluate(() => TS.answers.length), 2, "Fortschritt vom Handy ist am Laptop da");
  const reviewedOnPhone = await B.page.evaluate(() => TS.answers[1] && TS.items[TS.answers[1].index].vocab_id);
  assert.ok(await A.page.evaluate(id => !!STATE.vo.find(v => String(v.id) === String(id)).last_reviewed_at, reviewedOnPhone), "Karten-Lernstand synchronisiert");
  // Auf dem Handy beendet → am Laptop nicht mehr offen
  await B.page.evaluate(async () => { await tsFinish("abandoned", true); await Api.idle(); });
  await A.page.evaluate(() => refreshData("test")); await A.page.waitForTimeout(300);
  assert.equal(await A.page.evaluate(() => tsActive()), false);
  await A.ctx.close(); await B.ctx.close();
});

await scenario("Lernrunde: einprägen, 3× richtig, Fehler abtippen und später aus dem Kopf, dann „Fertig für heute“", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b); await login(page);
  // eigene Sammlung mit 4 neuen Wörtern
  const colId = await page.evaluate(async () => { const r = await dbInsert("vocab_collections", { name: "Leçon 7", source_language: "fr", target_language: "de" }); return r.row.id; });
  await page.evaluate(async id => { const c = colById(id); for (const [f, d] of [["la gare", "der Bahnhof"], ["réussir", "schaffen"], ["peut-être", "vielleicht"], ["la cantine", "die Kantine"]]) { const r = await Api.insert("vokabeln", { begriff: f, bedeutung: d, collection_id: id, sprache: c.name, source_language: "fr", target_language: "de", level: 0, next: todayISO() }); STATE.vo.push(normVO(r)); } bump(); }, colId);
  await page.evaluate(id => startTraining({ mode: "vocab", collection_id: id, direction: "reverse" }), colId);
  await page.waitForSelector(".study-ans");
  assert.ok(await page.$eval("#st_next", b => b.disabled), "erst abschreiben");
  await shot(page, "lr-01-einpraegen");
  if (SHOTS) { await page.setViewportSize({ width: 390, height: 844 }); await shot(page, "lr-01m-einpraegen"); await page.setViewportSize({ width: 1280, height: 860 }); }
  // eine falsche Antwort: Lösung mit markierten Buchstaben, abtippen, später erneut
  let shotDone = false;
  for (let guard = 0; guard < 60; guard++) {
    const it = await page.evaluate(() => { const it = TS && TS.status === "active" && Engine.current(TS); if (!it) return null; const c = cardById(it.vocab_id); return { kind: it.kind, ans: Engine.vocabSides(c, it.direction).answers[0], id: it.vocab_id, retry: !!it.retry, raw: c.begriff }; });
    if (!it) break;
    if (it.kind === "vocab_study") { await page.fill("#vc", it.ans); await page.click("#st_next"); continue; }
    const bad = it.raw === "réussir" && !it.retry;
    await page.fill("#va", bad ? "rester" : it.ans); await page.click("#va_check");
    if (bad) {
      assert.ok(await page.$("mark.dif"), "falsche Buchstaben markiert");
      if (!shotDone) { await shot(page, "lr-02-korrektur"); shotDone = true; }
      await page.fill("#vc", "réussir");
    }
    await page.click("#va_next");
  }
  await page.waitForSelector(".done-mark");
  const t = await page.textContent("#fxStage");
  assert.ok(t.includes("Runde geschafft")); assert.ok(t.includes("1 nachgelernt"), t);
  const answers = await page.evaluate(() => TS.answers.filter(a => a.verdict).length);
  assert.equal(answers, 4 * 3 + 1, "4 neue Wörter × 3 richtige + 1 Fehler");
  await shot(page, "lr-03-geschafft");
  await page.evaluate(() => Api.idle());
  const rows = b.db.vokabeln.filter(v => v.collection_id === colId);
  assert.ok(rows.every(v => +v.ease >= 10), "FSRS-Zustand gespeichert");
  assert.equal(b.db.learning_events.filter(e => rows.some(r => r.id === e.vocab_id)).length, 4, "ein Lernereignis je Wort (erster Abruf)");
  // Fehler-Wort ist schwerer als die anderen
  const hard = rows.find(v => v.begriff === "réussir"), easy = rows.find(v => v.begriff === "la gare");
  assert.ok(+hard.ease > +easy.ease && +hard.interval_days < +easy.interval_days);
  // Vokabelseite: Fertig für heute (4 von 10 neuen genutzt, Sammlung leer) bzw. Stufen
  await page.click("#sm_close").catch(() => {}); await go(page, "#/vokabeln/" + colId); await page.waitForSelector(".stage");
  assert.ok((await page.textContent("#view")).includes("Lernen"), "Stufe sichtbar");
  await ctx.close();
});

await scenario("Auftrag für heute: Themen festlegen, Probeklausur schreiben und auswerten, nächster Schritt", async () => {
  const b = new MockBackend();
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  b.db.klausuren[0].datum = day(4);                                  // Englisch: Probeklausur heute fällig
  b.db.klausuren.push({ id: "11111111-aaaa-4aaa-8aaa-000000000009", fach: "Mathe", thema: "Klausur Nr. 1", datum: day(7), nr: 1, themen: [], material: [], mitnehmen: [], punkte: null, vokabel_lektionen: [], topics_migrated: false });
  const { ctx, page } = await open(b); await login(page);
  await page.waitForSelector(".mission");
  let t = await page.textContent(".mission");
  assert.ok(t.includes("Festlegen, was in Mathe drankommt"), "zuerst Themen festlegen");
  assert.ok(t.includes("Probeklausur Englisch"), "Probeklausur 4 Tage vorher");
  assert.ok(t.indexOf("Festlegen") < t.indexOf("Probeklausur"), "Reihenfolge");
  await shot(page, "au-01-auftrag");
  // 1. Themen festlegen über den großen Knopf
  await page.click("#plan_go"); await page.waitForSelector(".pickchip");
  await page.click('[data-pick="1"]'); await page.click('[data-pick="4"]');
  await page.fill("#ta_more", "Integrale (Ausblick)");
  await shot(page, "au-02-themen");
  await page.click("#ta_save"); await page.waitForTimeout(400); await page.evaluate(() => Api.idle());
  const mathTopic = b.db.topics.find(x => x.exam_id === "11111111-aaaa-4aaa-8aaa-000000000009");
  assert.deepEqual(b.db.subtopics.filter(x => x.topic_id === mathTopic.id).map(x => x.title), ["Negative Exponenten (x⁻¹, x⁻²)", "Strecken, Spiegeln, Verschieben", "Integrale (Ausblick)"]);
  t = await page.textContent(".mission");
  assert.ok(!t.includes("Festlegen, was in Mathe"), "Schritt erledigt: " + t);
  // 2. Probeklausur Englisch mit eigener Aufgabe
  const mi = await page.evaluate(() => todayPlan().items.findIndex(i => i.kind === "mock"));
  await page.click(`[data-plan="${mi}"]`); await page.waitForSelector("#mk_task");
  const prompt = await page.evaluate(() => mockPrompt(klById("11111111-aaaa-4aaa-8aaa-000000000001"), 90));
  assert.ok(prompt.includes("Englisch") && prompt.includes("Narrative Perspective") && prompt.includes("90 Minuten"));
  await page.fill("#mk_task", "Analyse the narrative perspective of the short story.");
  await page.click("#mk_go"); await page.waitForSelector("#mo_ans");
  await page.fill("#mo_ans", "The story is told by a first-person narrator ...");
  await shot(page, "au-03-probeklausur");
  await page.click("#mo_done"); await page.click("#md_yes"); await page.waitForSelector(".mrate");
  assert.ok(await page.$eval("#me_done", x => x.disabled), "erst alle Themen bewerten");
  const subs = await page.$$eval("[data-mr]", xs => [...new Set(xs.map(x => x.dataset.mr.split(":")[0]))]);
  for (const [i, id] of subs.entries()) await page.click(`[data-mr="${id}:${i === 0 ? 0 : 1}"]`);
  await page.fill("#me_pts", "9");
  const corr = await page.evaluate(() => correctionPrompt(klById(TS.scope.exam_id), TS.items[0].task, TS.items[0].answer));
  assert.ok(corr.includes("first-person narrator") && corr.includes("Analyse the narrative"));
  await shot(page, "au-04-auswertung");
  await page.click("#me_done"); await page.waitForSelector(".fx-done");
  await page.evaluate(() => Api.idle());
  const ev = b.db.learning_events.filter(e => e.type === "exam_result" && e.detail.mode === "mock");
  assert.equal(ev.length, subs.length); assert.equal(ev[0].detail.points, 9);
  assert.ok(b.db.training_sessions.some(x => x.mode === "exam" && x.status === "completed" && x.exam_id === "11111111-aaaa-4aaa-8aaa-000000000001"));
  assert.ok(await page.$("#sm_next"), "direkt weiter zum nächsten Schritt");
  // Auftrag: Probeklausur abgehakt
  await page.click("#sm_close"); await go(page, "#/dashboard"); await page.waitForSelector(".mission");
  assert.ok(await page.$eval(".mstep.done", x => x.textContent.includes("Probeklausur Englisch")));
  // Fahrplan der Klausurseite: morgen nacharbeiten
  await go(page, "#/lernplan/11111111-aaaa-4aaa-8aaa-000000000001"); await page.waitForSelector(".tl");
  const tl = await page.textContent(".tl");
  assert.ok(tl.includes("Probeklausur nacharbeiten") && tl.includes("Locker wiederholen"), tl);
  await ctx.close();
});

await scenario("Zugangslink: ohne Login-Seite rein, neuer Link macht den alten ungültig", async () => {
  const b = new MockBackend();
  const A = await open(b); await login(A.page);
  await go(A.page, "#/einstellungen"); await A.page.click("#s_link_new"); await A.page.click("#al_yes");
  await A.page.waitForSelector("#s_link");
  const link1 = await A.page.inputValue("#s_link");
  assert.match(link1, /#zugang=[A-Za-z0-9_-]+$/);
  assert.notEqual(b.users["filip@example.org"].password, "geheim123", "neues Zufallspasswort");
  // neues Gerät: Link öffnen → direkt im Dashboard, keine Anmeldung, Schlüssel aus der Adresse entfernt
  const B = await open(b, { hash: link1.slice(link1.indexOf("#")) });
  await B.page.waitForSelector(".dash", { timeout: 15000 });
  assert.ok(!(await B.page.$("#auth_form")));
  assert.equal(await B.page.evaluate(() => location.hash), "#/dashboard");
  // Sitzung läuft ab → automatisch wieder drin
  await B.page.evaluate(() => { localStorage.removeItem("lc_auth"); }); await B.page.reload(); await B.page.waitForSelector(".dash", { timeout: 15000 });
  // neuer Link auf Gerät A → alter Link funktioniert nicht mehr
  await A.page.click("#s_link_new"); await A.page.click("#al_yes"); await A.page.waitForTimeout(400);
  const link2 = await A.page.inputValue("#s_link"); assert.notEqual(link2, link1);
  const C = await open(b, { hash: link1.slice(link1.indexOf("#")) });
  await C.page.waitForSelector("#auth_form", { timeout: 15000 });
  const D = await open(b, { hash: link2.slice(link2.indexOf("#")) });
  await D.page.waitForSelector(".dash", { timeout: 15000 });
  // Abmelden vergisst den Link auf diesem Gerät
  await go(D.page, "#/einstellungen"); await D.page.click("#s_logout"); await D.page.waitForSelector("#auth_form");
  assert.equal(await D.page.evaluate(() => Api.hasAccess()), false);
  for (const x of [A, B, C, D]) await x.ctx.close();
});

await scenario("Ohne Anmeldung (Migration 005): direkt im Dashboard, Daten speichern und lesen", async () => {
  const b = new MockBackend({ open: true });
  b.db.klausuren.forEach(k => { k.user_id = "aaaaaaaa-0000-4000-8000-000000000001"; });
  const { ctx, page } = await open(b);
  await page.waitForSelector(".dash", { timeout: 15000 });
  assert.ok(!(await page.$("#auth_form")), "keine Login-Seite");
  // Vokabel anlegen und lernen funktioniert ohne Konto
  await page.evaluate(() => startTraining({ mode: "vocab", count: 5 })); await page.waitForSelector(".fx-card");
  await page.evaluate(() => Api.idle());
  assert.ok(b.db.training_sessions.length >= 1, "Session gespeichert");
  // Einstellungen: kein Konto/Abmelden, Hinweis auf offenen Zugang
  await page.evaluate(() => { TS = null; tsSave(); }); await go(page, "#/einstellungen"); await page.waitForTimeout(300);
  const t = await page.textContent("#view");
  assert.ok(t.includes("ohne Anmeldung")); assert.ok(!(await page.$("#s_logout")));
  // zweites Gerät sieht denselben Stand, ebenfalls ohne Login
  const B = await open(b); await B.page.waitForSelector(".dash", { timeout: 15000 });
  assert.ok(await B.page.evaluate(() => ES.sessions.length >= 1));
  await ctx.close(); await B.ctx.close();
});

await scenario("Vokabeltest per Aushang eingetragen (ohne Wörter): sichtbar, Wörter eintragen, lernen", async () => {
  const b = new MockBackend();
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  b.db.klausuren.push({ id: "11111111-aaaa-4aaa-8aaa-0000000000aa", fach: "Französisch", thema: "Voc. 8B test de vocabulaire", datum: day(3), themen: [], material: [], mitnehmen: [], punkte: null, vokabel_lektionen: [], topics_migrated: true });
  const { ctx, page } = await open(b); await login(page);
  await page.waitForSelector(".mission");
  assert.ok((await page.textContent(".mission")).includes("Vokabeln eintragen: Voc. 8B"), "Test im Auftrag, obwohl noch ohne Wörter");
  await go(page, "#/vokabeln"); await page.waitForSelector(".li");
  const vt = await page.textContent("#view");
  assert.ok(vt.includes("Vokabeltests") && vt.includes("noch keine Vokabeln eingetragen"), "Vokabelseite zeigt den Test");
  await go(page, "#/dashboard"); await page.waitForSelector(".mission");
  const i = await page.evaluate(() => todayPlan().items.findIndex(x => x.kind === "testsetup"));
  await page.click(`[data-plan="${i}"]`);
  await page.waitForSelector("#im_txt", { timeout: 8000 });
  await page.fill("#im_txt", "la cantine - die Kantine\nle collège - die Gesamtschule\nla récré - die Pause"); await page.waitForTimeout(300);
  await page.click("#im_go"); await page.waitForSelector("#vt_learn");
  await page.evaluate(() => Api.idle());
  const k = b.db.klausuren.find(x => x.id === "11111111-aaaa-4aaa-8aaa-0000000000aa");
  assert.equal(k.vokabel_lektionen.length, 1, "Sammlung verknüpft");
  assert.equal(b.db.vokabeln.filter(v => v.sprache === k.vokabel_lektionen[0]).length, 3);
  await go(page, "#/dashboard"); await page.waitForSelector(".mission");
  const kinds = await page.evaluate(() => todayPlan().items.filter(x => x.exam_id === "11111111-aaaa-4aaa-8aaa-0000000000aa").map(x => x.kind));
  assert.deepEqual(kinds, ["test"], "jetzt: Lernrunde für den Test");
  await ctx.close();
});

await scenario("Vokabeln in beide Richtungen gemischt: jedes Wort in beide Richtungen, Handy ohne Querscrollen", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b, { viewport: { width: 390, height: 844 } }); await login(page);
  const col = b.db.vocab_collections.find(c => c.name === "Unité 1");
  await go(page, "#/vokabeln/" + col.id); await page.waitForSelector('[data-vdir="both"]');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "kein Querscrollen");
  await page.click('[data-vdir="both"]'); await page.waitForSelector('[data-vdir="both"].on');
  await page.click('[data-vstart="vocab"]'); await page.waitForSelector("#vs_go");
  assert.ok((await page.textContent("#vs_body")).includes("in beide Richtungen richtig"));
  await page.click("#vs_go"); await page.waitForSelector(".fx-card");
  await playRoundUI(page);
  await page.waitForSelector(".done-mark");
  const dirs = await page.evaluate(() => { const m = {}; TS.answers.forEach(a => { const it = TS.items[a.index]; (m[it.vocab_id] = m[it.vocab_id] || new Set()).add(it.direction); }); return Object.values(m).map(x => x.size); });
  assert.ok(dirs.length > 0 && dirs.every(n => n === 2), "jedes Wort in beide Richtungen: " + dirs);
  await page.evaluate(() => Api.idle());
  assert.equal(b.db.training_sessions.at(-1).direction, null, "DB bekommt keinen ungültigen Wert");
  await ctx.close();
});

const openApp = async (o = {}) => { const b = new MockBackend(Object.assign({ open: true, version: 6 }, o)); b.db.klausuren.forEach(k => { k.user_id = "aaaaaaaa-0000-4000-8000-000000000001"; }); const r = await open(b, o); await r.page.waitForSelector(".dash", { timeout: 15000 }); return Object.assign(r, { b }); };
const MINI_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");

await scenario("Material: PDF hochladen, ansehen, auf der Prüfungsseite; Zeichenblatt speichern und weiterzeichnen", async () => {
  const { ctx, page, b } = await openApp();
  await go(page, "#/material"); await page.waitForSelector("#mt_up");
  await page.click("#mt_up"); await page.setInputFiles("#up_file", { name: "Analyse_Struktur.pdf", mimeType: "application/pdf", buffer: MINI_PDF });
  assert.equal(await page.inputValue("#up_title"), "Analyse Struktur");
  await page.selectOption("#up_fach", "Englisch"); await page.click("#up_go");
  await page.waitForSelector("#pdfview"); await page.waitForSelector("#pdfview iframe, #pdfview canvas", { timeout: 12000 });
  const d = b.db.dokumente[0]; assert.equal(d.title, "Analyse Struktur"); assert.equal(d.kind, "pdf"); assert.equal(d.fach, "Englisch");
  assert.ok(b.files["material/" + d.path], "Datei im Speicher");
  await go(page, "#/material"); await page.waitForSelector(".doc-tile");
  await shot(page, "mat-01-liste");
  await go(page, "#/lernplan/11111111-aaaa-4aaa-8aaa-000000000001"); await page.waitForSelector(".doc-list");
  assert.ok((await page.textContent(".doc-list")).includes("Analyse Struktur"), "PDF auf der Englisch-Prüfungsseite");
  // Zeichenblatt
  await go(page, "#/material/zeichnen"); await page.waitForSelector("#sk_canvas");
  const box = await page.$eval("#sk_canvas", c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(box.x + 50, box.y + 50); await page.mouse.down();
  for (let i = 1; i < 20; i++) await page.mouse.move(box.x + 50 + i * 15, box.y + 50 + Math.sin(i / 3) * 40);
  await page.mouse.up();
  await page.click('[data-skt="marker"]'); await page.mouse.move(box.x + 100, box.y + 150); await page.mouse.down(); await page.mouse.move(box.x + 300, box.y + 150); await page.mouse.up();
  assert.equal(await page.evaluate(() => SKETCH.strokes.length), 2);
  await page.click("#sk_undo"); assert.equal(await page.evaluate(() => SKETCH.strokes.length), 1, "Rückgängig");
  await shot(page, "mat-02-zeichenblatt");
  await page.click("#sk_save"); await page.fill("#sv_t", "Mindmap Kommunikation"); await page.selectOption("#sv_f", "Deutsch"); await page.click("#sv_s");
  await page.waitForSelector(".imgview img");
  const sk = b.db.dokumente.find(x => x.kind === "skizze"); assert.ok(sk); assert.equal(sk.fach, "Deutsch");
  assert.equal(b.files["material/" + sk.path].type, "image/png");
  const size1 = b.files["material/" + sk.path].data.length;
  await go(page, "#/material/zeichnen-" + sk.id); await page.waitForSelector("#sk_canvas"); await page.waitForTimeout(300);
  await page.mouse.move(box.x + 400, box.y + 300); await page.mouse.down(); await page.mouse.move(box.x + 600, box.y + 400); await page.mouse.up();
  await page.click("#sk_save"); await page.waitForSelector(".imgview img");
  assert.equal(b.db.dokumente.filter(x => x.kind === "skizze").length, 1, "überschrieben, nicht doppelt");
  assert.notEqual(b.files["material/" + sk.path].data.length, size1);
  await ctx.close();
});

await scenario("Material ohne Migration 006: Einrichtungshinweis statt Fehler", async () => {
  const { ctx, page } = await openApp({ version: 5 });
  await go(page, "#/material"); await page.waitForTimeout(300);
  assert.ok((await page.textContent("#view")).includes("006_material.sql"));
  await ctx.close();
});

await scenario("Spiele: Memory, Blitz und Buchstabensalat bis zum Ende, Bestwerte", async () => {
  const { ctx, page } = await openApp();
  await go(page, "#/spiele"); await page.waitForSelector(".game-tile");
  await shot(page, "sp-01-spiele");
  // Memory
  await page.click('[data-game="memory"]'); await page.waitForSelector(".mem-card");
  const pairs = await page.evaluate(() => { const m = {}; GAME.tiles.forEach((t, i) => (m[t.pair] = m[t.pair] || []).push(i)); return Object.values(m); });
  for (const [a, c] of pairs) { await page.click(`[data-mem="${a}"]`); await page.click(`[data-mem="${c}"]`); }
  await page.waitForSelector(".done-mark");
  assert.equal(await page.evaluate(() => GAME.moves), pairs.length);
  assert.ok((await page.textContent("#view")).includes("Neuer Bestwert"));
  // Blitz
  await go(page, "#/spiele"); await page.click('[data-game="blitz"]'); await page.waitForSelector("[data-bz]");
  for (let i = 0; i < 3; i++) { const c = await page.evaluate(() => GAME.q.correct); await page.click(`[data-bz="${c}"]`); await page.waitForTimeout(450); }
  const wrong = await page.evaluate(() => (GAME.q.correct + 1) % GAME.q.opts.length); await page.click(`[data-bz="${wrong}"]`);
  assert.equal(await page.evaluate(() => GAME.right), 3); assert.ok(await page.evaluate(() => GAME.score) > 30, "Serienbonus");
  await page.evaluate(() => { GAME.ends = Date.now() - 1; }); await page.waitForSelector(".done-mark", { timeout: 3000 });
  assert.ok((await page.textContent("#view")).includes("Noch üben"));
  // Buchstabensalat: mit Tipps lösen
  await go(page, "#/spiele"); await page.click('[data-game="salat"]'); await page.waitForSelector(".sl-tile");
  for (let guard = 0; guard < 200 && !(await page.$(".done-mark")); guard++) { await page.click("#sl_hint", { timeout: 1000 }).catch(() => {}); await page.waitForTimeout(80); }
  await page.waitForSelector(".done-mark");
  await ctx.close();
});

await scenario("Aufräumen: kein „Geschrieben“, keine Hinweise; alte Vokabeltest-Sammlung im Archiv", async () => {
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const b0 = { open: true, version: 6 };
  const bb = new MockBackend(b0); bb.db.klausuren.forEach(k => { k.user_id = "aaaaaaaa-0000-4000-8000-000000000001"; });
  bb.db.klausuren.push({ id: "11111111-aaaa-4aaa-8aaa-0000000000bb", fach: "Französisch", thema: "Vokabeltest: Unité 1", datum: day(-3), themen: [], material: [], mitnehmen: [], punkte: null, vokabel_lektionen: ["Unité 1"], topics_migrated: true, user_id: "aaaaaaaa-0000-4000-8000-000000000001" });
  bb.db.neuigkeiten.push({ id: "n1", titel: "Wandertag", gelesen: false, created: new Date().toISOString() });
  const { ctx, page } = await open(bb); await page.waitForSelector(".dash", { timeout: 15000 });
  assert.ok(!(await page.textContent("#view")).includes("Hinweise"), "keine Hinweise-Ecke");
  await go(page, "#/lernplan"); await page.waitForTimeout(300);
  assert.ok(!(await page.$('[data-lptab]')), "kein Tab „Geschrieben“");
  await go(page, "#/vokabeln"); await page.waitForSelector(".archive");
  const tiles = await page.$$eval(".tile .tn", xs => xs.map(x => x.textContent));
  assert.ok(!tiles.includes("Unité 1"), "alte Test-Sammlung nicht mehr in der Liste");
  assert.ok(await page.$(".stagebar"), "Stufen statt Prozent-Durchschnitt");
  await shot(page, "auf-01-vokabeln");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const h of ["#/vokabeln", "#/material", "#/material/zeichnen", "#/spiele"]) { await go(page, h); await page.waitForTimeout(250); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), h + " zu breit"); }
  await page.setViewportSize({ width: 1280, height: 860 }); await go(page, "#/vokabeln"); await page.waitForSelector(".archive");
  await page.click(".archive summary"); await page.click("[data-unarch]"); await page.waitForTimeout(400);
  assert.ok((await page.$$eval(".tile .tn", xs => xs.map(x => x.textContent))).includes("Unité 1"), "wiederhergestellt");
  await ctx.close();
});

await scenario("Deutsch Extrem-Modus: einrichten, alle 8 Bereiche am Handy, speichern ohne Duplikate", async () => {
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const EX = "0bf7d143-fdb2-45f2-9633-44e33dfb8a98";
  const b = new MockBackend({ open: true, version: 6 }); b.db.klausuren.forEach(k => { k.user_id = "aaaaaaaa-0000-4000-8000-000000000001"; });
  b.db.klausuren.push({ id: EX, fach: "Deutsch", thema: "Kommunikationsanalyse", datum: day(1), uhrzeit: "07:55", nr: 1, themen: [], material: [], mitnehmen: [], punkte: null, vokabel_lektionen: [], topics_migrated: true, user_id: "aaaaaaaa-0000-4000-8000-000000000001" });
  const { ctx, page } = await open(b, { viewport: { width: 390, height: 844 } }); await page.waitForSelector(".dash", { timeout: 15000 });
  const wide = async h => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), h + " zu breit");
  await go(page, "#/lernplan"); await page.waitForSelector(`.dx-entry[href="#/extrem/${EX}"]`);
  await page.click(`.dx-entry[href="#/extrem/${EX}"]`); await page.waitForSelector(".dx-count", { timeout: 15000 });
  await page.evaluate(() => Api.idle());
  const topic = b.db.topics.find(t => t.exam_id === EX); assert.ok(topic, "Thema angelegt");
  const subs = b.db.subtopics.filter(x => x.topic_id === topic.id).map(x => x.title).sort();
  assert.deepEqual(subs, ["Absatz schreiben", "Aufbau", "Axiome", "Zitieren"]);
  const exs = b.db.exercises.filter(e => b.db.subtopics.some(x => x.id === e.subtopic_id && x.topic_id === topic.id));
  assert.ok(exs.length >= 60 && exs.every(e => e.source === "ai"), "Übungen als source ai: " + exs.length);
  assert.ok(exs.filter(e => e.question.startsWith("Welches Axiom?")).length >= 20, "mind. 20 Quizfragen");
  assert.deepEqual([...new Set(exs.map(e => e.type))].sort(), ["free_text", "matching", "multiple_choice", "short_writing"]);
  assert.ok((await page.textContent(".dx-count")).includes("Noch"), "Countdown");
  await wide("start"); await shot(page, "dx-01-start");
  // Karten
  await go(page, `#/extrem/${EX}?tab=karten`); await page.waitForSelector("#dk_card");
  await page.click("#dk_card"); await page.click("#dk_yes"); await page.click("#dk_card"); await page.click("#dk_no");
  await shot(page, "dx-02-karten"); await wide("karten");
  // Quiz: eine richtig, eine falsch
  await go(page, `#/extrem/${EX}?tab=quiz`); await page.waitForSelector("[data-dq]");
  let a = await page.evaluate(() => DX.QUIZ[DXU.q[DXU.p].i].a - 1); await page.click(`[data-dq="${a}"]`); await page.waitForSelector(".fb.ok"); await page.click("#dq_next");
  a = await page.evaluate(() => { const q = DX.QUIZ[DXU.q[DXU.p].i]; return [0, 1, 2, 3, 4].find(i => i !== q.a - 1 && i !== (q.auch || 0) - 1); }); await page.click(`[data-dq="${a}"]`); await page.waitForSelector(".fb.bad");
  assert.ok(await page.evaluate(() => DXU.q.some(x => x.retry)), "falsche Frage kommt nochmal");
  await shot(page, "dx-03-quiz"); await wide("quiz");
  // Aufbau
  await go(page, `#/extrem/${EX}?tab=aufbau`); await page.waitForSelector("[data-dp]");
  const before = await page.evaluate(() => DXU.order.slice()); await page.click('[data-down="0"]');
  assert.deepEqual(await page.evaluate(() => DXU.order.slice(0, 2)), [before[1], before[0]], "Pfeil verschiebt");
  await page.evaluate(() => { DXU.order = [0, 1, 2, 3, 4]; route(); }); await page.click("#dp_check");
  assert.ok((await page.textContent("#dx_body")).includes("Textsorte, Titel, Autor"), "Inhalte nach dem Lösen");
  await wide("aufbau");
  // Absatz: Originaltext einfügen, Absatz schreiben, Checkliste
  await go(page, `#/extrem/${EX}?tab=absatz`); await page.waitForSelector("#da_text");
  await page.click("#da_paste"); await page.fill("#dp_txt", "Zeile eins der Szene.\nRita sagt: „Ach, ich glaub schon.“\nSie drückt die Hand ans Holz."); await page.click("#dp_s");
  await page.waitForFunction(() => document.querySelectorAll(".dx-lines li").length === 3, null, { timeout: 5000 }).catch(() => {});
  assert.equal(await page.$$eval(".dx-lines li", x => x.length), 3);
  await page.fill("#da_text", await page.evaluate(() => DX.MUSTER)); await page.waitForTimeout(400);
  assert.equal(await page.$$eval("[data-dc]", x => x.filter(c => c.checked).length), 5, "Checkliste erkennt alle 5 Punkte");
  await shot(page, "dx-04-absatz"); await wide("absatz");
  await page.click("#da_save"); await page.evaluate(() => Api.idle());
  const ev = b.db.learning_events.filter(e => e.exam_id === EX);
  assert.ok(ev.some(e => e.type === "self_assessment" && +e.result === 1 && e.detail.mode === "absatz"), "Absatz gespeichert");
  assert.ok(ev.some(e => e.detail.mode === "leitner") && ev.some(e => e.detail.mode === "quiz") && ev.some(e => e.detail.mode === "aufbau"));
  assert.ok(b.db.einstellungen.some(x => /^extrem_szenen_/.test(x.key)), "eingefügter Text gespeichert");
  // Zitieren
  await go(page, `#/extrem/${EX}?tab=zitieren`);
  for (let i = 0; i < 5; i++) { await page.waitForSelector("[data-dz]"); const c = await page.evaluate(() => DX.ZITIER[DXU.i].c); await page.click(`[data-dz="${c}"]`); await page.click("#dz_next"); }
  assert.ok((await page.textContent("#dx_body")).includes("5 von 5"));
  // Begriffe
  await go(page, `#/extrem/${EX}?tab=begriffe`); await page.waitForSelector("[data-ml]");
  for (let i = 0; i < 5; i++) { await page.click(`[data-ml="${i}"]`); await page.click(`[data-mr="${i}"]`); }
  await page.click("#dm_check"); assert.ok((await page.textContent("#dx_body")).includes("5 von 5 richtig")); await wide("begriffe");
  // Fahrplan
  await go(page, `#/extrem/${EX}?tab=fahrplan`); await page.waitForSelector("[data-df]");
  await page.click('[data-df="0"]'); await page.waitForTimeout(300); await page.evaluate(() => Api.idle());
  assert.ok(b.db.einstellungen.some(x => /^extrem_fahrplan_/.test(x.key) && JSON.stringify(x.value) === "[0]"));
  await shot(page, "dx-05-fahrplan"); await wide("fahrplan");
  // Start zeigt Tagesziel-Fortschritt; erneutes Laden legt nichts doppelt an
  const n1 = b.db.exercises.length, s1 = b.db.subtopics.length;
  await page.reload(); await page.waitForSelector(".dx-tabs", { timeout: 15000 });
  await go(page, `#/extrem/${EX}`); await page.waitForSelector(".dx-count", { timeout: 15000 }); await page.evaluate(() => Api.idle());
  assert.equal(b.db.exercises.length, n1, "keine doppelten Übungen"); assert.equal(b.db.subtopics.length, s1);
  assert.ok((await page.textContent(".dx-goals")).includes("1/1"), "Absatz-Ziel erreicht");
  await ctx.close();
});

await scenario("Inhalts-Pakete: Kleidung-Vokabeln, Englisch archiviert, leichte Wörter, Mathe & Französisch – nur einmal", async () => {
  const b = new MockBackend({ packs: true });
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  b.db.klausuren = b.db.klausuren.filter(k => k.fach !== "Englisch");   // Englisch-Klausur vorbei
  b.db.klausuren.push({ id: "11111111-aaaa-4aaa-8aaa-0000000000m1", fach: "Mathe", thema: "Graphen, lineare Funktionen", datum: day(9), themen: [{ id: "a", text: "Grafen", done: false }, { id: "b", text: "linear", done: false }], material: [], mitnehmen: [], punkte: null, vokabel_lektionen: [], topics_migrated: false });
  b.db.klausuren.push({ id: "11111111-aaaa-4aaa-8aaa-0000000000f1", fach: "Französisch", thema: "Klausur Nr. 1", datum: day(12), themen: [], material: [], mitnehmen: [], punkte: null, vokabel_lektionen: [], topics_migrated: true });
  const { ctx, page } = await open(b); await login(page);
  await page.waitForFunction(() => Object.keys(setting("packs_done", {}) || {}).length === 7 && !PACKS_RUNNING, null, { timeout: 15000 });
  await page.evaluate(() => Api.idle());
  const vet = b.db.vocab_collections.find(c => c.name === "Les vêtements");
  assert.ok(vet && vet.source_language === "fr", "Sammlung angelegt");
  const n = b.db.vokabeln.filter(v => v.collection_id === vet.id).length;
  assert.equal(n, await page.evaluate(() => VETEMENTS.length), "alle Wörter der Mindmap");
  assert.ok(n >= 50);
  const unit = b.db.vocab_collections.find(c => c.name === "Unit 1");
  assert.ok(await page.evaluate(id => isArchived(id), unit.id), "Englisch archiviert");
  const bj = b.db.vokabeln.find(v => v.begriff === "bonjour");
  assert.ok(bj.reps >= 3 && +bj.interval_days === 60, "bonjour abgehakt");
  const av = b.db.vokabeln.find(v => v.begriff === "l'avenir");
  assert.ok(!av.reps && +av.interval_days !== 60, "normale Wörter bleiben neu");
  // Mathe: alte Themen pausiert, Potenzfunktionen aktiv
  const mk = b.db.klausuren.find(k => k.fach === "Mathe");
  assert.equal(mk.thema, "Potenzfunktionen");
  const mt = b.db.topics.filter(t => t.exam_id === mk.id);
  assert.ok(mt.some(t => t.title === "Potenzfunktionen" && t.status === "active"));
  assert.ok(mt.filter(t => t.title !== "Potenzfunktionen").every(t => t.status === "paused") && mt.length >= 2, "alte Themen pausiert");
  const msubs = await page.evaluate(id => subsOfExam(id).map(s => s.title), mk.id);
  assert.equal(msubs.length, 5); assert.ok(!msubs.includes("Grafen"));
  // Französisch: Vokabeln verknüpft, Themen für Texte / Listening / Grammatik
  const fk = b.db.klausuren.find(k => k.fach === "Französisch");
  assert.ok(fk.vokabel_lektionen.includes("Les vêtements"));
  const fsubs = await page.evaluate(id => subsOfExam(id).map(s => s.title), fk.id);
  assert.ok(fsubs.some(t => /Texte schreiben/.test(t)) && fsubs.some(t => /Listening/.test(t)) && fsubs.length === 3);
  // Fahrschule: PDF-Karten + Extras, eigener Knopf, PDF zuerst, immer Frage → Antwort
  const fsPdf = b.db.vocab_collections.find(c => c.name === "Fahrschule · Abfahrtkontrolle"), fsEx = b.db.vocab_collections.find(c => c.name === "Fahrschule · Extras");
  assert.ok(fsPdf && fsEx && fsPdf.source_language === "de");
  assert.equal(b.db.vokabeln.filter(v => v.collection_id === fsPdf.id).length, await page.evaluate(() => FAHRSCHULE_PDF.length));
  assert.ok(b.db.vokabeln.some(v => v.begriff === "Reifen: Mindestprofiltiefe?" && v.bedeutung === "1,6 mm"));
  assert.ok(await page.evaluate(() => Engine.checkAnswer("1,6 mm", Engine.vocabSides(STATE.vo.find(v => v.begriff === "Reifen: Mindestprofiltiefe?"), "forward").answers, "de").verdict === "correct"), "1,6 mm wird nicht am Komma zerlegt");
  await go(page, "#/dashboard"); await page.waitForSelector('[data-vgroup="fahrschule"]');
  await page.click('[data-vgroup="fahrschule"]'); await page.waitForSelector(".fx-card");
  const fs = await page.evaluate(() => ({ label: TS.label, dir: TS.direction, cols: [...new Set(TS.items.map(it => cardById(it.vocab_id).collection_id))] }));
  assert.equal(fs.label, "Fahrschule"); assert.equal(fs.dir, "forward"); assert.deepEqual(fs.cols, [fsPdf.id], "zuerst die PDF-Karten");
  await page.evaluate(async () => { await tsFinish("abandoned", true); TS = null; tsSave(); await Api.idle(); });
  await go(page, "#/dashboard");
  const counts = () => [b.db.vokabeln.length, b.db.topics.length, b.db.subtopics.length, b.db.exercises.length].join(",");
  const c1 = counts();
  await page.reload(); await page.waitForSelector(".dash", { timeout: 15000 }); await page.waitForTimeout(800); await page.evaluate(() => Api.idle());
  assert.equal(counts(), c1, "beim zweiten Start nichts doppelt");
  await ctx.close();
});

await scenario("Vokabeln lernen: Sprache antippen, Kenne ich schon, Hören-Spiel – Handy ohne Querscrollen", async () => {
  const b = new MockBackend(); const { ctx, page } = await open(b, { viewport: { width: 390, height: 844 } }); await login(page);
  await page.waitForSelector("#vl_card");
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await noScroll(), "Dashboard ohne Querscrollen");
  assert.ok(await page.$('[data-vlearn="fr"]') && await page.$('[data-vlearn="en"]'), "ein Knopf pro Sprache");
  await page.click('[data-vldir="forward"]'); await page.evaluate(() => Api.idle());
  assert.equal(await page.evaluate(() => setting("vl_dir")), "forward");
  await shot(page, "vl-01-dashboard");
  await page.click('[data-vlearn="fr"]'); await page.waitForSelector(".fx-card");
  const info = await page.evaluate(() => ({ subj: TS.scope.subject, dir: TS.direction, langs: [...new Set(TS.items.map(it => cardLang(cardById(it.vocab_id))))] }));
  assert.equal(info.subj, "Französisch"); assert.deepEqual(info.langs, ["fr"]); assert.equal(info.dir, "forward");
  // bis zu einem neuen Wort spielen und „Kenne ich schon“ drücken
  let known = null;
  for (let g = 0; g < 40 && !known; g++) {
    const it = await page.evaluate(() => { const it = TS && TS.status === "active" && Engine.current(TS); if (!it) return null; const c = cardById(it.vocab_id); return { kind: it.kind, id: c.id, ans: Engine.vocabSides(c, it.direction).answers[0] }; });
    if (!it) break;
    if (it.kind === "vocab_study") { known = it.id; await page.click("#st_known"); break; }
    await page.fill("#va", it.ans); await page.click("#va_check"); await page.click("#va_next");
  }
  assert.ok(known != null, "neues Wort gefunden");
  await page.evaluate(() => Api.idle());
  const kc = b.db.vokabeln.find(v => String(v.id) === String(known));
  assert.ok(kc.reps >= 3 && +kc.interval_days === 60, "abgehakt in der DB");
  assert.ok(await page.evaluate(id => !TS.items.slice(TS.index).some(it => String(it.vocab_id) === String(id)), known), "wird in dieser Runde nicht mehr gefragt");
  await page.evaluate(() => { TS = null; tsSave(); });
  // Vokabelseite zeigt den Knopf ebenfalls
  await go(page, "#/vokabeln"); await page.waitForSelector("#vl_card"); assert.ok(await noScroll(), "Vokabelseite ohne Querscrollen");
  // Hören: Sprachausgabe abfangen
  await page.evaluate(() => { window.__said = []; speechSynthesis.speak = u => window.__said.push(u.text + "|" + u.lang); });
  await go(page, "#/spiele"); await page.waitForSelector('[data-game="hoeren"]');
  await page.selectOption("#gm_col", { label: await page.evaluate(() => { const c = ES.collections.find(x => x.name === "Unité 1"); return c.name + " (" + gameCards(c.id).length + ")"; }) });
  await page.waitForSelector('[data-game="hoeren"]:not([disabled])'); await page.click('[data-game="hoeren"]');
  await page.waitForSelector("#hr_play"); await page.waitForTimeout(400);
  const said = await page.evaluate(() => window.__said);
  assert.ok(said.length >= 1 && said[0].endsWith("|fr-FR"), "spricht Französisch: " + said);
  assert.ok(await noScroll(), "Spiel ohne Querscrollen");
  await shot(page, "vl-02-hoeren");
  const rounds = await page.evaluate(() => GAME.rounds);
  for (let i = 0; i < rounds; i++) {
    await page.waitForSelector("[data-hr]");
    const c = await page.evaluate(() => GAME.q.correct); await page.click(`[data-hr="${c}"]`);
    await page.waitForSelector("#hr_next"); await page.click("#hr_next");
  }
  await page.waitForSelector(".done-mark");
  assert.ok((await page.textContent("#view")).includes(rounds + " von " + rounds + " richtig"));
  await ctx.close();
});

await scenario("Klausur-Modus: eigene Seite je Klausur, nur ihre Vokabeln, Artikel/Pronomen/Verb-Puzzle, verschwindet nach der Klausur", async () => {
  const b = new MockBackend();
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const FK = "11111111-aaaa-4aaa-8aaa-0000000000f2";
  b.db.klausuren.push({ id: FK, fach: "Französisch", thema: "Les vêtements", datum: day(6), themen: [], material: [], mitnehmen: [], punkte: null, vokabel_lektionen: ["Unité 1"], topics_migrated: true });
  let n = 100; [["une casquette", "die Kappe"], ["un short", "die Shorts"], ["la jupe", "der Rock"], ["le pull", "der Pullover"]].forEach(([w, m]) => b.db.vokabeln.push({ id: n++, begriff: w, bedeutung: m, sprache: "Unité 1", level: 0, next: day(0) }));
  // schon gelernt: bleibt gelernt (Langzeit)
  Object.assign(b.db.vokabeln.find(v => v.begriff === "le travail"), { reps: 4, level: 4, interval_days: 40, next_review_at: day(30) + "T00:00:00.000Z", last_reviewed_at: day(-5) + "T10:00:00.000Z", last_result: "correct" });
  const { ctx, page } = await open(b, { viewport: { width: 390, height: 844 } }); await login(page);
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  await page.waitForSelector(`.km-ent[href="#/klausur/${FK}"]`);
  await page.$eval(`.km-ent[href="#/klausur/${FK}"]`, a => a.click()); await page.waitForSelector(".km-steps");
  assert.deepEqual(await page.$$eval(".km-tabs a", a => a.map(x => x.textContent)), ["Überblick", "Vokabeln", "Spiele", "Grammatik", "Schreiben", "Themen"]);
  assert.ok(await noScroll(), "Überblick ohne Querscrollen");
  assert.ok((await page.textContent("#km_body")).includes("Dein bisheriger Stand zählt"));
  const sure = await page.evaluate(id => examVocab(klById(id)).filter(v => ["mid", "long"].includes(Engine.stageOf(v).key)).length, FK);
  assert.ok(sure >= 1, "gelerntes Wort zählt");
  await shot(page, "km-01-start");
  // Vokabelrunde nur mit den Wörtern der Klausur
  await page.click('[data-kmgo="vocab"]'); await page.waitForSelector(".fx-card");
  const sc = await page.evaluate(() => ({ ex: TS.scope.exam_id, cols: [...new Set(TS.items.map(it => cardById(it.vocab_id).sprache))], travail: TS.items.some(it => cardById(it.vocab_id).begriff === "le travail") }));
  assert.equal(sc.ex, FK); assert.deepEqual(sc.cols, ["Unité 1"]); assert.ok(!sc.travail, "gelerntes Wort nicht von vorn");
  assert.ok((await page.getAttribute(".closebtn", "href")).startsWith("#/klausur/" + FK), "zurück zur Klausur-Seite");
  await page.evaluate(async () => { await tsFinish("abandoned", true); TS = null; tsSave(); await Api.idle(); });
  // Spiele mit genau diesen Wörtern
  await go(page, `#/klausur/${FK}?tab=spiele`); await page.waitForSelector('[data-game="verben"]');
  assert.ok(await noScroll(), "Spiele ohne Querscrollen");
  // Artikel-Duell
  await page.click('[data-game="artikel"]'); await page.waitForSelector("[data-ar]");
  const ar = await page.evaluate(() => GAME.rounds); assert.ok(ar >= 5, "Artikel-Wörter: " + ar);
  for (let i = 0; i < ar; i++) { await page.waitForSelector("[data-ar]"); const c = await page.evaluate(() => GAME.q.correct); await page.click(`[data-ar="${c}"]`); await page.click("#ar_next"); }
  await page.waitForSelector(".done-mark"); assert.ok((await page.textContent("#view")).includes(ar + " von " + ar + " richtig"));
  assert.ok((await page.getAttribute("#gm_back", "href")).includes("#/klausur/" + FK), "zurück zur Klausur");
  // Verb-Puzzle
  await page.click("#gm_back"); await page.waitForSelector('[data-game="verben"]'); await page.click('[data-game="verben"]'); await page.waitForSelector("[data-vp]");
  await shot(page, "km-02-puzzle"); assert.ok(await noScroll(), "Puzzle ohne Querscrollen");
  for (let i = 0; i < 8; i++) {
    await page.waitForSelector("#vp_check");
    const rows = await page.evaluate(() => GAME.pz.rows.map(r => [r.key, r.options.indexOf(r.correct)]));
    for (const [key, idx] of rows) await page.click(`[data-vp="${key}|${idx}"]`);
    await page.click("#vp_check"); await page.waitForSelector("#vp_next");
    assert.ok(await page.evaluate(() => GAME.res.ok), "Puzzle richtig zusammengesetzt");
    await page.click("#vp_next");
  }
  await page.waitForSelector(".done-mark"); assert.ok((await page.textContent("#view")).includes("8 von 8 richtig"));
  // ein Fehler wird erkannt
  await page.click("#gm_again"); await page.waitForSelector("#vp_check");
  const rows = await page.evaluate(() => GAME.pz.rows.map(r => [r.key, r.key === "pronoun" ? r.options.findIndex(o => o !== r.correct) : r.options.indexOf(r.correct)]));
  for (const [key, idx] of rows) await page.click(`[data-vp="${key}|${idx}"]`);
  await page.click("#vp_check"); await page.waitForSelector("#vp_next");
  assert.ok((await page.textContent(".fb")).includes("Richtig wäre"));
  // Pronomen
  await go(page, `#/klausur/${FK}?tab=spiele`); await page.waitForSelector('[data-game="pronomen"]'); await page.click('[data-game="pronomen"]');
  for (let i = 0; i < 12; i++) { await page.waitForSelector("[data-pr]"); const c = await page.evaluate(() => GAME.q.correct); await page.click(`[data-pr="${c}"]`); await page.click("#pr_next"); }
  await page.waitForSelector(".done-mark"); assert.ok((await page.textContent("#view")).includes("12 von 12 richtig"));
  // Vokabeln-Tab und Themen-Tab
  await go(page, `#/klausur/${FK}?tab=vokabeln`); await page.waitForSelector(".km-words"); assert.ok(await noScroll());
  await shot(page, "km-03-vokabeln");
  await go(page, `#/klausur/${FK}?tab=themen`); await page.waitForSelector(".km-actions"); assert.ok(await noScroll());
  // Grammatik: Spickzettel aufklappen, „Jetzt üben“ startet das passende Spiel, „Kurz erklärt“ im Spiel
  await go(page, `#/klausur/${FK}?tab=grammatik`); await page.waitForSelector(".gr-card"); assert.ok(await noScroll());
  await page.click(".gr-card summary"); await page.waitForSelector('.gr-card[open] [data-grgame="verben"]');
  await page.click('.gr-card[open] [data-grgame="verben"]'); await page.waitForSelector("[data-vp]");
  await page.click("#gm_explain"); await page.waitForSelector("#gr_ok"); await page.click("#gr_ok");
  // Schreiben: Baustein einfügen, Fehler finden, übernehmen, Entwurf gespeichert, KI-Korrektur
  await go(page, `#/klausur/${FK}?tab=schreiben`); await page.waitForSelector("#wr_text"); assert.ok(await noScroll(), "Schreiben ohne Querscrollen");
  await page.click('[data-wrb="0"]');
  assert.ok((await page.inputValue("#wr_text")).startsWith("Salut"), "Baustein eingefügt");
  await page.fill("#wr_text", "Salut Léa, je achète une robe vert. Nous achète des baskets. Bises, Filip");
  await page.click("#wr_check"); await page.waitForSelector(".wr-is");
  const iss = await page.$$eval(".wr-is b", x => x.map(e => e.textContent));
  assert.deepEqual(iss, ["j'achète", "verte", "achetons"]);
  await page.click('[data-wrfix="0"]'); await page.waitForSelector(".wr-is");
  assert.ok((await page.inputValue("#wr_text")).includes("j'achète une robe vert"), "Übernehmen bessert aus");
  assert.ok((await page.textContent(".wr-check")).includes("Anrede"));
  await shot(page, "km-04-schreiben");
  await page.evaluate(() => Api.idle());
  assert.ok(b.db.einstellungen.some(x => x.key === "schreiben_" + FK && /j'achète/.test(x.value.mail)), "Entwurf gespeichert");
  await page.click("#wr_ai"); await page.waitForSelector(".wr-ai, .wr-card .hint", { timeout: 10000 });
  // Dranbleiben: XP aus Spielen zählen, Karte im Dashboard, Abzeichen im Fortschritt
  assert.ok(await page.evaluate(() => xpToday() > 0), "XP aus Spielen gutgeschrieben");
  await go(page, "#/dashboard"); await page.waitForSelector(".mo-card");
  assert.ok((await page.textContent(".mo-card")).includes("XP heute"));
  await go(page, "#/fortschritt"); await page.waitForSelector(".bd-grid"); assert.ok(await noScroll(), "Fortschritt ohne Querscrollen");
  await page.click('[data-xpgoal="50"]'); await page.waitForTimeout(300); assert.equal(await page.evaluate(() => xpGoal()), 50);
  // nach der Klausur: Modus weg
  await page.evaluate(id => { const k = klById(id); k.punkte = 11; bump(); }, FK);
  await go(page, `#/klausur/${FK}`); await page.waitForSelector(".empty");
  assert.ok((await page.textContent("#view")).includes("Diese Klausur ist geschrieben"));
  await go(page, "#/dashboard"); await page.waitForSelector(".dash");
  assert.ok(!(await page.$(`.km-ent[href="#/klausur/${FK}"]`)), "kein Eintrag mehr im Dashboard");
  await ctx.close();
});

await scenario("Lektion (Duolingo-Stil): Bilder, Übersetzen, Paare, Lücke, Satz bauen, Hören – Fehler kommen wieder, XP gespeichert", async () => {
  const b = new MockBackend();
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const src = (await import("node:fs")).readFileSync(new URL("../js/content-packs.js", import.meta.url), "utf8");
  const vet = [...src.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].slice(0, 51);
  const COL = "cccccccc-0000-4000-8000-0000000000f3";
  b.db.vocab_collections.push({ id: COL, name: "Les vêtements", source_language: "fr", target_language: "de", user_id: "aaaaaaaa-0000-4000-8000-000000000001", created_at: new Date().toISOString() });
  let n = 500; vet.forEach(m => b.db.vokabeln.push({ id: n++, begriff: m[1], bedeutung: m[2], sprache: "Les vêtements", collection_id: COL, source_language: "fr", target_language: "de", level: 0, next: day(0) }));
  const FK = "11111111-aaaa-4aaa-8aaa-0000000000f3";
  b.db.klausuren.push({ id: FK, fach: "Französisch", thema: "Klausur", datum: day(5), themen: [], material: [], mitnehmen: [], punkte: null, vokabel_lektionen: ["Les vêtements"], topics_migrated: true });
  const { ctx, page } = await open(b, { viewport: { width: 390, height: 844 } }); await login(page);
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  // Klausur-Modus steht oben im Dashboard
  await page.waitForSelector(".km-list");
  assert.ok(await page.evaluate(() => document.querySelector(".km-list").getBoundingClientRect().top < document.querySelector(".mission, .cont").getBoundingClientRect().top), "Klausur-Modus vor dem Auftrag");
  await page.evaluate(() => {
    window.__said = []; speechSynthesis.speak = u => window.__said.push(u.text);
    // simulierte Spracherkennung: „hört“ window.__hear
    window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => this.onresult({ results: [[{ transcript: window.__hear }]] }), 30); } stop() {} abort() {} };
  });
  await go(page, `#/klausur/${FK}?tab=spiele`); await page.waitForSelector("[data-lesson]");
  await page.click("[data-lesson]"); await page.waitForSelector(".les-body");
  const types = await page.evaluate(() => LES.items.map(x => x.type));
  for (const t of ["pic", "mc", "pairs", "gap", "build", "listen", "speak"]) assert.ok(types.includes(t), "Aufgabentyp " + t + ": " + types);
  const total = types.length; let first = true; const seen = new Set();
  for (let g = 0; g < 40; g++) {
    const st = await page.evaluate(() => LES.done ? null : (({ type, correct, target, tiles, left }) => ({ type, correct, target, tiles, left: left && left.map(x => String(x.id)), retry: !!LES.items[LES.i].retry }))(LES.items[LES.i]));
    if (!st) break;
    if (!seen.has(st.type)) { seen.add(st.type); assert.ok(await noScroll(), "kein Querscrollen bei " + st.type); await shot(page, "les-" + st.type); }
    if (first && st.type !== "pairs") {   // absichtlich falsch
      first = false;
      if (st.target) await page.click("#les_skip"); else { await page.click(`[data-lo="${(st.correct + 1) % 2}"]`); await page.click("#les_check"); }
      await page.waitForSelector(".les-foot.bad"); await page.click("#les_next"); continue;
    }
    if (st.type === "speak") {
      await page.evaluate(() => { window.__hear = "bonjour tout le monde"; }); await page.click("#les_mic");
      await page.waitForFunction(() => /nicht ganz/.test(document.querySelector(".les-heard").textContent));   // 1. Versuch daneben: keine Strafe
      await page.evaluate(t => { window.__hear = t.toLowerCase(); }, st.target); await page.click("#les_mic");
    } else if (st.type === "pairs") {
      for (const id of st.left) { await page.click(`[data-lp="l|${id}"]`); assert.ok(await page.$(`.les-pair.on[data-lp="l|${id}"]`), "Auswahl sichtbar markiert"); await page.click(`[data-lp="r|${id}"]`); }
    } else if (st.target) {
      const toks = await page.evaluate(t => LESSON.tokens(t), st.target); const used = [];
      for (const w of toks) { const i = st.tiles.findIndex((x, k) => x === w && !used.includes(k)); used.push(i); await page.click(`[data-lt="${i}"]`); }
      await page.click("#les_check");
    } else { await page.click(`[data-lo="${st.correct}"]`); await page.click("#les_check"); }
    await page.waitForSelector(".les-foot.ok"); await page.click("#les_next");
  }
  await page.waitForSelector(".les-done");
  const res = await page.evaluate(() => ({ items: LES.items.length, right: LES.right, xp: LES.xp }));
  assert.equal(res.items, total + 1, "falsche Aufgabe kam am Ende noch einmal");
  assert.equal(res.right, total - 1);
  assert.ok((await page.evaluate(() => window.__said)).length >= 1, "Sprachausgabe benutzt");
  await shot(page, "les-ende");
  await page.evaluate(() => Api.idle());
  const xp = b.db.einstellungen.find(x => x.key === "lektion_xp");
  assert.ok(xp && Object.values(xp.value)[0] === res.xp, "XP gespeichert");
  // „Kann gerade nicht hören“: Hör-Aufgaben fallen weg, kein Fehler, keine Wiederholung
  await page.click("#les_again"); await page.waitForSelector(".les-body");
  await page.evaluate(() => { const i = LES.items.findIndex(x => x.type === "listen"); LES.i = i; LES.ui = {}; route(); });
  await page.waitForSelector("#les_noaudio"); const before = await page.evaluate(() => ({ total: LES.total, right: LES.right }));
  await page.click("#les_noaudio"); await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ listen: LES.items.slice(LES.i).some(x => x.type === "listen"), total: LES.total, wrong: LES.wrongFirst, retry: LES.items.some(x => x.retry) }));
  assert.ok(!after.listen && after.wrong === 0 && !after.retry, "ohne Strafe ausgelassen");
  assert.ok(after.total < before.total);
  // Tastatur: Ziffer wählt, Enter prüft
  await page.evaluate(() => { const i = LES.items.findIndex(x => x.type === "mc"); LES.i = i; LES.done = false; LES.ui = {}; route(); });
  await page.waitForSelector(".les-opt"); const corr = await page.evaluate(() => LES.items[LES.i].correct);
  await page.keyboard.press(String(corr + 1)); await page.keyboard.press("Enter"); await page.waitForSelector(".les-foot.ok");
  await ctx.close();
});

await browser.close();
console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen.`);
process.exit(failed ? 1 : 0);
