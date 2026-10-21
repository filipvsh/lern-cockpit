/* =====================================================================
   LERN-COCKPIT · LERNSPIELE
   Kurze Spiele mit deinen eigenen Vokabeln und Fachbegriffen:
     Memory          Paare aus Wort und Übersetzung finden
     Blitz (60 s)    so viele richtige Antworten wie möglich, Serien geben Bonus
     Buchstabensalat Wort aus Buchstaben-Kacheln zusammensetzen – ohne Tastatur
     Hören           die App spricht das Wort (Sprachausgabe), du wählst die Bedeutung
     Artikel-Duell   un oder une, le oder la (Französisch)
     Pronomen        je, tu, il/elle/on … zuordnen (Französisch)
     Verb-Puzzle     Pronomen + Stamm + Endung zusammensetzen (Französisch, js/fr-grammar.js)
   Spielbereich: eine Sammlung, alle – oder „exam:<id>“ = nur die Wörter einer Klausur.
   Spiele ändern den Wiederholungsplan nicht. Bestwerte pro Gerät.
   ===================================================================== */
const GAMES = {
  memory: { name: "Memory", desc: "Finde die Paare aus Wort und Übersetzung. Je weniger Züge, desto besser.", ico: "vokabeln", min: 4 },
  blitz: { name: "Blitz · 60 Sekunden", desc: "So viele richtige Antworten wie möglich. Serien geben Bonuspunkte.", ico: "clock", min: 4 },
  salat: { name: "Buchstabensalat", desc: "Setz das Wort aus Buchstaben-Kacheln zusammen – trainiert die Schreibweise, ganz ohne Tastatur.", ico: "edit", min: 3 },
  hoeren: { name: "Hören", desc: "Die App spricht das Wort vor, du tippst die Bedeutung an. Training fürs Listening.", ico: "play", min: 4, speech: true },
  artikel: { name: "Artikel-Duell", desc: "un oder une? le oder la? Das Geschlecht der Nomen sicher drauf haben.", ico: "flag", min: 4 },
  pronomen: { name: "Pronomen", desc: "je, tu, il / elle / on, nous, vous, ils / elles – welches passt?", ico: "target", min: 0, fr: true },
  verben: { name: "Verb-Puzzle", desc: "Pronomen + Stamm + Endung zusammensetzen: j'achète, nous achetons …", ico: "pen", min: 0, fr: true }
};
const VOICE_LANG = { fr: "fr-FR", en: "en-GB", es: "es-ES", la: "it-IT", de: "de-DE" };
const canSpeak = () => typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
/** Wort vorlesen – Stimme passend zur Sprache der Sammlung, etwas langsamer */
function speak(text, lang, rate) {
  if (!canSpeak()) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = VOICE_LANG[lang] || lang || "fr-FR"; u.rate = rate || 0.85;
    const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith(u.lang.slice(0, 2).toLowerCase())); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { console.warn("Sprachausgabe", e); }
}
const cardLangOf = c => { const col = colById(c.collection_id); return (col && col.source_language) || c.source_language || "fr"; };
let GAME = null;          // laufendes Spiel
let GAME_COL = lsGet("lc_game_col", "");
const bestKey = (g, col) => "lc_best_" + g + "_" + (col || "all");
const isExamScope = sc => String(sc || "").startsWith("exam:");
function scopeCards(sc) {
  if (isExamScope(sc)) { const k = klById(String(sc).slice(5)); return k ? linkedCollections(k).flatMap(c => cardsOf(c.id)) : []; }
  return sc ? cardsOf(sc) : activeCards();
}
const gameCards = colId => scopeCards(colId).filter(v => v.begriff && v.bedeutung);
/** Französische Nomen mit le/la/un/une (l' und des verraten das Geschlecht nicht) */
function articleCards(sc) {
  return gameCards(sc).filter(c => cardLangOf(c) === "fr").map(c => { const m = shortAns(c.begriff).match(/^(le|la|un|une)\s+(.+)$/i); return m ? { card: c, art: m[1].toLowerCase(), noun: m[2] } : null; }).filter(Boolean);
}
const hasFrench = sc => gameCards(sc).some(c => cardLangOf(c) === "fr");
/** wie viel „Material“ ein Spiel im Bereich hat */
function gameAmount(k, sc) {
  if (k === "hoeren") return gameCards(sc).filter(c => cardLangOf(c) !== "de").length;
  if (k === "artikel") return articleCards(sc).length;
  if (GAMES[k].fr) return hasFrench(sc) ? 99 : 0;
  return gameCards(sc).length;
}
function gameTile(k, sc) {
  const g = GAMES[k]; const best = lsGet(bestKey(k, sc), null); const nn = gameAmount(k, sc); const ok = (g.fr ? nn > 0 : nn >= g.min) && (!g.speech || canSpeak());
  const why = g.speech && !canSpeak() ? "Dein Browser kann nicht vorlesen" : g.fr && !nn ? "Nur mit französischen Wörtern" : k === "artikel" && nn < g.min ? "Mindestens " + g.min + " Nomen mit le/la/un/une nötig" : nn < g.min ? "Mindestens " + g.min + (k === "hoeren" ? " Fremdsprachen-Wörter" : " Wörter") + " nötig" : "";
  return '<button class="game-tile" data-game="' + k + '"' + (ok ? "" : " disabled") + '><span class="gi">' + ICO[g.ico] + '</span><b>' + g.name + '</b><span class="t-sub">' + g.desc + '</span><span class="gbest">' + (why || (best == null ? "Noch kein Bestwert" : k === "memory" ? "Bestwert: " + best + " Züge" : "Bestwert: " + best + " Punkte")) + '</span></button>';
}
const shortAns = s => String(s).split(/\s*[;,/]\s*/)[0].trim();

V.spiele = () => {
  if (!engineReady()) return pageHead("Spiele") + setupCard();
  if (GAME && ROUTE.sub === GAME.type) return gameStage();
  const cols = activeCols().filter(c => gameCards(c.id).length >= 3);
  if (GAME_COL && !cols.some(c => c.id === GAME_COL)) GAME_COL = "";
  const head = pageHead("Spiele", { sub: "Kurz zwischendurch – mit deinen eigenen Vokabeln und Fachbegriffen." });
  if (!cols.length) return head + '<div class="card">' + emptyState("vokabeln", "Noch keine Wörter", "Leg zuerst eine Sammlung mit ein paar Vokabeln an.", '<a class="btn primary sm" href="#/vokabeln">Zu den Vokabeln</a>') + '</div>';
  const n = gameCards(GAME_COL).length;
  const pick = '<div class="card tight" style="margin-bottom:var(--s5)"><label class="fld">Womit spielst du?<select id="gm_col"><option value="">Alle Sammlungen (' + gameCards("").length + ' Wörter)</option>' + cols.map(c => '<option value="' + esc(c.id) + '"' + (c.id === GAME_COL ? " selected" : "") + '>' + esc(c.name) + ' (' + gameCards(c.id).length + ')</option>').join("") + '</select></label></div>';
  const tiles = Object.keys(GAMES).map(k => gameTile(k, GAME_COL)).join("");
  return head + pick + lessonCard(GAME_COL) + '<div class="game-grid">' + tiles + '</div>';
};
function bindSpiele() {
  if (GAME && ROUTE.sub === GAME.type) return bindGame();
  const sel = document.getElementById("gm_col"); if (sel) sel.onchange = () => { GAME_COL = sel.value; lsSet("lc_game_col", GAME_COL); route(); };
  document.querySelectorAll("[data-game]").forEach(b => b.onclick = () => startGame(b.dataset.game));
  bindLessonCards();
}
function startGame(type, scope) {
  const sc = scope !== undefined ? scope : GAME_COL;
  const cards = Engine.shuffle(gameCards(sc));
  const col = colById(sc), exam = isExamScope(sc) ? klById(String(sc).slice(5)) : null;
  // Fremdsprache gefragt (Deutsch → Fremdsprache), bei Fachbegriffen der Begriff
  const prompt = c => c.bedeutung, answer = c => shortAns(c.begriff);
  if (type === "memory") {
    const pairs = cards.slice(0, 6);
    const tiles = Engine.shuffle(pairs.flatMap(c => [{ id: c.id + "a", pair: c.id, text: shortAns(c.begriff) }, { id: c.id + "b", pair: c.id, text: shortAns(c.bedeutung) }]));
    GAME = { type, tiles, open: [], done: [], moves: 0, started: Date.now() };
  } else if (type === "blitz") {
    GAME = { type, pool: cards, i: 0, score: 0, streak: 0, best: 0, right: 0, wrong: [], ends: Date.now() + 60000, q: null };
    nextBlitz();
  } else if (type === "salat") {
    const pool = cards.filter(c => { const a = answer(c); return a.length >= 3 && a.length <= 18; }).slice(0, 8);
    GAME = { type, pool, i: 0, score: 0, hints: 0, built: [], tiles: [], wrong: [] };
    nextSalat();
  } else if (type === "hoeren") {
    const pool = cards.filter(c => cardLangOf(c) !== "de");
    GAME = { type, pool, all: pool, i: 0, rounds: Math.min(10, pool.length), score: 0, right: 0, wrong: [], q: null };
    nextHoeren();
  } else if (type === "artikel") {
    const pool = Engine.shuffle(articleCards(sc)).slice(0, 12);
    GAME = { type, pool, i: 0, rounds: pool.length, score: 0, right: 0, streak: 0, wrong: [], q: null };
    nextArtikel();
  } else if (type === "pronomen") {
    GAME = { type, i: 0, rounds: 12, score: 0, right: 0, wrong: [], q: null, tasks: Engine.shuffle(FRG.tasks()) };
    nextPronomen();
  } else if (type === "verben") {
    GAME = { type, i: 0, rounds: 8, score: 0, right: 0, wrong: [], tasks: Engine.shuffle(FRG.tasks()) };
    nextVerb();
  }
  GAME.col = exam ? exam.fach + "-Klausur" : col ? col.name : "Alle Sammlungen"; GAME.colId = sc;
  GAME.back = exam ? "#/klausur/" + exam.id + "?tab=spiele" : "#/spiele";
  GAME.prompt = prompt; GAME.answer = answer;
  location.hash = "#/spiele/" + type; if (ROUTE.name === "spiele") route();
}
function nextBlitz() {
  const g = GAME; if (!g.pool.length) return;
  const c = g.pool[g.i++ % g.pool.length];
  const right = shortAns(c.begriff);
  const others = Engine.shuffle(g.pool.filter(x => x.id !== c.id && shortAns(x.begriff) !== right)).slice(0, 3).map(x => shortAns(x.begriff));
  const opts = Engine.shuffle(others.concat([right]));
  g.q = { card: c, prompt: c.bedeutung, opts, correct: opts.indexOf(right), picked: null };
}
function nextHoeren() {
  const g = GAME; if (g.i >= g.rounds) { g.over = true; return; }
  const c = g.pool[g.i];
  const right = shortAns(c.bedeutung);
  const others = Engine.shuffle(g.all.filter(x => x.id !== c.id && shortAns(x.bedeutung) !== right)).map(x => shortAns(x.bedeutung)).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
  const opts = Engine.shuffle(others.concat([right]));
  g.q = { card: c, say: shortAns(c.begriff), lang: cardLangOf(c), opts, correct: opts.indexOf(right), picked: null, spoken: false };
}
function nextArtikel() {
  const g = GAME; if (g.i >= g.rounds) { g.over = true; return; }
  const a = g.pool[g.i]; const def = /^l/.test(a.art) ? ["le", "la"] : ["un", "une"];
  g.q = { a, opts: def, correct: def.indexOf(a.art), picked: null };
}
const PRON_FR = ["je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles"];
function nextPronomen() {
  const g = GAME; if (g.i >= g.rounds) { g.over = true; return; }
  const t = g.tasks[g.i % g.tasks.length];
  if (g.i % 2 === 0) {
    // Deutsch → Französisch
    const right = t.pr.fr; const opts = Engine.shuffle([right].concat(Engine.shuffle(PRON_FR.filter(x => x !== right)).slice(0, 3)));
    g.q = { kind: "de", prompt: t.pr.de, opts, correct: opts.indexOf(right), answer: right, picked: null };
  } else {
    // Verbform → Pronomen: nur Pronomen als Ablenker, deren Form anders lautet (sonst wären zwei richtig)
    const v = FRG.VERBS[t.verb]; const right = FRG.pronounFor(t.pr, t.form);
    const others = Engine.shuffle(FRG.PRONOUNS.filter(p => v.forms[p.person] && v.forms[p.person] !== t.form).map(p => FRG.pronounFor(p, v.forms[p.person]))).filter((x, i, a) => x !== right && a.indexOf(x) === i).slice(0, 3);
    const opts = Engine.shuffle([right].concat(others));
    g.q = { kind: "form", prompt: "___ " + t.form, sub: t.verb + " (" + v.de + ")", opts, correct: opts.indexOf(right), answer: t.answer, picked: null };
  }
}
function nextVerb() {
  const g = GAME; if (g.i >= g.rounds) { g.over = true; return; }
  const t = g.tasks[g.i % g.tasks.length];
  g.task = t; g.pz = FRG.puzzle(t); g.pick = {}; g.res = null;
}
function nextSalat() {
  const g = GAME; const c = g.pool[g.i]; if (!c) { g.over = true; return; }
  const word = shortAns(c.begriff);
  g.word = word; g.card = c; g.built = [];
  // Leerzeichen stehen fest, alle anderen Zeichen werden gemischt
  g.tiles = Engine.shuffle([...word].map((ch, k) => ({ k, ch })).filter(t => t.ch !== " "));
}
function gameStage() {
  const g = GAME; const name = GAMES[g.type].name;
  const top = '<div class="game-top"><a class="backlink" href="' + esc(g.back || "#/spiele") + '" id="gm_back">' + ICO.back + 'Spiele</a><span class="t-sub">' + esc(name) + ' · ' + esc(g.col) + '</span></div>';
  if (g.type === "memory") {
    const fin = g.done.length === g.tiles.length;
    return top + '<div class="game-hud"><span>Züge <b>' + g.moves + '</b></span><span>Paare <b>' + g.done.length / 2 + '/' + g.tiles.length / 2 + '</b></span></div>' +
      (fin ? gameOver("Alle Paare gefunden!", g.moves + " Züge", g.moves, true) : '<div class="mem-grid">' + g.tiles.map((t, i) => { const up = g.open.includes(i) || g.done.includes(i); return '<button class="mem-card' + (up ? " up" : "") + (g.done.includes(i) ? " done" : "") + '" data-mem="' + i + '"' + (g.done.includes(i) ? " disabled" : "") + '><span>' + (up ? esc(t.text) : "?") + '</span></button>'; }).join("") + '</div>');
  }
  if (g.type === "blitz") {
    const left = Math.max(0, Math.ceil((g.ends - Date.now()) / 1000));
    if (left <= 0 || g.over) { g.over = true; return top + gameOver("Zeit um!", g.score + " Punkte · " + g.right + " richtig · beste Serie " + g.best, g.score, false); }
    const q = g.q;
    return top + '<div class="game-hud"><span>Zeit <b data-blitz>' + left + '</b> s</span><span>Punkte <b>' + g.score + '</b></span><span>Serie <b>' + g.streak + '</b></span></div>' +
      '<div class="fx-card blitz"><div class="kind">Wie heißt das?</div><div class="term" style="text-align:center">' + esc(q.prompt) + '</div><div class="choices">' + q.opts.map((o, i) => '<button class="opt-choice' + (q.picked != null ? (i === q.correct ? " right" : i === q.picked ? " wrongpick" : "") : "") + '" data-bz="' + i + '"' + (q.picked != null ? " disabled" : "") + '>' + esc(o) + '</button>').join("") + '</div></div>';
  }
  if (g.type === "salat") {
    if (g.over) return top + gameOver("Geschafft!", g.score + " Punkte · " + g.pool.length + " Wörter", g.score, false);
    const used = new Set(g.built.map(b => b.k));   // eingesetzte Kacheln
    let li = 0;
    const slots = [...g.word].map(ch => { if (ch === " ") return '<span class="sl-gap"></span>'; const b = g.built[li++]; return '<span class="sl-slot' + (g.flash ? " " + g.flash : "") + '">' + (b ? esc(b.ch) : "") + '</span>'; }).join("");
    return top + '<div class="game-hud"><span>Wort <b>' + (g.i + 1) + '/' + g.pool.length + '</b></span><span>Punkte <b>' + g.score + '</b></span></div>' +
      '<div class="fx-card"><div class="kind">Setz das Wort zusammen</div><div class="term" style="text-align:center">' + esc(g.card.bedeutung) + '</div><div class="sl-word">' + slots + '</div>' +
      '<div class="sl-tiles">' + g.tiles.map((t, i) => '<button class="sl-tile" data-sl="' + i + '"' + (used.has(t.k) ? " disabled" : "") + '>' + esc(t.ch) + '</button>').join("") + '</div>' +
      '<div class="sl-actions"><button class="btn plain sm" id="sl_back">Zurück</button><button class="btn plain sm" id="sl_hint">Tipp</button><button class="btn plain sm" id="sl_skip">Überspringen</button></div></div>';
  }
  if (g.type === "artikel") {
    if (g.over) return top + gameOver("Fertig!", g.score + " Punkte · " + g.right + " von " + g.rounds + " richtig", g.score, false);
    const q = g.q; const c = q.a.card; const other = { le: "un", la: "une", un: "le", une: "la" }[q.a.art];
    return top + '<div class="game-hud"><span>Wort <b>' + (g.i + 1) + '/' + g.rounds + '</b></span><span>Punkte <b>' + g.score + '</b></span><span>Serie <b>' + g.streak + '</b></span></div>' +
      '<div class="fx-card blitz"><div class="kind">Welcher Artikel?</div><div class="term" style="text-align:center">___ ' + esc(q.a.noun) + '</div><div class="t-sub" style="text-align:center">' + esc(shortAns(c.bedeutung)) + '</div>' +
      '<div class="choices art-choices">' + q.opts.map((o, i) => '<button class="opt-choice' + (q.picked != null ? (i === q.correct ? " right" : i === q.picked ? " wrongpick" : "") : "") + '" data-ar="' + i + '"' + (q.picked != null ? " disabled" : "") + '>' + o + '</button>').join("") + '</div>' +
      (q.picked != null ? '<div class="hint" style="text-align:center;margin-top:var(--s3)"><b>' + esc(q.a.art + " " + q.a.noun) + '</b> · ' + esc(other + " " + q.a.noun) + ' – ' + (/^(la|une)$/.test(q.a.art) ? "feminin" : "maskulin") + '</div><div style="display:flex;justify-content:flex-end;margin-top:var(--s4)"><button class="btn primary" id="ar_next">Weiter</button></div>' : '') + '</div>';
  }
  if (g.type === "pronomen") {
    if (g.over) return top + gameOver("Fertig!", g.score + " Punkte · " + g.right + " von " + g.rounds + " richtig", g.score, false);
    const q = g.q;
    return top + '<div class="game-hud"><span>Frage <b>' + (g.i + 1) + '/' + g.rounds + '</b></span><span>Punkte <b>' + g.score + '</b></span></div>' +
      '<div class="fx-card blitz"><div class="kind">' + (q.kind === "de" ? "Wie heißt das auf Französisch?" : "Welches Pronomen passt?") + '</div><div class="term" style="text-align:center">' + esc(q.prompt) + '</div>' + (q.sub ? '<div class="t-sub" style="text-align:center">' + esc(q.sub) + '</div>' : '') +
      '<div class="choices">' + q.opts.map((o, i) => '<button class="opt-choice' + (q.picked != null ? (i === q.correct ? " right" : i === q.picked ? " wrongpick" : "") : "") + '" data-pr="' + i + '"' + (q.picked != null ? " disabled" : "") + '>' + esc(o) + '</button>').join("") + '</div>' +
      (q.picked != null ? '<div class="hint" style="text-align:center;margin-top:var(--s3)"><b>' + esc(q.answer) + '</b></div><div style="display:flex;justify-content:flex-end;margin-top:var(--s4)"><button class="btn primary" id="pr_next">Weiter</button></div>' : '') + '</div>';
  }
  if (g.type === "verben") {
    if (g.over) return top + gameOver("Puzzle fertig!", g.score + " Punkte · " + g.right + " von " + g.rounds + " richtig", g.score, false);
    const t = g.task, v = FRG.VERBS[t.verb], res = g.res; const all = g.pz.rows.every(r => g.pick[r.key] != null);
    return top + '<div class="game-hud"><span>Verb <b>' + (g.i + 1) + '/' + g.rounds + '</b></span><span>Punkte <b>' + g.score + '</b></span></div>' +
      '<div class="fx-card"><div class="kind">Setz zusammen</div><div class="term long" style="text-align:center">' + esc(t.pr.de) + ' · ' + esc(t.verb) + '</div><div class="t-sub" style="text-align:center">' + esc(v.de) + '</div>' +
      '<div class="vp-out' + (res ? (res.ok ? " ok" : " bad") : "") + '">' + (g.pz.rows.map(r => g.pick[r.key] != null ? '<span class="' + (res ? (res.parts[r.key] ? "ok" : "bad") : "") + '">' + esc(g.pick[r.key]) + '</span>' : '<span class="gap">' + esc(r.label) + '</span>').join(" ")) + '</div>' +
      g.pz.rows.map(r => '<div class="vp-row"><div class="vp-l">' + esc(r.label) + '</div><div class="vp-opts">' + r.options.map((o, i) => '<button class="sl-tile vp-tile' + (g.pick[r.key] === o ? " on" : "") + '" data-vp="' + r.key + '|' + i + '"' + (res ? " disabled" : "") + '>' + esc(o) + '</button>').join("") + '</div></div>').join("") +
      (res ? '<div class="fb ' + (res.ok ? "ok" : "bad") + '" style="margin-top:var(--s4)"><div class="fb-t"><b>' + (res.ok ? "Richtig!" : "Richtig wäre: " + esc(g.pz.answer)) + '</b></div>' + (v.hint ? '<div class="fb-x">' + esc(v.hint) + '</div>' : '') + '</div><div style="display:flex;justify-content:flex-end;margin-top:var(--s4)"><button class="btn primary" id="vp_next">Weiter</button></div>'
        : '<div style="display:flex;justify-content:flex-end;margin-top:var(--s4)"><button class="btn primary" id="vp_check"' + (all ? "" : " disabled") + '>Prüfen</button></div>') + '</div>';
  }
  if (g.type === "hoeren") {
    if (g.over) return top + gameOver("Fertig gehört!", g.score + " Punkte · " + g.right + " von " + g.rounds + " richtig", g.score, false);
    const q = g.q;
    return top + '<div class="game-hud"><span>Wort <b>' + (g.i + 1) + '/' + g.rounds + '</b></span><span>Punkte <b>' + g.score + '</b></span></div>' +
      '<div class="fx-card blitz"><div class="kind">Hör zu – was bedeutet das?</div><div style="display:flex;justify-content:center;margin:var(--s4) 0"><button class="btn primary lg" id="hr_play">' + ICO.play + 'Nochmal anhören</button></div>' +
      (q.picked != null ? '<div class="term" style="text-align:center">' + esc(q.say) + '</div>' : '<div class="t-sub" style="text-align:center">Das Wort wird erst nach deiner Antwort angezeigt.</div>') +
      '<div class="choices">' + q.opts.map((o, i) => '<button class="opt-choice' + (q.picked != null ? (i === q.correct ? " right" : i === q.picked ? " wrongpick" : "") : "") + '" data-hr="' + i + '"' + (q.picked != null ? " disabled" : "") + '>' + esc(o) + '</button>').join("") + '</div>' +
      (q.picked != null ? '<div style="display:flex;justify-content:flex-end;margin-top:var(--s4)"><button class="btn primary" id="hr_next">Weiter</button></div>' : '') + '</div>';
  }
  return top;
}
function gameOver(title, sub, score, lowerIsBetter) {
  const key = bestKey(GAME.type, GAME.colId); const prev = lsGet(key, null);
  const isBest = prev == null || (lowerIsBetter ? score < prev : score > prev);
  if (isBest && !GAME.saved) lsSet(key, score);
  GAME.saved = true;
  const wrong = (GAME.wrong || []).slice(0, 8);
  return '<div class="fx-done"><div class="done-mark">' + ICO.check + '</div><h2 class="fx-title">' + esc(title) + '</h2><p class="lead" style="margin:var(--s3) auto 0">' + esc(sub) + '</p>' + (isBest ? '<div class="pill p-accent" style="margin-top:var(--s4)">Neuer Bestwert</div>' : '<div class="t-sub" style="margin-top:var(--s4)">Bestwert: ' + prev + (lowerIsBetter ? " Züge" : " Punkte") + '</div>') + '</div>' +
    (wrong.length ? '<div class="card tight" style="margin-top:var(--s5)"><h2>Noch üben</h2>' + wrong.map(c => '<div class="meter"><span class="mt-l">' + esc(c.bedeutung) + '</span><span class="mt-v" style="color:var(--text)">' + esc(shortAns(c.begriff)) + '</span></div>').join("") + '</div>' : '') +
    '<div style="display:flex;gap:var(--s3);justify-content:center;margin-top:var(--s5);flex-wrap:wrap"><button class="btn" id="gm_again">Nochmal</button>' + (GAME.colId && !GAMES[GAME.type].fr ? '<button class="btn primary" id="gm_learn">Diese Wörter richtig lernen</button>' : '') + '</div>';
}
let BLITZ_TIMER = null;
function bindGame() {
  const g = GAME; const q = id => document.getElementById(id);
  const again = q("gm_again"); if (again) again.onclick = () => startGame(g.type, g.colId);
  const learn = q("gm_learn"); if (learn) learn.onclick = () => startTraining(isExamScope(g.colId) ? { mode: "vocab", exam_vocab: String(g.colId).slice(5), direction: "both" } : { mode: "vocab", collection_id: g.colId, direction: "reverse" });
  if (g.type === "artikel" && !g.over) {
    const qq = g.q;
    document.querySelectorAll("[data-ar]").forEach(b => b.onclick = () => {
      if (qq.picked != null) return; qq.picked = +b.dataset.ar;
      if (qq.picked === qq.correct) { g.right++; g.streak++; g.score += 10 + Math.min(g.streak - 1, 5) * 2; } else { g.streak = 0; if (!g.wrong.includes(qq.a.card)) g.wrong.push(qq.a.card); }
      route();
    });
    const nx = q("ar_next"); if (nx) nx.onclick = () => { g.i++; nextArtikel(); route(); };
  }
  if (g.type === "pronomen" && !g.over) {
    const qq = g.q;
    document.querySelectorAll("[data-pr]").forEach(b => b.onclick = () => {
      if (qq.picked != null) return; qq.picked = +b.dataset.pr;
      if (qq.picked === qq.correct) { g.right++; g.score += 10; } else g.wrong.push({ bedeutung: qq.prompt, begriff: qq.answer });
      route();
    });
    const nx = q("pr_next"); if (nx) nx.onclick = () => { g.i++; nextPronomen(); route(); };
  }
  if (g.type === "verben" && !g.over) {
    document.querySelectorAll("[data-vp]").forEach(b => b.onclick = () => { const [key, i] = b.dataset.vp.split("|"); const row = g.pz.rows.find(r => r.key === key); g.pick[key] = row.options[+i]; route(); });
    const ck = q("vp_check"); if (ck) ck.onclick = () => {
      g.res = FRG.checkPuzzle(g.task, g.pick);
      if (g.res.ok) { g.right++; g.score += 10; } else g.wrong.push({ bedeutung: g.task.pr.de + " · " + g.task.verb, begriff: g.pz.answer });
      route();
    };
    const nx = q("vp_next"); if (nx) nx.onclick = () => { g.i++; nextVerb(); route(); };
  }
  if (g.type === "memory") {
    document.querySelectorAll("[data-mem]").forEach(b => b.onclick = () => {
      const i = +b.dataset.mem; if (g.lock || g.open.includes(i)) return;
      g.open.push(i);
      if (g.open.length === 2) {
        g.moves++; const [a, c] = g.open;
        if (g.tiles[a].pair === g.tiles[c].pair) { g.done.push(a, c); g.open = []; }
        else { g.lock = true; setTimeout(() => { g.open = []; g.lock = false; route(); }, 900); }
      }
      route();
    });
  }
  if (g.type === "blitz") {
    clearInterval(BLITZ_TIMER);
    if (!g.over) BLITZ_TIMER = setInterval(() => {
      if (ROUTE.name !== "spiele" || GAME !== g) { clearInterval(BLITZ_TIMER); return; }
      const left = Math.max(0, Math.ceil((g.ends - Date.now()) / 1000));
      const el = document.querySelector("[data-blitz]"); if (el) el.textContent = left;
      if (left <= 0) { clearInterval(BLITZ_TIMER); g.over = true; route(); }
    }, 250);
    document.querySelectorAll("[data-bz]").forEach(b => b.onclick = () => {
      const qq = g.q; if (qq.picked != null) return; qq.picked = +b.dataset.bz;
      if (qq.picked === qq.correct) { g.streak++; g.best = Math.max(g.best, g.streak); g.right++; g.score += 10 + Math.min(g.streak - 1, 5) * 2; }
      else { g.streak = 0; if (!g.wrong.includes(qq.card)) g.wrong.push(qq.card); }
      route();
      setTimeout(() => { if (GAME === g && !g.over) { nextBlitz(); route(); } }, qq.picked === qq.correct ? 350 : 1100);
    });
  }
  if (g.type === "hoeren" && !g.over) {
    const qq = g.q;
    if (!qq.spoken) { qq.spoken = true; setTimeout(() => speak(qq.say, qq.lang), 250); }
    q("hr_play").onclick = () => speak(qq.say, qq.lang);
    document.querySelectorAll("[data-hr]").forEach(b => b.onclick = () => {
      if (qq.picked != null) return; qq.picked = +b.dataset.hr;
      if (qq.picked === qq.correct) { g.right++; g.score += 10; } else if (!g.wrong.includes(qq.card)) g.wrong.push(qq.card);
      route();
    });
    const nx = q("hr_next"); if (nx) nx.onclick = () => { g.i++; nextHoeren(); route(); };
  }
  if (g.type === "salat" && !g.over) {
    const check = () => {
      const letters = [...g.word].filter(ch => ch !== " ");
      if (g.built.length < letters.length) return;
      const ok = g.built.map(b => b.ch).join("") === letters.join("");
      if (ok) { g.score += Math.max(2, 10 - g.hints * 3); g.flash = "ok"; route(); setTimeout(() => { g.flash = ""; g.i++; g.hints = 0; nextSalat(); route(); }, 600); }
      else { g.flash = "bad"; if (!g.wrong.includes(g.card)) g.wrong.push(g.card); route(); setTimeout(() => { g.flash = ""; g.built = []; route(); }, 700); }
    };
    document.querySelectorAll("[data-sl]").forEach(b => b.onclick = () => { const t = g.tiles[+b.dataset.sl]; g.built.push(t); route(); check(); });
    q("sl_back").onclick = () => { g.built.pop(); route(); };
    q("sl_hint").onclick = () => {
      // nächsten richtigen Buchstaben setzen
      const letters = [...g.word].filter(ch => ch !== " ");
      if (g.built.some((b, i) => b.ch !== letters[i])) g.built = [];   // falscher Anfang → neu beginnen
      const need = letters[g.built.length]; const t = g.tiles.find(x => x.ch === need && !g.built.includes(x));
      if (t) { g.built.push(t); g.hints++; } route(); check();
    };
    q("sl_skip").onclick = () => { if (!g.wrong.includes(g.card)) g.wrong.push(g.card); g.i++; g.hints = 0; nextSalat(); route(); };
  }
}
