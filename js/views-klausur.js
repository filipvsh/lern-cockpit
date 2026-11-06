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
  const t = [["start", "Start"], ["checkliste", "Checkliste"]];
  if (videosFor(k).length) t.push(["videos", "Videos"]);
  if (kmHasVocab(k)) t.push(["vokabeln", "Vokabeln"], ["spiele", "Spiele"]);
  if (k.fach === "Französisch") t.push(["grammatik", "Grammatik"], ["schreiben", "Schreiben"]);
  t.push(["themen", "Themen & Übungen"]);
  return t;
}
const kmTab = k => { const tabs = kmTabs(k); return tabs.some(t => t[0] === ROUTE.query.tab) ? ROUTE.query.tab : "start"; };
const kmVocabStart = k => ({ mode: "vocab", exam_vocab: k.id, direction: vlDir(), from: "klausur" });

V.klausur = () => {
  if (!engineReady()) return pageHead("Klausur") + setupCard();
  const k = klById(decodeURIComponent(ROUTE.sub || ""));
  if (!k) return pageHead("Klausur", { back: ["#/faecher", "Fächer"] }) + '<div class="card">' + emptyState("flag", "Klausur nicht gefunden", "Vielleicht wurde sie gelöscht.") + '</div>';
  if (!kmActive(k)) return pageHead(esc(k.fach), { back: ["#/faecher", "Fächer"] }) + '<div class="card">' + emptyState("check", "Klausur abgehakt", "Deine Vokabeln und dein Übungsstand bleiben erhalten." + (k.punkte == null ? " Sobald du sie zurückbekommst: Note eintragen." : ""), (k.punkte == null ? '<a class="btn primary sm" href="#/noten?neu=1">Note eintragen</a> ' : '') + '<a class="btn sm" href="#/dashboard">Zur Übersicht</a>') + '</div>';
  const tab = kmTab(k);
  if (tab !== "start") { const lbl = (kmTabs(k).find(t => t[0] === tab) || [, ""])[1];
    return netNotice() + '<a class="backlink" href="#/klausur/' + esc(k.id) + '">' + ICO.back + esc(k.fach) + '</a><h1 class="t-large km-subh">' + esc(lbl) + '</h1><div id="km_body">' + ({ videos: k2 => videoList(k2), vokabeln: kmVokabeln, spiele: kmSpiele, grammatik: kmGrammatik, schreiben: kmSchreiben, themen: kmThemen, checkliste: kmCheckliste }[tab])(k) + '</div>'; }
  return netNotice() + kmHead(k) + '<div id="km_body">' + ({ start: kmStart, videos: k2 => videoList(k2), vokabeln: kmVokabeln, spiele: kmSpiele, grammatik: kmGrammatik, schreiben: kmSchreiben, themen: kmThemen, checkliste: kmCheckliste }[tab])(k) + '</div>';
};
function kmHead(k) {
  const d = daysUntil(k.datum); const r = readinessOf(k);
  const std = (String(k.description || "").match(/\d\.–\d\. Stunde/) || [""])[0];
  return '<a class="backlink" href="#/faecher">' + ICO.back + 'Fächer</a><div class="km-hero"><div style="min-width:0"><div class="eyebrow"><span class="dot" style="background:' + fcol(k.fach) + ';margin-right:6px"></span>Klausur' + (k.nr ? " Nr. " + k.nr : "") + ' · ' + esc(fmtDL(k.datum)) + (k.uhrzeit ? " · " + esc(k.uhrzeit) : std ? " · " + std : "") + (k.raum ? " · " + esc(k.raum) : "") + '</div><h1 class="t-large">' + esc(k.fach) + '</h1><p class="t-callout">' + esc(klTitle(k)) + '</p>' +
    '<div class="km-acts"><button class="btn sm" id="km_edit">✏️ Bearbeiten</button><button class="btn sm" id="km_written">✓ Geschrieben</button></div></div>' +
    '<div class="km-days"><span class="num">' + d + '</span><small>' + (d === 0 ? "heute" : d === 1 ? "Tag" : "Tage") + '</small>' + (r.score != null ? '<small>' + r.score + ' % bereit</small>' : '') + '</div></div>';
}
function bindKlausur() {
  const k = klById(decodeURIComponent(ROUTE.sub || "")); if (!kmActive(k)) return;
  const q = id => document.getElementById(id);
  document.querySelectorAll("[data-kmgo]").forEach(b => b.onclick = () => kmAction(k, b.dataset.kmgo));
  ({ checkliste: () => bindKmCheckliste(k), schreiben: () => bindKmSchreiben(k), vokabeln: () => bindKmVokabeln(k), spiele: () => { document.querySelectorAll("[data-game]").forEach(b => b.onclick = () => startGame(b.dataset.game, "exam:" + k.id)); bindLessonCards(); } }[kmTab(k)] || (() => {}))();
  const lk = q("km_link"); if (lk) lk.onclick = () => kmLinkModal(k);
  const ed = q("km_edit"); if (ed) ed.onclick = () => editKLModal(k);
  if (kmTab(k) === "start" && !klCheck(k.id)) bindKmCheckliste(k);
  const wr = q("km_written"); if (wr) wr.onclick = async () => { if (!confirm(k.fach + "-Klausur abhaken? Sie verschwindet aus deinen Klausuren – bis du die Note einträgst, erinnert dich die Startseite daran.")) return; await markKlDone(k); toast("✓ " + k.fach + "-Klausur geschrieben – gut gemacht!"); location.hash = "#/klausur/" + k.id; route(); };
  bindGrammarGames("exam:" + k.id); bindVideos();
  document.querySelectorAll("[data-game]").forEach(b => b.onclick = () => startGame(b.dataset.game, "exam:" + k.id));
}
/** Klausur als geschrieben markieren (Datum muss nicht vorbei sein) */
async function markKlDone(k) { const all = Object.assign({}, setting("kl_geschrieben", {}) || {}); all[k.id] = todayISO(); await setSetting("kl_geschrieben", all); }
function kmAction(k, what) {
  const [kind, arg] = what.split(":");
  if (kind === "vocab") startTraining(kmVocabStart(k));
  else if (kind === "vok" && arg) startTraining(Object.assign(kmVocabStart(k), { vmix: arg }));
  else if (kind === "vok") vocabChooser(examVocab(k), daysUntil(k.datum), vmix => startTraining(Object.assign(kmVocabStart(k), { vmix })));
  else if (kind === "fehler") location.hash = "#/fehler?fach=" + encodeURIComponent(k.fach);
  else if (kind === "topic") startTraining({ mode: "topic", subtopic_id: arg, from: "klausur" });
  else if (kind === "mixed") startTraining({ mode: "mixed", exam_id: k.id, from: "klausur" });
  else if (kind === "mock") mockModal(k);
  else if (kind === "setup") topicAssistant(k);
  else if (kind === "lesson") startLesson("exam:" + k.id);
  else if (kind === "game") startGame(arg, "exam:" + k.id);
  else if (kind === "drill") location.hash = "#/drill";
  else if (kind === "mathe") location.hash = "#/mathe";
  else if (kind === "tab") location.hash = "#/klausur/" + k.id + "?tab=" + arg;
}

/* ---------- Überblick: was heute dran ist + Fortschritt ---------- */
function kmSteps(k) {
  const out = []; const words = examVocab(k);
  // 1. Video, das noch fehlt (erst verstehen, dann üben)
  const vids = videosFor(k).flatMap(s => s.videos); const seen = videoSeen(); const nextVid = vids.find(v => !seen[v.id]);
  if (nextVid) out.push({ go: "tab:videos", title: "Video: " + nextVid.t, sub: vids.filter(v => seen[v.id]).length + " von " + vids.length + " Videos gesehen", main: true });
  { const c = klCheck(k.id); const nx = c && c.items.find(i => (c.st || {})[i.nr] !== "ok");
    if (!c) out.push({ go: "tab:checkliste", title: "Checkliste anlegen 📷", sub: "Themenzettel fotografieren – die App baut Erklärungen und Heft-Aufgaben", main: !out.length });
    else if (nx) out.push({ go: "tab:checkliste", title: "Checkliste: " + nx.short, sub: c.items.filter(i => (c.st || {})[i.nr] === "ok").length + " von " + c.items.length + " Punkten „Kann ich“", main: !out.some(x => x.main) }); }
  if (words.length) {
    const d = dayStatus(words); const fresh = words.filter(Engine.isNew).length;
    out.push({ go: "vocab", title: "Vokabeln lernen", sub: d.due || fresh ? [d.due ? plural(d.due, "Wiederholung", "Wiederholungen") : "", fresh ? fresh + " noch neu" : ""].filter(Boolean).join(" · ") : "Alles wiederholt – freiwillig festigen", main: !!(d.due || fresh) });
    if (words.length >= 4) out.push({ go: "lesson", title: "Lektion (wie Duolingo)", sub: "Bilder, Paare, Lücken, Sätze bauen, Hören", main: false });
  } else if (KM_LANG.test(k.fach)) out.push({ go: "tab:vokabeln", title: "Vokabeln festlegen", sub: "Welche Sammlungen kommen in der Klausur dran?", main: true });
  if (!subsOfExam(k.id).length) out.push({ go: "setup", title: "Themen festlegen", sub: "Was kommt dran? Dann baut die App die Übungen." , main: !out.some(x => x.main) });
  else weakestSubs(k, 2).forEach(st => { const m = masteryOf(st.id).score; out.push({ go: "topic:" + st.id, title: st.title, sub: m == null ? "Noch nicht geübt" : m + " % sicher", main: false }); });
  const today = roadmapOf(k).find(s => s.day === 0);
  if (today && today.kind === "mock") out.push({ go: "mock", title: "Probeklausur schreiben", sub: today.sub, main: true });
  if (/Mathe/.test(k.fach)) { const cs = ckStatus(); const nx = MC.ITEMS.find(i => cs[i.nr] !== "ok" && i.keys.length); out.push({ go: "mathe", title: "Checkliste 1. Klausur 📐", sub: nx ? "Als Nächstes: " + nx.nr + " · " + nx.short : "Alles „Kann ich“ – jetzt Probe-Klausur", main: !out.some(x => x.main) }); }
  if (k.fach === "Französisch") out.push({ go: "drill", title: "Grammatik-Drill 👢", sub: "acheter/préférer/mettre, ce/cet, quel, beau – selbst schreiben, dann Probe-Arbeit mit Note", main: false });
  if (kmHasVocab(k) && hasFrench("exam:" + k.id)) out.push({ go: "tab:spiele", title: "Spiele", sub: "Artikel, Pronomen, Verb-Puzzle, Hören …", main: false });
  return out;
}
/** Kacheln „Such's dir aus“ – je nach Fach */
function kmTiles(k) {
  const words = examVocab(k); const c = klCheck(k.id); const vids = videosFor(k).flatMap(x => x.videos); const subs = subsOfExam(k.id);
  const T = (go, ico, t, sub) => ({ go, ico, t, sub });
  const out = [];
  if (words.length) out.push(T("vok", "🗂️", "Vokabeln", words.length + " Wörter · du wählst die Mischung"));
  else if (KM_LANG.test(k.fach)) out.push(T("tab:vokabeln", "🗂️", "Vokabeln festlegen", "Welche Sammlungen kommen dran?"));
  out.push(T("tab:checkliste", "✅", "Checkliste", c ? c.items.filter(i => (c.st || {})[i.nr] === "ok").length + " von " + c.items.length + " „Kann ich“" : "noch anlegen"));
  if (/Mathe/.test(k.fach)) out.push(T("mathe", "📐", "Mathe-Kurs", "Erklärungen + Übungen"));
  if (k.fach === "Französisch") out.push(T("drill", "👢", "Grammatik-Drill", "acheter, mettre, ce/cet …"), T("tab:grammatik", "📘", "Grammatik", "kurz erklärt"), T("tab:schreiben", "✍️", "Schreiben", "Texte mit Feedback"));
  if (words.length >= 4) out.push(T("lesson", "🦉", "Lektion", "wie Duolingo"));
  if (kmHasVocab(k) && words.length) out.push(T("tab:spiele", "🎮", "Spiele", "kurz zwischendurch"));
  if (vids.length) out.push(T("tab:videos", "▶️", "Videos", vids.filter(v => videoSeen()[v.id]).length + " von " + vids.length + " gesehen"));
  out.push(T("tab:themen", "🧩", "Themen & Übungen", subs.length ? plural(subs.length, "Thema", "Themen") : "festlegen"));
  if (subs.length) out.push(T("mock", "📝", "Probeklausur", "unter Zeitdruck"));
  const errs = typeof fehlerOf === "function" ? fehlerOf(k.fach) : []; if (errs.length) out.push(T("fehler", "📕", "Fehlerheft", errs.length + " Fehler üben"));
  return out;
}
/** Empfehlung für „Jetzt direkt lernen“ */
function kmRecommend(k) {
  const words = examVocab(k);
  const st = kmSteps(k).filter(s => s.go !== "tab:checkliste" && s.go !== "setup")[0];
  if (st) return st;
  if (words.length) { const r = vocabRecommend(vocabMixStats(words), daysUntil(k.datum)); if (r) return { go: "vok:" + r.kind, title: "Vokabeln · " + VMIX[r.kind][0], sub: r.why }; }
  return null;
}
function kmStart(k) {
  const words = examVocab(k); const subs = subsOfExam(k.id);
  const rec = kmRecommend(k);
  const now = rec ? '<div class="card km-now"><button class="btn primary lg wide" data-kmgo="' + esc(rec.go) + '">' + ICO.play + 'Jetzt direkt lernen</button><div class="km-now-r"><span class="km-rec">Empfohlen</span> <b>' + esc(rec.title) + '</b><span class="t-sub">' + esc(rec.sub || "") + '</span></div></div>' : '';
  const needCheck = !klCheck(k.id) && !isVocabTest(k);
  const ask = needCheck ? '<details class="km-ask"><summary><span class="km-ask-h">📋 Der Termin steht – jetzt die Checkliste</span><span class="t-sub">Themenzettel fotografieren oder Punkte eintippen – Claude baut Erklärungen, Heft-Aufgaben und Übungsfragen.</span><span class="btn sm primary km-ask-go">📷 Foto / ✏️ Eintippen</span></summary>' + kmCheckliste(k) + '</details>' : '';
  const tiles = '<h2 class="fa-sec">Oder such dir aus, was du lernen willst</h2><div class="km-tiles">' + kmTiles(k).map(t => '<button class="km-tile" data-kmgo="' + esc(t.go) + '"><span class="km-ti">' + t.ico + '</span><b>' + esc(t.t) + '</b><span class="t-sub">' + esc(t.sub) + '</span></button>').join("") + '</div>';
  const extrem = typeof isExtremExam === "function" && isExtremExam(k) ? extremEntry(k) : "";
  const voc = words.length ? '<div class="card"><h2>Vokabeln</h2>' + stageBar(words) + '</div>' : '';
  const th = subs.length ? '<div class="card"><h2>Themen</h2>' + subs.map(st => { const m = masteryOf(st.id).score; return '<div class="km-sub"><span>' + esc(st.title) + '</span><span class="t-sub">' + (m == null ? "neu" : m + " %") + '</span>' + progBar(m || 0, m == null ? "" : m >= 80 ? "g" : m >= 60 ? "" : "o") + '</div>'; }).join("") + '</div>' : '';
  return now + ask + tiles + extrem + (voc || th ? '<h2 class="fa-sec">Dein Stand</h2><div class="km-grid">' + voc + th + '</div>' : '') + (typeof fachExtras === "function" ? fachExtras(k.fach, k) : '');
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
  openModal("Vokabeln für die " + esc(k.fach) + "-Klausur", '<p class="hint">Was kommt in der Klausur dran? Nur diese Wörter übst du auf der Klausur-Seite. Dein Lernstand bleibt erhalten.</p>' +
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
  return drillCard() + testCard() + '<p class="hint" style="margin-top:0">Kurz erklärt, mit Beispielen – tippe auf ein Thema. „Jetzt üben“ startet das passende Spiel.</p>' + GRAMMAR_NOTES.map(n => grammarCard(n)).join("");
}

/* ---------- Themen, Probeklausur, Material ---------- */
function kmThemen(k) {
  const tps = topicsOfExam(k.id).filter(t => t.status !== "paused");
  const mathe = /Mathe/.test(k.fach) ? matheCard() + '<div class="game-grid" style="margin-bottom:var(--s5)">' + gameTile("graph", "exam:" + k.id) + '</div><p class="hint">Rechenaufgaben löst du auf Papier – dann Lösung zeigen und selbst bewerten.</p>' : '';
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
  return '<div class="card km-list"><h2>Deine Klausuren</h2><p class="hint" style="margin-top:0">Alles für eine Klausur an einem Ort.</p>' + ks.map(k => { const d = daysUntil(k.datum);
    return '<a class="km-ent" href="#/klausur/' + esc(k.id) + '"><span class="dot" style="background:' + fcol(k.fach) + '"></span><span class="km-t"><b>' + esc(k.fach) + '</b><span class="t-sub">' + esc(klTitle(k)) + '</span></span><span class="km-d">' + (d === 0 ? "heute" : d === 1 ? "morgen" : d + " Tage") + '</span><span class="chev">' + ICO.chev + '</span></a>'; }).join("") + '</div>';
}
