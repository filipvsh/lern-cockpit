/* =====================================================================
   LERN-COCKPIT · LEKTION (Duolingo-Stil) – Oberfläche
   Route #/lektion?s=<Bereich>  (Bereich wie bei den Spielen: Sammlung,
   leer = alle, „exam:<id>“ = Wörter einer Klausur).
   Antippen statt tippen, sofortige Rückmeldung unten, Fehler kommen am
   Ende noch einmal, XP pro Tag in „einstellungen“ (lektion_xp).
   Lektionen ändern den Wiederholungsplan nicht (wie Spiele).
   ===================================================================== */
let LES = null;
const lesScope = () => ROUTE.query.s || "";
const lesXPToday = () => xpToday();
const lesStreak = () => xpStreak();
const lesBack = sc => isExamScope(sc) ? "#/klausur/" + String(sc).slice(5) + "?tab=spiele" : "#/spiele";
const lesLang = id => { const c = cardById(id); return c ? cardLangOf(c) : "fr"; };
/* Spracherkennung (Nachsprechen) – Chrome/Edge/Android, Safari ab iOS 14.5 */
const SpeechRec = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
const micPaused = () => +lsGet("lc_nomic_until", 0) > Date.now();
const canMic = () => !!SpeechRec() && !micPaused();
let LES_REC = null;

function startLesson(scope) {
  const cards = gameCards(scope);
  const weak = cards.filter(v => Engine.isNew(v) || ["learning", "short"].includes(Engine.stageOf(v).key) || v.last_result === "wrong").map(v => v.id);
  const fr = cards.some(v => cardLangOf(v) === "fr");
  const items = LESSON.buildLesson({ cards: cards.map(v => ({ id: v.id, begriff: v.begriff, bedeutung: v.bedeutung })), weak, speech: canSpeak() && fr, mic: canMic() && fr });
  if (!items.length) { toast("Für eine Lektion brauchst du mindestens 4 Wörter.", true); return; }
  LES = { scope, items, i: 0, total: items.length, right: 0, wrongFirst: 0, combo: 0, best: 0, retries: {}, ui: {}, started: Date.now(), done: false };
  location.hash = "#/lektion?s=" + encodeURIComponent(scope);
  if (ROUTE.name === "lektion") route();
}
/** Einstiegskarte (Spiele-Seite, Klausur-Modus) */
function lessonCard(scope) {
  const n = gameCards(scope).length; const ok = n >= 4; const st = lesStreak();
  return '<div class="card les-card"><div class="les-ic">🦉</div><div class="les-tx"><b>Lektion</b><span class="t-sub">Wie bei Duolingo: Bilder wählen, Paare finden, Lücken füllen, Sätze bauen, Hören – alles antippen.</span><span class="les-meta">' + (lesXPToday() ? "Heute " + lesXPToday() + " XP" : "Heute noch keine Lektion") + (st > 1 ? " · 🔥 " + st + " Tage in Folge" : "") + '</span></div>' +
    '<button class="btn primary lg" data-lesson="' + esc(scope) + '"' + (ok ? "" : " disabled") + '>' + (ok ? "Los geht's" : "Mind. 4 Wörter") + '</button></div>';
}
const bindLessonCards = () => document.querySelectorAll("[data-lesson]").forEach(b => b.onclick = () => startLesson(b.dataset.lesson));

V.lektion = () => {
  if (!engineReady()) return pageHead("Lektion") + setupCard();
  if (!LES || LES.scope !== lesScope()) return pageHead("Lektion", { back: [lesBack(lesScope()), "Zurück"] }) + lessonCard(lesScope());
  if (LES.done) return lesEnd();
  const it = LES.items[LES.i]; const ui = LES.ui;
  const pct = Math.round(Math.min(LES.i, LES.items.length) / LES.items.length * 100);
  const bar = '<div class="les-top"><a class="closebtn" href="' + lesBack(LES.scope) + '" id="les_close" aria-label="Lektion beenden">' + ICO.x + '</a><div class="les-prog"><i style="width:' + pct + '%"></i></div>' + (LES.combo >= 2 ? '<span class="les-combo">🔥 ' + LES.combo + '</span>' : '<span class="les-combo dim">' + LES.right + '</span>') + '</div>';
  return '<div class="les">' + bar + '<div class="les-body">' + (it.retry ? '<div class="les-again">Noch einmal – vorhin falsch</div>' : '') + lesTask(it, ui) + '</div>' + lesFoot(it, ui) + '</div>';
};
const sayBtn = (text, lang, id) => canSpeak() && text ? '<button class="les-say" id="' + (id || "les_say") + '" aria-label="Anhören">🔊</button>' : '';
function lesTask(it, ui) {
  const sel = i => ui.pick === i ? " on" : "";
  const res = (i, correct) => ui.checked ? (i === correct ? " right" : i === ui.pick ? " wrongpick" : "") : "";
  if (it.type === "pic") return '<h2 class="les-h">Wähle das richtige Bild</h2><div class="les-prompt">' + sayBtn(it.say) + '<span>' + esc(it.prompt) + '</span></div><div class="les-pics">' +
    it.opts.map((o, i) => '<button class="les-pic' + sel(i) + res(i, it.correct) + '" data-lo="' + i + '"' + (ui.checked ? " disabled" : "") + '>' + (o.emoji ? '<span class="em">' + o.emoji + '</span>' : '<span class="sw" style="background:' + o.color + '"></span>') + '<span class="lb">' + (ui.checked ? esc(o.label) : "&nbsp;") + '</span></button>').join("") + '</div>';
  if (it.type === "mc") return '<h2 class="les-h">' + (it.dir === "fwd" ? "Was bedeutet das?" : "Wie heißt das auf Französisch?") + '</h2><div class="les-prompt">' + (it.say ? sayBtn(it.say) : "") + '<span>' + esc(it.prompt) + '</span></div><div class="les-opts">' +
    it.opts.map((o, i) => '<button class="les-opt' + sel(i) + res(i, it.correct) + '" data-lo="' + i + '"' + (ui.checked ? " disabled" : "") + '><span class="k">' + (i + 1) + '</span>' + esc(o) + '</button>').join("") + '</div>';
  if (it.type === "gap") { const fill = ui.pick != null ? '<span class="les-fill' + (ui.checked ? (ui.ok ? " ok" : " bad") : "") + '">' + esc(it.opts[ui.pick]) + '</span>' : '<span class="les-blank">&nbsp;</span>';
    return '<h2 class="les-h">Fülle die Lücke</h2><div class="les-sent">' + esc(it.before) + fill + esc(it.after) + '</div><div class="t-sub les-de">' + esc(it.de) + '</div><div class="les-chips">' +
      it.opts.map((o, i) => '<button class="les-chip' + sel(i) + '" data-lo="' + i + '"' + (ui.checked ? " disabled" : "") + '>' + esc(o) + '</button>').join("") + '</div>'; }
  if (it.type === "build" || it.type === "listen") {
    const used = ui.order || [];
    const head = it.type === "build" ? '<h2 class="les-h">Übersetze diesen Satz</h2><div class="les-prompt"><span>' + esc(it.prompt) + '</span></div>'
      : '<h2 class="les-h">Tippe, was du hörst</h2><div class="les-listen"><button class="les-big" id="les_say">🔊</button><button class="les-slow" id="les_slow" aria-label="Langsam">🐢</button></div>';
    return head + '<div class="les-line">' + (used.length ? used.map((ti, k) => '<button class="les-tile in" data-lu="' + k + '"' + (ui.checked ? " disabled" : "") + '>' + esc(it.tiles[ti]) + '</button>').join("") : '<span class="t-sub">Tippe die Wörter in der richtigen Reihenfolge an</span>') + '</div>' +
      '<div class="les-bank">' + it.tiles.map((t, i) => '<button class="les-tile' + (used.includes(i) ? " gone" : "") + '" data-lt="' + i + '"' + (used.includes(i) || ui.checked ? " disabled" : "") + '>' + esc(t) + '</button>').join("") + '</div>';
  }
  if (it.type === "speak") {
    const st = ui.rec === "on" ? "Ich höre zu … sprich jetzt" : ui.rec === "err" ? ui.recErr : ui.heard ? "Gehört: „" + ui.heard + "“" + (ui.ok == null && ui.tries ? " – nicht ganz, versuch's nochmal" : "") : "Tippe aufs Mikrofon und sprich nach";
    return '<h2 class="les-h">Sprich nach</h2><div class="les-prompt">' + sayBtn(it.say) + '<span>' + esc(it.target) + '</span></div><div class="t-sub les-de">' + esc(it.de) + '</div>' +
      '<div class="les-micw"><button class="les-mic' + (ui.rec === "on" ? " on" : "") + '" id="les_mic"' + (ui.checked ? " disabled" : "") + ' aria-label="Sprechen">🎤</button><div class="t-sub les-heard">' + esc(st) + '</div></div>';
  }
  if (it.type === "pairs") {
    const m = ui.matched || [];
    const col = (side, list) => list.map(x => { const done = m.includes(x.id); return '<button class="les-pair' + (done ? " done" : "") + (ui.sel && ui.sel.side === side && ui.sel.id === String(x.id) ? " on" : "") + (ui.bad && ui.bad[side] === String(x.id) ? " bad" : "") + '" data-lp="' + side + '|' + esc(String(x.id)) + '"' + (done ? " disabled" : "") + '>' + esc(x.text) + '</button>'; }).join("");
    return '<h2 class="les-h">Finde die Paare</h2><div class="les-pairs"><div>' + col("l", it.left) + '</div><div>' + col("r", it.right) + '</div></div>';
  }
  return "";
}
function lesFoot(it, ui) {
  if (ui.checked) {
    const sol = it.type === "speak" ? it.target + (ui.heard ? " (gehört: „" + ui.heard + "“)" : "") : it.type === "pic" ? it.prompt + " – " + it.opts[it.correct].label : it.type === "mc" ? it.opts[it.correct] : it.type === "gap" ? it.full : it.type === "pairs" ? "" : it.target;
    return '<div class="les-foot ' + (ui.ok ? "ok" : "bad") + '"><div class="les-fb"><b>' + (ui.ok ? ["Super!", "Richtig!", "Klasse!", "Genau!"][LES.i % 4] : "Richtige Lösung:") + '</b>' + (!ui.ok || it.type === "listen" || it.type === "build" ? '<span>' + esc(sol) + (it.de && it.type === "listen" ? " · " + esc(it.de) : "") + '</span>' : '') + '</div><button class="btn lg les-next" id="les_next">Weiter</button></div>';
  }
  if (it.type === "pairs") return '<div class="les-foot"><span class="t-sub">' + (ui.matched || []).length + ' von ' + it.left.length + ' Paaren</span></div>';
  const ready = it.type === "build" || it.type === "listen" ? (ui.order || []).length > 0 : ui.pick != null;
  if (it.type === "speak") return '<div class="les-foot"><button class="btn plain" id="les_nomic">Kann gerade nicht sprechen</button></div>';
  return '<div class="les-foot">' + (it.type === "listen" ? '<button class="btn plain" id="les_noaudio">Kann gerade nicht hören</button>' : '<button class="btn plain" id="les_skip">Überspringen</button>') + '<button class="btn primary lg" id="les_check"' + (ready ? "" : " disabled") + '>Prüfen</button></div>';
}
function lesCheck() {
  const it = LES.items[LES.i], ui = LES.ui;
  if (it.type === "build" || it.type === "listen") ui.ok = LESSON.checkBuild((ui.order || []).map(i => it.tiles[i]), it.target);
  else ui.ok = ui.pick === it.correct;
  lesResult(ui.ok);
}
function lesResult(ok) {
  const it = LES.items[LES.i], ui = LES.ui; ui.checked = true; ui.ok = ok;
  if (ok) { if (!it.retry) LES.right++; LES.combo++; LES.best = Math.max(LES.best, LES.combo); }
  else {
    LES.combo = 0; if (!it.retry) LES.wrongFirst++;
    const n = LES.retries[it.card + it.type] || 0;
    if (n < 2) { LES.retries[it.card + it.type] = n + 1; LES.items.push(Object.assign({}, it, { retry: true })); }   // kommt am Ende noch einmal
  }
  route();
}
/** „Kann gerade nicht hören“: Hör-Aufgaben dieser Lektion fallen weg – ohne Fehler, ohne Wiederholung */
function lesNoAudio() {
  const rest = LES.items.slice(LES.i).filter(x => x.type === "listen" && !x.retry).length;
  LES.items = LES.items.slice(0, LES.i).concat(LES.items.slice(LES.i).filter(x => x.type !== "listen"));
  LES.total = Math.max(1, LES.total - rest); LES.ui = {}; LES.i--;
  toast("Okay – Hör-Aufgaben in dieser Lektion ausgelassen");
  lesNext();
}
/** „Kann gerade nicht sprechen“: Sprech-Aufgaben fallen weg (1 Stunde lang auch in neuen Lektionen) */
function lesNoMic() {
  lsSet("lc_nomic_until", Date.now() + 3600e3); try { if (LES_REC) LES_REC.abort(); } catch (e) {}
  const rest = LES.items.slice(LES.i).filter(x => x.type === "speak" && !x.retry).length;
  LES.items = LES.items.slice(0, LES.i).concat(LES.items.slice(LES.i).filter(x => x.type !== "speak"));
  LES.total = Math.max(1, LES.total - rest); LES.ui = {}; LES.i--;
  toast("Okay – Sprechen ist für eine Stunde aus");
  lesNext();
}
/** Mikrofon: zuhören, mit dem Ziel vergleichen; 1. Fehlversuch ohne Strafe */
function lesListenMic(it, ui) {
  const SR = SpeechRec(); if (!SR) return;
  try { if (LES_REC) LES_REC.abort(); } catch (e) {}
  const rec = new SR(); LES_REC = rec;
  rec.lang = "fr-FR"; rec.interimResults = false; rec.maxAlternatives = 4;
  ui.rec = "on"; route();
  rec.onresult = e => {
    const alts = [...(e.results[0] || [])].map(a => a.transcript); ui.heard = alts[0] || ""; ui.rec = null;
    if (LESSON.speechOk(alts, it.target)) lesResult(true);
    else { ui.tries = (ui.tries || 0) + 1; if (ui.tries >= 2) lesResult(false); else route(); }
  };
  rec.onerror = e => {
    ui.rec = "err";
    ui.recErr = e.error === "not-allowed" || e.error === "service-not-allowed" ? "Kein Zugriff aufs Mikrofon – erlaube es in den Browser-Einstellungen oder tippe „Kann gerade nicht sprechen“."
      : e.error === "no-speech" ? "Ich habe nichts gehört – tippe nochmal aufs Mikrofon." : e.error === "network" ? "Spracherkennung braucht gerade Internet." : "Das Mikrofon hat nicht geklappt – nochmal versuchen.";
    route();
  };
  rec.onend = () => { if (ui.rec === "on") { ui.rec = null; route(); } };
  try { rec.start(); } catch (e) { ui.rec = "err"; ui.recErr = "Das Mikrofon hat nicht geklappt – nochmal versuchen."; route(); }
}
async function lesNext() {
  try { if (LES_REC) LES_REC.abort(); } catch (e) {}
  LES.i++; LES.ui = {};
  if (LES.i >= LES.items.length) {
    LES.done = true; LES.xp = LESSON.lessonXP(LES.right, LES.total, LES.best);
    await addXP(LES.xp, { perfect: LES.right === LES.total && !LES.wrongFirst });
  }
  route();
}
function lesEnd() {
  const acc = Math.round(LES.right / LES.total * 100); const mins = Math.max(1, Math.round((Date.now() - LES.started) / 60000)); const st = lesStreak();
  return '<div class="les les-done"><div class="les-trophy">' + (acc === 100 ? "🏆" : acc >= 70 ? "🎉" : "💪") + '</div><h1 class="fx-title">' + (acc === 100 ? "Perfekte Lektion!" : "Lektion geschafft!") + '</h1>' +
    '<div class="les-stats"><div><b>+' + LES.xp + '</b><span>XP</span></div><div><b>' + acc + ' %</b><span>richtig</span></div><div><b>' + mins + '</b><span>' + (mins === 1 ? "Minute" : "Minuten") + '</span></div>' + (LES.best >= 3 ? '<div><b>🔥 ' + LES.best + '</b><span>beste Serie</span></div>' : '') + '</div>' +
    '<div class="les-goal"><div class="mo-bar"><i style="width:' + Math.min(100, Math.round(xpToday() / xpGoal() * 100)) + '%"></i></div><span class="t-sub">' + (xpToday() >= xpGoal() ? "🔥 Tagesziel geschafft – " : "Heute ") + xpToday() + ' / ' + xpGoal() + ' XP' + (st > 1 ? ' · ' + st + ' Tage in Folge' : '') + '</span></div>' +
    '<div class="les-endbtn"><button class="btn primary lg" id="les_again">Noch eine Lektion</button><a class="btn lg" href="' + lesBack(LES.scope) + '">Fertig</a></div></div>';
}
function bindLektion() {
  bindLessonCards();
  if (!LES || LES.scope !== lesScope()) return;
  document.body.classList.add("focus");
  const q = id => document.getElementById(id);
  const again = q("les_again"); if (again) again.onclick = () => startLesson(LES.scope);
  if (LES.done) return;
  const it = LES.items[LES.i], ui = LES.ui;
  const lang = it.type === "listen" || it.type === "gap" || it.type === "build" ? "fr" : lesLang(it.card);
  const say = q("les_say"); if (say) say.onclick = () => speak(it.say, lang);
  const slow = q("les_slow"); if (slow) slow.onclick = () => speak(it.say, lang, 0.55);
  if (!ui.checked && !ui.spoken && it.say && (it.type === "listen" || it.type === "pic" || (it.type === "mc" && it.dir === "fwd"))) { ui.spoken = true; setTimeout(() => speak(it.say, lang), 300); }
  document.querySelectorAll("[data-lo]").forEach(b => b.onclick = () => { ui.pick = +b.dataset.lo; route(); });
  document.querySelectorAll("[data-lt]").forEach(b => b.onclick = () => { (ui.order = ui.order || []).push(+b.dataset.lt); route(); });
  document.querySelectorAll("[data-lu]").forEach(b => b.onclick = () => { ui.order.splice(+b.dataset.lu, 1); route(); });
  document.querySelectorAll("[data-lp]").forEach(b => b.onclick = () => {
    const [side, id] = b.dataset.lp.split("|"); ui.bad = null;
    if (!ui.sel || ui.sel.side === side) { ui.sel = { side, id }; route(); return; }
    const okPair = ui.sel.id === id;
    if (okPair) { (ui.matched = ui.matched || []).push(it.left.find(x => String(x.id) === id).id); ui.sel = null; }
    else { ui.mistakes = (ui.mistakes || 0) + 1; ui.bad = { [ui.sel.side]: ui.sel.id, [side]: id }; ui.sel = null; LES.combo = 0; }
    route();
    if (okPair && ui.matched.length === it.left.length) setTimeout(() => lesResult(!ui.mistakes), 250);
    else if (!okPair) setTimeout(() => { if (LES && LES.ui === ui) { ui.bad = null; route(); } }, 600);
  });
  const ck = q("les_check"); if (ck) ck.onclick = lesCheck;
  const sk = q("les_skip"); if (sk) sk.onclick = () => lesResult(false);
  const na = q("les_noaudio"); if (na) na.onclick = lesNoAudio;
  const nm = q("les_nomic"); if (nm) nm.onclick = lesNoMic;
  const mic = q("les_mic"); if (mic) mic.onclick = () => ui.rec === "on" ? (LES_REC && LES_REC.stop()) : lesListenMic(it, ui);
  const nx = q("les_next"); if (nx) { nx.onclick = lesNext; setTimeout(() => nx.focus(), 30); }
}

/* Tastatur am Computer: 1–4 wählen, Enter = Prüfen / Weiter, Rücktaste = letzte Kachel weg */
document.addEventListener("keydown", e => {
  if (ROUTE.name !== "lektion" || !LES || LES.done || e.target.closest("input,textarea,select") || document.getElementById("mbg")) return;
  const it = LES.items[LES.i], ui = LES.ui;
  if (e.key === "Enter") { const b = document.getElementById(ui.checked ? "les_next" : "les_check"); if (b && !b.disabled) { e.preventDefault(); b.click(); } return; }
  if (ui.checked) return;
  if (/^[1-9]$/.test(e.key) && it.opts && +e.key <= it.opts.length) { ui.pick = +e.key - 1; route(); }
  else if (e.key === "Backspace" && ui.order && ui.order.length) { e.preventDefault(); ui.order.pop(); route(); }
});
