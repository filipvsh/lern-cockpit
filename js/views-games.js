/* =====================================================================
   LERN-COCKPIT · LERNSPIELE
   Kurze Spiele mit deinen eigenen Vokabeln und Fachbegriffen:
     Memory          Paare aus Wort und Übersetzung finden
     Blitz (60 s)    so viele richtige Antworten wie möglich, Serien geben Bonus
     Buchstabensalat Wort aus Buchstaben-Kacheln zusammensetzen – ohne Tastatur
   Spiele ändern den Wiederholungsplan nicht. Bestwerte pro Gerät.
   ===================================================================== */
const GAMES = {
  memory: { name: "Memory", desc: "Finde die Paare aus Wort und Übersetzung. Je weniger Züge, desto besser.", ico: "vokabeln", min: 4 },
  blitz: { name: "Blitz · 60 Sekunden", desc: "So viele richtige Antworten wie möglich. Serien geben Bonuspunkte.", ico: "clock", min: 4 },
  salat: { name: "Buchstabensalat", desc: "Setz das Wort aus Buchstaben-Kacheln zusammen – trainiert die Schreibweise, ganz ohne Tastatur.", ico: "edit", min: 3 }
};
let GAME = null;          // laufendes Spiel
let GAME_COL = lsGet("lc_game_col", "");
const bestKey = (g, col) => "lc_best_" + g + "_" + (col || "all");
const gameCards = colId => (colId ? cardsOf(colId) : activeCards()).filter(v => v.begriff && v.bedeutung);
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
  const tiles = Object.entries(GAMES).map(([k, g]) => { const best = lsGet(bestKey(k, GAME_COL), null); const ok = n >= g.min;
    return '<button class="game-tile" data-game="' + k + '"' + (ok ? "" : " disabled") + '><span class="gi">' + ICO[g.ico] + '</span><b>' + g.name + '</b><span class="t-sub">' + g.desc + '</span><span class="gbest">' + (!ok ? "Mindestens " + g.min + " Wörter nötig" : best == null ? "Noch kein Bestwert" : k === "memory" ? "Bestwert: " + best + " Züge" : "Bestwert: " + best + " Punkte") + '</span></button>'; }).join("");
  return head + pick + '<div class="game-grid">' + tiles + '</div>';
};
function bindSpiele() {
  if (GAME && ROUTE.sub === GAME.type) return bindGame();
  const sel = document.getElementById("gm_col"); if (sel) sel.onchange = () => { GAME_COL = sel.value; lsSet("lc_game_col", GAME_COL); route(); };
  document.querySelectorAll("[data-game]").forEach(b => b.onclick = () => startGame(b.dataset.game));
}
function startGame(type) {
  const cards = Engine.shuffle(gameCards(GAME_COL));
  const col = colById(GAME_COL);
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
  }
  GAME.col = col ? col.name : "Alle Sammlungen"; GAME.colId = GAME_COL;
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
function nextSalat() {
  const g = GAME; const c = g.pool[g.i]; if (!c) { g.over = true; return; }
  const word = shortAns(c.begriff);
  g.word = word; g.card = c; g.built = [];
  // Leerzeichen stehen fest, alle anderen Zeichen werden gemischt
  g.tiles = Engine.shuffle([...word].map((ch, k) => ({ k, ch })).filter(t => t.ch !== " "));
}
function gameStage() {
  const g = GAME; const name = GAMES[g.type].name;
  const top = '<div class="game-top"><a class="backlink" href="#/spiele" id="gm_back">' + ICO.back + 'Spiele</a><span class="t-sub">' + esc(name) + ' · ' + esc(g.col) + '</span></div>';
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
    '<div style="display:flex;gap:var(--s3);justify-content:center;margin-top:var(--s5);flex-wrap:wrap"><button class="btn" id="gm_again">Nochmal</button>' + (GAME.colId ? '<button class="btn primary" id="gm_learn">Diese Wörter richtig lernen</button>' : '') + '</div>';
}
let BLITZ_TIMER = null;
function bindGame() {
  const g = GAME; const q = id => document.getElementById(id);
  const again = q("gm_again"); if (again) again.onclick = () => startGame(g.type);
  const learn = q("gm_learn"); if (learn) learn.onclick = () => startTraining({ mode: "vocab", collection_id: g.colId, direction: "reverse" });
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
