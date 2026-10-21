/* =====================================================================
   LERN-COCKPIT · KLAUSUR-MODUS
   Eine Seite pro anstehender Klausur – Route #/klausur/<id>?tab=…
   Nur das, was zu dieser Klausur gehört: ihre Vokabeln (verknüpfte
   Sammlungen, bisheriger Lernstand zählt), Spiele mit genau diesen Wörtern,
   ihre Themen, Probeklausur und Material. Ist die Klausur geschrieben
   (Punkte eingetragen oder Datum vorbei), verschwindet der Modus.
   ===================================================================== */
const KM_LANG = /Französisch|Englisch|Latein|Spanisch/;
const kmActive = k => !!k && !isVocabTest(k) && upcomingKL().some(x => x.id === k.id);
const kmExams = () => upcomingKL().filter(k => !isVocabTest(k));
const kmHasVocab = k => KM_LANG.test(k.fach) || linkedCollections(k).length > 0;
function kmTabs(k) {
  const t = [["start", "Start"]];
  if (videosFor(k).length) t.push(["videos", "Videos"]);
  if (kmHasVocab(k)) t.push(["vokabeln", "Vokabeln"], ["spiele", "Spiele"]);
  if (k.fach === "Französisch") t.push(["grammatik", "Grammatik"], ["schreiben", "Schreiben"]);
  t.push(["themen", "Aufgaben"]);
  return t;
}
const kmTab = k => { const tabs = kmTabs(k); return tabs.some(t => t[0] === ROUTE.query.tab) ? ROUTE.query.tab : "start"; };
const kmVocabStart = k => ({ mode: "vocab", exam_vocab: k.id, direction: vlDir(), from: "klausur" });

V.klausur = () => {
  if (!engineReady()) return pageHead("Klausur-Modus") + setupCard();
  const k = klById(decodeURIComponent(ROUTE.sub || ""));
  if (!k) return pageHead("Klausur-Modus", { back: ["#/lernplan", "Lernplan"] }) + '<div class="card">' + emptyState("flag", "Klausur nicht gefunden", "Vielleicht wurde sie gelöscht.") + '</div>';
  if (!kmActive(k)) return pageHead("Klausur-Modus", { back: ["#/lernplan/" + k.id, "Klausur"] }) + '<div class="card">' + emptyState("check", "Diese Klausur ist geschrieben", "Der Klausur-Modus ist damit beendet. Deine Vokabeln behalten ihren Lernstand und kommen im normalen Plan weiter dran.", '<a class="btn sm" href="#/dashboard">Zur Übersicht</a>') + '</div>';
  const tab = kmTab(k);
  const nav = '<div class="seg dx-tabs km-tabs">' + kmTabs(k).map(([t, l]) => '<a class="' + (t === tab ? "on" : "") + '" href="#/klausur/' + esc(k.id) + '?tab=' + t + '">' + l + '</a>').join("") + '</div>';
  return netNotice() + kmHead(k) + nav + '<div id="km_body">' + ({ start: kmStart, videos: k2 => videoList(k2), vokabeln: kmVokabeln, spiele: kmSpiele, grammatik: kmGrammatik, schreiben: kmSchreiben, themen: kmThemen }[tab])(k) + '</div>';
};
function kmHead(k) {
  const d = daysUntil(k.datum); const r = readinessOf(k);
  return '<a class="backlink" href="#/dashboard">' + ICO.back + 'Übersicht</a><div class="km-hero"><div style="min-width:0"><div class="eyebrow"><span class="dot" style="background:' + fcol(k.fach) + ';margin-right:6px"></span>' + esc(k.fach) + ' · ' + esc(fmtDL(k.datum)) + (k.uhrzeit ? " · " + esc(k.uhrzeit) : "") + '</div><h1 class="t-large">Klausur-Modus</h1><p class="t-callout">' + esc(klTitle(k)) + '</p></div>' +
    '<div class="km-days"><span class="num">' + d + '</span><small>' + (d === 0 ? "heute" : d === 1 ? "Tag" : "Tage") + '</small>' + (r.score != null ? '<small>' + r.score + ' % bereit</small>' : '') + '</div></div>';
}
function bindKlausur() {
  const k = klById(decodeURIComponent(ROUTE.sub || "")); if (!kmActive(k)) return;
  const q = id => document.getElementById(id);
  document.querySelectorAll("[data-kmgo]").forEach(b => b.onclick = () => kmAction(k, b.dataset.kmgo));
  ({ schreiben: () => bindKmSchreiben(k), vokabeln: () => bindKmVokabeln(k), spiele: () => { document.querySelectorAll("[data-game]").forEach(b => b.onclick = () => startGame(b.dataset.game, "exam:" + k.id)); bindLessonCards(); } }[kmTab(k)] || (() => {}))();
  const lk = q("km_link"); if (lk) lk.onclick = () => kmLinkModal(k);
  bindGrammarGames("exam:" + k.id); bindVideos();
  document.querySelectorAll("[data-game]").forEach(b => b.onclick = () => startGame(b.dataset.game, "exam:" + k.id));
}
function kmAction(k, what) {
  const [kind, arg] = what.split(":");
  if (kind === "vocab") startTraining(kmVocabStart(k));
  else if (kind === "topic") startTraining({ mode: "topic", subtopic_id: arg, from: "klausur" });
  else if (kind === "mixed") startTraining({ mode: "mixed", exam_id: k.id, from: "klausur" });
  else if (kind === "mock") mockModal(k);
  else if (kind === "setup") topicAssistant(k);
  else if (kind === "lesson") startLesson("exam:" + k.id);
  else if (kind === "game") startGame(arg, "exam:" + k.id);
  else if (kind === "tab") location.hash = "#/klausur/" + k.id + "?tab=" + arg;
}

/* ---------- Überblick: was heute dran ist + Fortschritt ---------- */
function kmSteps(k) {
  const out = []; const words = examVocab(k);
  // 1. Video, das noch fehlt (erst verstehen, dann üben)
  const vids = videosFor(k).flatMap(s => s.videos); const seen = videoSeen(); const nextVid = vids.find(v => !seen[v.id]);
  if (nextVid) out.push({ go: "tab:videos", title: "Video: " + nextVid.t, sub: vids.filter(v => seen[v.id]).length + " von " + vids.length + " Videos gesehen", main: true });
  if (words.length) {
    const d = dayStatus(words); const fresh = words.filter(Engine.isNew).length;
    out.push({ go: "vocab", title: "Vokabeln lernen", sub: d.due || fresh ? [d.due ? plural(d.due, "Wiederholung", "Wiederholungen") : "", fresh ? fresh + " noch neu" : ""].filter(Boolean).join(" · ") : "Alles wiederholt – freiwillig festigen", main: !!(d.due || fresh) });
    if (words.length >= 4) out.push({ go: "lesson", title: "Lektion (wie Duolingo)", sub: "Bilder, Paare, Lücken, Sätze bauen, Hören", main: false });
  } else if (KM_LANG.test(k.fach)) out.push({ go: "tab:vokabeln", title: "Vokabeln festlegen", sub: "Welche Sammlungen kommen in der Klausur dran?", main: true });
  if (!subsOfExam(k.id).length) out.push({ go: "setup", title: "Themen festlegen", sub: "Was kommt dran? Dann baut die App die Übungen." , main: !out.some(x => x.main) });
  else weakestSubs(k, 2).forEach(st => { const m = masteryOf(st.id).score; out.push({ go: "topic:" + st.id, title: st.title, sub: m == null ? "Noch nicht geübt" : m + " % sicher", main: false }); });
  const today = roadmapOf(k).find(s => s.day === 0);
  if (today && today.kind === "mock") out.push({ go: "mock", title: "Probeklausur schreiben", sub: today.sub, main: true });
  if (/Mathe/.test(k.fach)) out.push({ go: "game:graph", title: "Graphen-Quiz", sub: "Graph ansehen, Funktion antippen – ohne Tippen", main: false });
  if (kmHasVocab(k) && hasFrench("exam:" + k.id)) out.push({ go: "tab:spiele", title: "Spiele", sub: "Artikel, Pronomen, Verb-Puzzle, Hören …", main: false });
  return out;
}
function kmStart(k) {
  const steps = kmSteps(k); const words = examVocab(k); const subs = subsOfExam(k.id);
  const extrem = typeof isExtremExam === "function" && isExtremExam(k) ? extremEntry(k) : "";
  const todo = '<div class="card km-steps"><h2>Heute für diese Klausur</h2>' + steps.map((s, i) => '<button class="km-step' + (i === 0 && s.main ? " km-main" : "") + '" data-kmgo="' + esc(s.go) + '"><span class="km-n">' + (i + 1) + '</span><span class="km-t"><b>' + esc(s.title) + '</b><span class="t-sub">' + esc(s.sub) + '</span></span>' + ICO.play + '</button>').join("") + '</div>';
  const voc = words.length ? '<div class="card"><h2>Vokabeln</h2><p class="hint" style="margin-top:0">Dein bisheriger Stand zählt – hier lernst du mit denselben Karten weiter.</p>' + stageBar(words) + '</div>' : '';
  const th = subs.length ? '<div class="card"><h2>Themen</h2>' + subs.map(st => { const m = masteryOf(st.id).score; return '<div class="km-sub"><span>' + esc(st.title) + '</span><span class="t-sub">' + (m == null ? "neu" : m + " %") + '</span>' + progBar(m || 0, m == null ? "" : m >= 80 ? "g" : m >= 60 ? "" : "o") + '</div>'; }).join("") + '</div>' : '';
  return extrem + todo + '<div class="km-grid">' + voc + th + '</div>';
}

/* ---------- Vokabeln: nur die Sammlungen dieser Klausur ---------- */
function kmVokabeln(k) {
  const cols = linkedCollections(k); const words = examVocab(k);
  if (!cols.length) return '<div class="card">' + emptyState("vokabeln", "Noch keine Vokabeln verknüpft", "Wähle die Sammlungen, die in der Klausur drankommen. Dein Lernstand bleibt erhalten.", '<button class="btn primary sm" id="km_link">Sammlungen wählen</button>') + '</div>';
  const d = dayStatus(words);
  const start = '<div class="card km-go"><div><h2 style="margin:0">' + plural(words.length, "Wort", "Wörter") + '</h2><div class="t-sub">' + (d.open ? [d.due ? plural(d.due, "Wiederholung", "Wiederholungen") : "", words.filter(Engine.isNew).length ? words.filter(Engine.isNew).length + " neu" : ""].filter(Boolean).join(" · ") : "Heute alles wiederholt – Zusatzrunde geht immer") + '</div></div>' +
    '<div class="seg vl-dir">' + VL_DIRS.map(([key, t]) => '<button class="' + (vlDir() === key ? "on" : "") + '" data-vldir="' + key + '">' + t + '</button>').join("") + '</div>' +
    '<button class="btn primary lg" data-kmgo="vocab">' + ICO.play + 'Vokabelrunde starten</button></div>';
  const colsHtml = '<div class="card"><div class="km-row-h"><h2 style="margin:0">Sammlungen</h2><button class="btn sm" id="km_link">Ändern</button></div><div class="list" style="margin-top:var(--s3)">' + cols.map(c => '<a class="li" href="#/vokabeln/' + esc(c.id) + '"><div class="li-main"><div class="li-title">' + esc(c.name) + '</div><div class="li-sub mini-stages">' + miniStages(cardsOf(c.id)) + '</div></div><span class="chev">' + ICO.chev + '</span></a>').join("") + '</div>' + stageBar(words) + '</div>';
  const list = '<details class="card km-words"><summary>Alle Wörter ansehen (' + words.length + ')</summary><div class="km-wl">' + words.map(v => { const st = Engine.stageOf(v); return '<div class="km-w"><span class="sb-legend km-dot" title="' + esc(st.label) + '"><i class="' + st.key + '"></i></span><b>' + esc(v.begriff) + '</b><span>' + esc(v.bedeutung) + '</span></div>'; }).join("") + '</div></details>';
  return start + colsHtml + list;
}
function bindKmVokabeln(k) {
  document.querySelectorAll("[data-vldir]").forEach(b => b.onclick = async () => { await setSetting("vl_dir", b.dataset.vldir); document.querySelectorAll("[data-vldir]").forEach(x => x.classList.toggle("on", x === b)); });
}
function kmLinkModal(k) {
  const lang = LANG_CODE[k.fach];
  const cols = ES.collections.filter(c => !lang || c.source_language === lang).sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
  const on = new Set(linkedCollections(k).map(c => c.id));
  openModal("Vokabeln für die " + esc(k.fach) + "-Klausur", '<p class="hint">Was kommt in der Klausur dran? Nur diese Wörter übst du im Klausur-Modus. Dein Lernstand bleibt erhalten.</p>' +
    (cols.length ? '<div class="km-pick">' + cols.map(c => '<label class="km-pk"><input type="checkbox" value="' + esc(c.id) + '"' + (on.has(c.id) ? " checked" : "") + '><span>' + esc(c.name) + '</span><span class="t-sub">' + cardsOf(c.id).length + (isArchived(c.id) ? " · Archiv" : "") + '</span></label>').join("") + '</div>' : emptyState("vokabeln", "Keine passenden Sammlungen", "Leg zuerst eine Sammlung an.")),
    '<button class="btn" id="kl_cancel">Abbrechen</button><button class="btn primary" id="kl_save">Speichern</button>', () => {
      document.getElementById("kl_cancel").onclick = closeModal;
      document.getElementById("kl_save").onclick = async () => {
        const ids = [...document.querySelectorAll(".km-pk input:checked")].map(i => i.value);
        const names = ids.map(id => colById(id).name);
        for (const id of ids) if (isArchived(id)) await setArchived(id, false);   // was zur Klausur gehört, ist nicht im Archiv
        await saveKL(k, { vokabel_lektionen: names }); bump(); closeModal(); route(); toast(plural(names.length, "Sammlung", "Sammlungen") + " verknüpft");
      };
    });
}

/* ---------- Spiele: nur mit den Wörtern dieser Klausur ---------- */
function kmSpiele(k) {
  const sc = "exam:" + k.id; const fr = hasFrench(sc);
  if (!gameCards(sc).length) return '<div class="card">' + emptyState("vokabeln", "Noch keine Wörter", "Verknüpfe zuerst die Vokabeln dieser Klausur.", '<button class="btn primary sm" id="km_link">Sammlungen wählen</button>') + '</div>';
  const keys = Object.keys(GAMES).filter(g => fr || (!GAMES[g].fr && g !== "artikel"));
  const order = fr ? ["verben", "artikel", "pronomen", "hoeren", "blitz", "memory", "salat"] : keys;
  return lessonCard(sc) + '<p class="hint" style="margin-top:0">Alle Spiele nur mit den ' + gameCards(sc).length + ' Wörtern dieser Klausur.' + (fr ? ' Verb-Puzzle und Pronomen üben die Grammatik.' : '') + '</p><div class="game-grid">' + order.filter(g => keys.includes(g)).map(g => gameTile(g, sc)).join("") + '</div>';
}

/* ---------- Grammatik: Spickzettel + direkt üben ---------- */
function kmGrammatik(k) {
  return '<p class="hint" style="margin-top:0">Kurz erklärt, mit Beispielen – tippe auf ein Thema. „Jetzt üben“ startet das passende Spiel.</p>' + GRAMMAR_NOTES.map(n => grammarCard(n)).join("");
}

/* ---------- Themen, Probeklausur, Material ---------- */
function kmThemen(k) {
  const tps = topicsOfExam(k.id).filter(t => t.status !== "paused");
  const mathe = /Mathe/.test(k.fach) ? '<div class="game-grid" style="margin-bottom:var(--s5)">' + gameTile("graph", "exam:" + k.id) + '</div><p class="hint">Rechenaufgaben löst du auf Papier – dann Lösung zeigen und selbst bewerten.</p>' : '';
  const head = '<div class="km-actions">' + (subsOfExam(k.id).length ? '<button class="btn primary" data-kmgo="mixed">' + ICO.play + 'Gemischt üben</button><button class="btn" data-kmgo="mock">Probeklausur</button>' : '<button class="btn primary" data-kmgo="setup">Themen festlegen</button>') + '<a class="btn" href="#/lernplan/' + esc(k.id) + '">Bearbeiten</a></div>';
  const body = tps.map(t => { const subs = subsOfTopic(t.id); return '<div class="card"><h2>' + esc(t.title) + '</h2>' + (subs.length ? subs.map(st => { const m = masteryOf(st.id).score; const n = exercisesOf(st.id).length;
    return '<div class="km-th"><div class="km-tt"><b>' + esc(st.title) + '</b><span class="t-sub">' + (m == null ? "noch nicht geübt" : m + " % sicher") + (n ? " · " + plural(n, "Aufgabe", "Aufgaben") : "") + '</span>' + progBar(m || 0, m == null ? "" : m >= 80 ? "g" : m >= 60 ? "" : "o") + '</div><button class="btn sm" data-kmgo="topic:' + esc(st.id) + '">Üben</button></div>'; }).join("") : '<div class="hint">Noch keine Unterthemen.</div>') + '</div>'; }).join("");
  const docs = typeof docsFor === "function" ? docsFor(k) : [];
  const mat = '<div class="card"><h2>Material</h2>' + (docs.length ? '<div class="doc-list">' + docs.map(d => '<a class="matl" href="#/material/' + esc(d.id) + '">' + ICO.material + ' ' + esc(d.title) + '</a>').join("") + '</div>' : '<div class="hint">Lade z. B. deine Probe-Klausur unter Mehr → Material hoch und ordne sie dieser Klausur zu.</div>') + '</div>';
  return head + mathe + (body || '<div class="card">' + emptyState("lernplan", "Noch keine Themen", "Leg fest, was drankommt.") + '</div>') + mat;
}

/** Einstieg im Dashboard: alle anstehenden Klausuren */
function kmEntries() {
  const ks = kmExams(); if (!ks.length) return "";
  return '<div class="card km-list"><h2>Klausur-Modus</h2><p class="hint" style="margin-top:0">Nur für eine Klausur üben – übersichtlich an einem Ort.</p>' + ks.map(k => { const d = daysUntil(k.datum);
    return '<a class="km-ent" href="#/klausur/' + esc(k.id) + '"><span class="dot" style="background:' + fcol(k.fach) + '"></span><span class="km-t"><b>' + esc(k.fach) + '</b><span class="t-sub">' + esc(klTitle(k)) + '</span></span><span class="km-d">' + (d === 0 ? "heute" : d === 1 ? "morgen" : d + " Tage") + '</span><span class="chev">' + ICO.chev + '</span></a>'; }).join("") + '</div>';
}
