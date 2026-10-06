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
  assert.deepEqual(b.db.subtopics.filter(x => x.topic_id === mathTopic.id).map(x => x.title), ["Ableitungsregeln", "Kurvendiskussion", "Integrale (Ausblick)"]);
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

await browser.close();
console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen.`);
process.exit(failed ? 1 : 0);
