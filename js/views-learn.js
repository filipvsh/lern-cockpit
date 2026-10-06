/* =====================================================================
   LERN-COCKPIT · LERNPLAN · KI · FORTSCHRITT · EINSTELLUNGEN
   ===================================================================== */
const PRIO_LABEL = { 1: "Niedrig", 2: "Normal", 3: "Hoch" };
const DIFF_LABEL = { 1: "Leicht", 2: "Mittel", 3: "Schwer" };
const TYPE_ICON = { multiple_choice: "check", free_text: "doc", translation: "swap", matching: "lernplan", short_writing: "pen" };

/* =====================================================================
   LERNPLAN · Übersicht
   ===================================================================== */
let LP_TAB = "up"; const LP_OPEN = new Set();
function readinessLine(k) {
  const r = readinessOf(k);
  if (r.test) return !r.total ? '<span class="t-sub" style="color:var(--orange)">Noch keine Vokabeln eingetragen.</span>' : progBar(r.score || 0) + '<span class="t-sub">' + (r.score == null ? r.total + " Vokabeln · noch nicht geübt" : "erwartet " + r.score + " % im Test · " + r.secure + " von " + r.total + " sitzen") + '</span>';
  if (!r.total) return '<span class="t-sub" style="color:var(--orange)">Noch keine Unterthemen – damit startet der Lernplan.</span>';
  if (r.score == null) return '<span class="t-sub">' + plural(r.total, "Bereich", "Bereiche") + ' · noch nicht genug Lernaktivität für eine Einschätzung</span>';
  return progBar(r.score) + '<span class="t-sub">' + r.score + ' % vorbereitet · ' + r.withData + ' von ' + r.total + ' geübt</span>';
}
function planCard(k) {
  const d = daysUntil(k.datum); const tps = topicsOfExam(k.id); const subs = subsOfExam(k.id);
  return '<a class="card link plan-card" href="#/lernplan/' + esc(k.id) + '"><div style="min-width:0"><div class="eyebrow"><span class="dot" style="background:' + fcol(k.fach) + ';margin-right:6px"></span>' + esc(k.fach) + (isVocabTest(k) ? " · Vokabeltest" : k.nr ? " · Klausur " + k.nr : "") + (LAUFBAHN[k.fach] && LAUFBAHN[k.fach].abi ? " · Abiturfach" : "") + '</div><h3>' + esc(isVocabTest(k) ? vtName(k) : klTitle(k)) + '</h3><div class="t-sub">' + esc(fmtDL(k.datum)) + (k.uhrzeit ? " · " + esc(k.uhrzeit) : "") + (k.raum ? " · Raum " + esc(k.raum) : "") + (tps.length ? " · " + plural(tps.length, "Thema", "Themen") : "") + '</div>' + (subs.length ? '<div class="subchips">' + subs.slice(0, 7).map(s => { const m = masteryOf(s.id).score; return '<span class="subchip' + (m != null && m >= 80 ? " done" : "") + '"><i style="background:' + (m == null ? "var(--text-3)" : m >= 80 ? "var(--green)" : m >= 60 ? "var(--accent)" : "var(--orange)") + '"></i>' + esc(s.title) + (m != null ? " " + m + " %" : "") + '</span>'; }).join("") + (subs.length > 7 ? '<span class="subchip">+' + (subs.length - 7) + '</span>' : '') + '</div>' : '') + '</div><div class="days' + (d <= 7 ? " soon" : "") + '"><div class="num">' + d + '</div><small>' + (d === 1 ? "Tag" : "Tage") + '</small></div><div class="pc-foot">' + readinessLine(k) + '</div></a>';
}
V.lernplan = () => {
  if (ROUTE.sub) return lpDetail();
  const up = upcomingKL(), past = pastKL(); const hj = currentHJ();
  const missing = Object.keys(LAUFBAHN).filter(f => isSchriftlich(f, hj)).filter(f => !up.some(k => k.fach === f && !isVocabTest(k)));
  const head = pageHead("Lernplan", { sub: "Prüfungen, Themen und Unterthemen – und wie gut du jeweils vorbereitet bist.", actions: '<button class="btn" id="lp_vt">' + ICO.plus + 'Vokabeltest</button><button class="btn primary" id="lp_new">' + ICO.plus + 'Neue Prüfung</button>' });
  const seg = '<div class="seg" style="margin-bottom:var(--s5)"><button class="' + (LP_TAB === "up" ? "on" : "") + '" data-lptab="up">Anstehend<b>' + up.length + '</b></button><button class="' + (LP_TAB === "past" ? "on" : "") + '" data-lptab="past">Geschrieben<b>' + past.length + '</b></button></div>';
  let body;
  if (!engineReady()) body = setupCard();
  else if (LP_TAB === "up") body = (up.length ? '<div class="stack">' + up.map(planCard).join("") + '</div>' : '<div class="card">' + emptyState("flag", "Keine Prüfung geplant", "Trag die nächste ein, sobald der Klausurplan hängt.", '<button class="btn primary sm" data-lpnew="">Prüfung eintragen</button>') + '</div>') +
    (missing.length ? '<div class="section">' + sectionHead("Noch ohne Termin", '<span class="sub">laut Laufbahn ' + hj + '</span>') + '<div class="list">' + missing.map(f => '<button class="li tap" data-lpnew="' + esc(f) + '" style="width:100%;border:none;background:none;font:inherit;text-align:left"><span class="dot" style="background:' + fcol(f) + '"></span><div class="li-main"><div class="li-title">' + esc(f) + '</div></div><span class="li-trail" style="color:var(--accent)">Termin eintragen</span></button>').join("") + '</div></div>' : '');
  else body = past.length ? '<div class="list">' + past.map(k => '<a class="li" href="#/lernplan/' + esc(k.id) + '">' + (k.punkte != null ? '<span class="pt ' + ptClass(k.punkte) + '">' + k.punkte + '</span>' : '<span class="pt n">—</span>') + '<div class="li-main"><div class="li-title">' + esc(k.fach) + ' · ' + esc(klTitle(k)) + '</div><div class="li-sub">' + esc(fmtD(k.datum)) + (k.punkte != null ? " · Note " + PT_NOTE[k.punkte] : " · Ergebnis eintragen") + '</div></div><span class="chev">' + ICO.chev + '</span></a>').join("") + '</div>' : '<div class="card">' + emptyState("doc", "Noch nichts geschrieben", "Hier landen deine Prüfungen mit Ergebnis.") + '</div>';
  return netNotice() + dbBanner() + head + seg + body;
};
function bindLernplan() {
  if (ROUTE.sub) return bindLpDetail();
  document.querySelectorAll("[data-lptab]").forEach(b => b.onclick = () => { LP_TAB = b.dataset.lptab; route(); });
  const nb = document.getElementById("lp_new"); if (nb) nb.onclick = () => newKLModal("");
  const vt = document.getElementById("lp_vt"); if (vt) vt.onclick = () => testModal();
  document.querySelectorAll("[data-lpnew]").forEach(b => b.onclick = () => newKLModal(b.dataset.lpnew));
}
function newKLModal(fach) {
  fach = fach || lsGet("lc_kprefill", "") || "Deutsch";
  openModal("Neue Prüfung", '<div class="form"><div class="form c2"><label class="fld">Fach<select id="k_fach">' + fachOpts(fach) + '</select></label><label class="fld">Nr.<input id="k_nr" type="number" min="1" max="4" value="1"></label></div><label class="fld">Thema der Prüfung<input id="k_thema" placeholder="z. B. Short Story Writing"></label><div class="form c3"><label class="fld">Datum<input id="k_datum" type="date"></label><label class="fld">Uhrzeit<input id="k_zeit" type="time"></label><label class="fld">Raum<input id="k_raum" placeholder="B11"></label></div><label class="fld">Beschreibung (optional)<input id="k_desc" placeholder="z. B. Analyse + eigener Text"></label></div>',
    '<button class="btn" id="k_cancel">Abbrechen</button><button class="btn primary" id="k_add">Speichern</button>', () => {
      const q = id => document.getElementById(id); q("k_cancel").onclick = closeModal;
      q("k_fach").onchange = () => lsSet("lc_kprefill", q("k_fach").value);
      q("k_add").onclick = async () => {
        const dt = val("k_datum"); if (!dt) { toast("Bitte Datum wählen", true); return; }
        const fa = val("k_fach"); const nr = +val("k_nr") || 1; const th = val("k_thema"); const btn = q("k_add"); btn.classList.add("loading");
        const base = { fach: fa, thema: th || ("Klausur Nr. " + nr + " (" + (KURSE[fa] || fa) + (LEHRER[fa] ? ", " + LEHRER[fa] : "") + ")"), datum: dt, prep: "Nicht begonnen" };
        const ext = { nr, kurs: KURSE[fa] || null, lehrer: LEHRER[fa] || null, uhrzeit: val("k_zeit") || null, raum: val("k_raum") || null, halbjahr: hjOf(dt), dauer: 90 };
        if (engineReady()) Object.assign(ext, { description: val("k_desc") || null, subject_id: subjectId(fa), topics_migrated: true });
        try {
          let r; try { r = await sbInsert("klausuren", { ...base, ...ext }); } catch (e) { if (e.network) throw e; r = await sbInsert("klausuren", base); }
          const k = normKL({ ...r, ...ext }); k.description = ext.description || ""; STATE.kl.push(k);
          if (engineReady() && th) await dbInsert("topics", { title: th, exam_id: k.id, subject_id: subjectId(fa), priority: 2, status: "active" });
          closeModal(); toast("Prüfung gespeichert"); location.hash = "#/lernplan/" + k.id;
        } catch (e) { btn.classList.remove("loading"); toast(e.network ? "Keine Verbindung – die Prüfung wurde nicht gespeichert." : "Speichern fehlgeschlagen: " + e.message, true); }
      };
    });
}

/* =====================================================================
   LERNPLAN · Prüfung (Ebene 1 Thema → 2 Unterthema → 3 Übung)
   ===================================================================== */
function exerciseRow(ex) {
  const r = lastExerciseResult(ex.id);
  return '<div class="exrow"><span class="ico">' + ICO[TYPE_ICON[ex.type] || "doc"] + '</span><div class="li-main"><div class="li-title">' + esc(String(ex.question).slice(0, 140)) + '</div><div class="li-sub">' + esc(TYPE_NAMES[ex.type]) + ' · ' + DIFF_LABEL[ex.difficulty] + (ex.source === "ai" ? " · KI" : "") + (r != null ? " · zuletzt " + Math.round(r * 100) + " %" : " · noch nicht bearbeitet") + '</div></div><button class="iconbtn edit" data-exedit="' + esc(ex.id) + '" aria-label="Bearbeiten">' + ICO.edit + '</button><button class="iconbtn" data-exdel="' + esc(ex.id) + '" aria-label="Löschen">' + ICO.trash + '</button></div>';
}
function subBlock(st, i) {
  const m = masteryOf(st.id); const exs = exercisesOf(st.id); const mist = recentMistakes(st.id, 3);
  return '<details class="sub-it" data-sid="' + esc(st.id) + '"' + (LP_OPEN.has(st.id) ? " open" : "") + '><summary><span class="idx">' + two(i + 1) + '</span><span class="nm">' + esc(st.title) + (st.difficulty !== 2 ? ' <span class="pill">' + DIFF_LABEL[st.difficulty] + '</span>' : '') + '</span><span class="st">' + masteryBadge(m.score) + '<span class="tg">' + ICO.chev + '</span></span></summary><div class="ex">' +
    '<div class="mastery-why"><b>' + (m.score == null ? "Noch kein Lernstand" : "Lernstand " + m.score + " %") + '</b> · ' + plural(m.attempts, "Übung", "Übungen") + ' · zuletzt ' + agoText(m.daysSince) + (m.recentErrors ? ' · ' + plural(m.recentErrors, "Fehler", "Fehler") + ' in 14 Tagen' : '') + '<div class="t-cap">' + esc(m.explanation.join(" · ")) + '</div>' + (mist.length ? '<div class="subchips">' + mist.map(x => '<span class="subchip"><i style="background:var(--orange)"></i>' + esc(x) + '</span>').join("") + '</div>' : '') + '</div>' +
    '<div class="ex-label">Übungen</div><div class="exlist">' + (exs.length ? exs.map(exerciseRow).join("") : '<div class="hint">Noch keine eigenen Übungen – der Trainer nutzt Übungsvorlagen. Lege eigene an oder lass die KI welche erstellen.</div>') + '</div>' +
    '<div class="ex-row"><button class="ex-btn primary-ex" data-practice="' + esc(st.id) + '">' + ICO.play + 'Üben</button><button class="ex-btn" data-exnew="' + esc(st.id) + '">' + ICO.plus + 'Übung</button><button class="ex-btn" data-exai="' + esc(st.id) + '">' + ICO.ki + 'Übung erzeugen</button><a class="ex-btn" href="#/ki?sub=' + esc(st.id) + '&mode=erklaeren">' + ICO.bulb + 'Erklären lassen</a></div>' +
    '<div class="ex-tools"><button class="btn plain sm" data-subedit="' + esc(st.id) + '">Bearbeiten</button><button class="btn plain sm" data-subdel="' + esc(st.id) + '" style="color:var(--red)">Entfernen</button></div></div></details>';
}
function topicBlock(t) {
  const subs = subsOfTopic(t.id); const ms = subs.map(s => masteryOf(s.id).score).filter(x => x != null);
  const avg = ms.length ? Math.round(subs.reduce((a, s) => a + (masteryOf(s.id).score || 0), 0) / subs.length) : null;
  return '<div class="topic"><div class="topic-h"><div style="min-width:0"><div class="level">Thema' + (t.status !== "active" ? " · " + (t.status === "done" ? "abgeschlossen" : "pausiert") : "") + '</div><h3>' + esc(t.title) + '</h3>' + (t.description ? '<div class="t-sub">' + esc(t.description) + '</div>' : '') + '</div><div class="topic-meta"><span class="pill' + (t.priority === 3 ? " p-accent" : "") + '">Priorität ' + PRIO_LABEL[t.priority] + '</span>' + (avg != null ? '<span class="t-sub">Ø ' + avg + ' %</span>' : '') + '<button class="iconbtn edit" data-tpedit="' + esc(t.id) + '" aria-label="Thema bearbeiten">' + ICO.edit + '</button></div></div>' +
    '<div class="subs">' + subs.map(subBlock).join("") + '<div class="sub-add"><input data-subadd="' + esc(t.id) + '" placeholder="Unterthema hinzufügen …" maxlength="160"><button class="btn sm" data-subaddbtn="' + esc(t.id) + '">Hinzufügen</button></div></div></div>';
}
function lpDetail() {
  const k = klById(ROUTE.sub);
  if (!k) return pageHead("Lernplan", { back: ["#/lernplan", "Lernplan"] }) + '<div class="card">' + emptyState("doc", "Prüfung nicht gefunden", "Vielleicht wurde sie gelöscht.", '<a class="btn sm" href="#/lernplan">Zur Übersicht</a>') + '</div>';
  const loc = lsGet("lc_kl_" + k.id, null); if (loc) Object.assign(k, loc);
  if (isVocabTest(k) && engineReady()) return testDetail(k);
  const d = daysUntil(k.datum), past = d < 0 || k.punkte != null; const lb = LAUFBAHN[k.fach] || {};
  const r = engineReady() ? readinessOf(k) : { score: null, total: 0 };
  const tps = engineReady() ? topicsOfExam(k.id) : [];
  const top = engineReady() ? priorities().find(p => p.exam && p.exam.id === k.id) : null;
  const head = '<a class="backlink" href="#/lernplan">' + ICO.back + 'Lernplan</a><div class="topic-head"><div style="min-width:0"><div class="eyebrow"><span class="dot" style="background:' + fcol(k.fach) + ';margin-right:6px"></span>' + esc(k.fach) + (k.nr ? " · Klausur " + k.nr : "") + (k.lehrer ? " · " + esc(k.lehrer) : "") + (lb.abi ? " · Abiturfach " + lb.abi : "") + '</div><h1 class="t-large">' + esc(klTitle(k)) + '</h1><div class="meta">' + esc(fmtDL(k.datum)) + (k.uhrzeit ? " · " + esc(k.uhrzeit) + (k.dauer ? " (" + k.dauer + " Min.)" : "") : "") + (k.raum ? " · Raum " + esc(k.raum) : "") + '</div>' + (k.description ? '<div class="meta">' + esc(k.description) + '</div>' : '') +
    '<div class="ph-actions">' + (top && !past ? '<button class="btn primary" id="kd_train">' + ICO.play + 'Training starten</button>' : '') + (!past && engineReady() ? '<button class="btn" id="kd_mock">' + ICO.clock + 'Probeklausur</button>' : '') + (!past && engineReady() ? '<button class="btn" id="kd_topics">' + ICO.plus + 'Themen festlegen</button>' : '') + '<button class="btn" id="kd_edit">Bearbeiten</button>' + (k.cal_event_id ? '' : '<a class="btn plain" href="' + gcalLink(k) + '" target="_blank" rel="noopener">In Kalender</a>') + '</div></div>' +
    '<div class="topic-stats">' + (past ? '<div class="stat"><div class="num">' + (k.punkte != null ? k.punkte : "—") + '</div><small>Punkte</small></div>' : '<div class="stat"><div class="num">' + d + '</div><small>' + (d === 1 ? "Tag" : "Tage") + ' bis zur Prüfung</small></div>' + (r.score != null ? '<div class="stat">' + ring(r.score / 100, 88, 7, r.score + "%", "bereit") + '</div>' : '')) + '</div></div>' +
    (!past && engineReady() && r.total && r.score == null ? '<div class="notice"><span class="dot" style="background:var(--text-3)"></span><span>Noch nicht genug Lernaktivität für eine zuverlässige Einschätzung. Übe ein Unterthema – dann siehst du hier deine Prüfungsbereitschaft.</span></div>' : '') +
    (top && !past ? '<div class="notice"><span class="dot" style="background:var(--accent)"></span><span><b>Als Nächstes:</b> ' + esc(top.subtopic.title) + ' – ' + esc(top.reasons.join(" · ")) + '</span></div>' : '');
  const topicsHtml = !engineReady() ? setupCard() : '<div class="section" style="margin-top:0">' + sectionHead("Themen", '<button class="shl" id="tp_new">' + ICO.plus.replace("<svg", '<svg style="width:14px;height:14px;display:inline;vertical-align:-2px"') + ' Thema</button>') +
    (tps.length ? '<div class="stack">' + tps.map(topicBlock).join("") + '</div>' : '<div class="card">' + emptyState("lernplan", "Noch kein Thema", "Ein Thema ist ein Lernbereich – z. B. „" + esc(klTitle(k)) + "“. Darunter legst du Unterthemen an, darunter Übungen.", '<button class="btn primary sm" id="tp_first">Themen festlegen</button>') + '</div>') + '</div>';
  // Fahrplan & Vorbereitung (bestehende Funktionen)
  // Fahrplan: fester Ablauf bis zur Klausur (Engine.examRoadmap); ältere Prüfungen ohne Lern-Engine: bisheriger Plan
  const plan = engineReady() && !past ? roadmapOf(k).map(s => ({ date: addDays(todayISO(), s.day), label: s.label, sub: s.sub, state: s.day === 0 ? "now" : "future" })) : klPlan(k);
  const today = plan.find(s => s.state === "now");
  const fahr = '<div>' + sectionHead("Fahrplan", today ? '<span class="sub" style="color:var(--accent)">Heute dran</span>' : '') + '<div class="card"><div class="tl">' + plan.map(s => '<div class="tls ' + s.state + '"><div class="d">' + (s.state === "now" ? "Heute · " : "") + esc(fmtD(s.date)) + '</div><div class="x">' + esc(s.label) + '</div>' + (s.sub && s.state !== "past" ? '<div class="y">' + esc(s.sub) + '</div>' : '') + '</div>').join("") + '</div></div></div>';
  const linked = STATE.hw.filter(h => h.klausur_id === k.id);
  const sessMin = Math.round(ES.sessions.filter(s => String(s.exam_id) === String(k.id)).reduce((a, s) => a + (s.active_seconds || 0), 0) / 60) + STATE.log.filter(l => l.art === "fokus" && l.ref === k.id).reduce((s, l) => s + (l.minuten || 0), 0);
  const nEx = ES.events.filter(e => String(e.exam_id) === String(k.id) && e.result != null).length;
  const tasks = '<div class="card"><h2>Aufgaben zur Prüfung <span class="count">' + linked.filter(h => !h.done).length + '</span></h2>' + (linked.length ? linked.sort(sortHW).map(h => hwRow(h, { full: true })).join("") : '<div class="hint">Übungsblätter, Zusammenfassung, Altklausur – alles, was du bis dahin erledigen willst.</div>') + '<div class="inline-add" style="grid-template-columns:1fr 150px auto"><input id="kt_txt" placeholder="Neue Aufgabe …"><input id="kt_due" type="date" value="' + esc(d > 1 ? addDays(k.datum, -1) : todayISO()) + '"><button class="btn" id="kt_add">' + ICO.plus + '</button></div></div>';
  const result = '<div class="card"><h2>Ergebnis</h2>' + (k.punkte != null ? '<div style="display:flex;align-items:center;gap:var(--s5)"><div><div class="pbig">' + k.punkte + '</div><div class="pnote">Punkte · Note ' + PT_NOTE[k.punkte] + '</div></div><button class="btn sm" id="kd_result" style="margin-left:auto">Ändern</button></div>' : '<div class="hint">' + (d < 0 ? "Sobald du die Prüfung zurück hast, trag die Punkte ein. Sie fließen in deine Noten." : "Wird nach der Prüfung eingetragen (0–15 Punkte).") + '</div>' + (d < 0 ? '<button class="btn primary sm" id="kd_result" style="margin-top:var(--s3)">Punkte eintragen</button>' : '')) + '</div>';
  const notes = '<div class="card"><h2>Notizen <span class="t-sub" id="kn_state" style="font-weight:400"></span></h2><textarea id="kn_txt" placeholder="Hinweise der Lehrkraft, erlaubte Hilfsmittel, Schwerpunkte …">' + esc(k.notizen) + '</textarea></div>';
  const mat = '<div class="card"><h2>Material</h2>' + (k.material.length ? k.material.map((m, i) => '<div class="matl"><a href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(m.titel || m.url) + '</a><span class="u">' + esc(String(m.url).replace(/^https?:\/\//, "")) + '</span><button class="iconbtn" data-delmat="' + i + '" aria-label="Entfernen">' + ICO.x + '</button></div>').join("") : '<div class="hint">Logineo-Ordner, Übungsseiten, Erklärvideos – alles an einem Ort.</div>') + '<div class="inline-add" style="grid-template-columns:1fr 1fr auto"><input id="mt_t" placeholder="Titel"><input id="mt_u" placeholder="https://…"><button class="btn" id="mt_add">' + ICO.plus + '</button></div></div>';
  const mitList = k.mitnehmen.length ? k.mitnehmen : (MITNEHMEN_DEFAULT[k.fach] || ["Stifte", "Wasser"]).map(t => ({ id: uid(), text: t, done: false }));
  const mit = '<div class="card"><h2>Mitnehmen</h2>' + mitList.map((t, i) => '<div class="thema' + (t.done ? " done" : "") + '"><button class="check' + (t.done ? " done" : "") + '" data-mit="' + i + '">' + (t.done ? CHECK_SVG : "") + '</button><span class="tx">' + esc(t.text) + '</span><button class="iconbtn" data-delmit="' + i + '">' + ICO.x + '</button></div>').join("") + '<div class="inline-add"><input id="mi_txt" placeholder="Noch etwas …"><button class="btn" id="mi_add">' + ICO.plus + '</button></div></div>';
  const isLang = /Französisch|Englisch/.test(k.fach);
  const vok = isLang && engineReady() ? '<div class="card"><h2>Vokabeln zur Prüfung</h2><div class="hint">Welche Sammlungen kommen dran? Sie fließen in die Prüfungsbereitschaft und in den Prüfungsmodus ein.</div><div class="trlist" style="margin-top:var(--s3)">' + ES.collections.map(c => '<label class="trck"><input type="checkbox" class="kvl" value="' + esc(c.name) + '"' + (k.vokabel_lektionen.map(x => String(x).toLowerCase()).includes(c.name.toLowerCase()) ? ' checked' : '') + '> ' + esc(c.name) + '</label>').join("") + '</div><div style="display:flex;gap:var(--s2);margin-top:var(--s4);flex-wrap:wrap"><button class="btn sm" id="kv_save">Speichern</button></div></div>' : '';
  const time = '<div class="card"><h2>Lernzeit</h2><div class="strow"><div class="stbox"><div class="n">' + sessMin + '</div><div class="l">Minuten</div></div><div class="stbox"><div class="n">' + nEx + '</div><div class="l">Übungen</div></div><div class="stbox"><div class="n">' + linked.filter(h => h.done).length + '</div><div class="l">Aufgaben erledigt</div></div></div></div>';
  const danger = '<div style="text-align:center;padding:var(--s3)"><button class="btn plain sm" id="kd_del" style="color:var(--red)">Prüfung löschen</button></div>';
  return netNotice() + head + '<div class="grid main-aside"><div style="min-width:0">' + topicsHtml + '<div class="section"><div class="sh"><h2>Vorbereitung</h2></div><div class="stack">' + tasks + notes + mat + '</div></div></div><div class="stack" style="min-width:0">' + fahr + result + mit + vok + time + danger + '</div></div>';
}
function bindLpDetail() {
  const k = klById(ROUTE.sub); if (!k) return; const q = id => document.getElementById(id);
  if (isVocabTest(k) && engineReady()) return bindTestDetail(k);
  document.querySelectorAll("details.sub-it").forEach(d => d.ontoggle = () => { if (d.open) LP_OPEN.add(d.dataset.sid); else LP_OPEN.delete(d.dataset.sid); });
  q("kd_edit").onclick = () => editKLModal(k);
  const tr = q("kd_train"); if (tr) tr.onclick = () => { const p = priorities().find(x => x.exam && x.exam.id === k.id); if (p) startTraining({ mode: "topic", subtopic_id: p.subtopic.id }); };
  const xm = q("kd_mock"); if (xm) xm.onclick = () => mockModal(k);
  const ktp = q("kd_topics"); if (ktp) ktp.onclick = () => topicAssistant(k);
  const res = q("kd_result"); if (res) res.onclick = () => resultModal(k);
  q("kd_del").onclick = async () => { if (!confirm("Prüfung wirklich löschen? Themen, Unterthemen, Übungen und Notizen gehen verloren. Lernereignisse bleiben für deine Statistik erhalten.")) return; try { await sbDelete("klausuren", k.id); STATE.kl = STATE.kl.filter(x => x.id !== k.id); const tids = ES.topics.filter(t => t.exam_id === k.id).map(t => t.id); ES.topics = ES.topics.filter(t => !tids.includes(t.id)); const sids = ES.subtopics.filter(s => tids.includes(s.topic_id)).map(s => s.id); ES.subtopics = ES.subtopics.filter(s => !sids.includes(s.id)); ES.exercises = ES.exercises.filter(e => !sids.includes(e.subtopic_id)); bump(); location.hash = "#/lernplan"; toast("Gelöscht"); } catch (e) { toast(e.network ? "Keine Verbindung – nicht gelöscht." : "Löschen fehlgeschlagen: " + e.message, true); } };
  // Themen
  const tf = q("tp_first"); if (tf) tf.onclick = () => topicAssistant(k);
  const tn = q("tp_new"); if (tn) tn.onclick = () => topicModal(null, k);
  document.querySelectorAll("[data-tpedit]").forEach(b => b.onclick = () => topicModal(topicById(b.dataset.tpedit), k));
  // Unterthemen
  const addSub = async tid => { const inp = document.querySelector('[data-subadd="' + tid + '"]'); const title = inp.value.trim(); if (!title) { inp.focus(); return; } const n = subsOfTopic(tid).length; await dbInsert("subtopics", { topic_id: tid, title, difficulty: 2, sort: n }); route(); const ni = document.querySelector('[data-subadd="' + tid + '"]'); if (ni) ni.focus(); };
  document.querySelectorAll("[data-subaddbtn]").forEach(b => b.onclick = () => addSub(b.dataset.subaddbtn));
  document.querySelectorAll("[data-subadd]").forEach(i => i.onkeydown = e => { if (e.key === "Enter") addSub(i.dataset.subadd); });
  document.querySelectorAll("[data-subedit]").forEach(b => b.onclick = () => subtopicModal(subById(b.dataset.subedit)));
  document.querySelectorAll("[data-subdel]").forEach(b => b.onclick = async () => { const st = subById(b.dataset.subdel); if (!confirm("Unterthema „" + st.title + "“ mit " + plural(exercisesOf(st.id).length, "Übung", "Übungen") + " entfernen?")) return; await dbDelete("subtopics", st.id); ES.exercises = ES.exercises.filter(e => e.subtopic_id !== st.id); bump(); route(); });
  document.querySelectorAll("[data-practice]").forEach(b => b.onclick = () => startTraining({ mode: "topic", subtopic_id: b.dataset.practice }));
  // Übungen
  document.querySelectorAll("[data-exnew]").forEach(b => b.onclick = () => exerciseModal(null, b.dataset.exnew));
  document.querySelectorAll("[data-exedit]").forEach(b => b.onclick = () => { const ex = exById(b.dataset.exedit); exerciseModal(ex, ex.subtopic_id); });
  document.querySelectorAll("[data-exdel]").forEach(b => b.onclick = async () => { if (!confirm("Übung löschen?")) return; await dbDelete("exercises", b.dataset.exdel); route(); });
  document.querySelectorAll("[data-exai]").forEach(b => b.onclick = async () => {
    const st = subById(b.dataset.exai); b.classList.add("loading");
    try { const ex = await kiGenerateExercise(st); LP_OPEN.add(st.id); route(); toast("Neue Übung: " + TYPE_NAMES[ex.type]); }
    catch (e) { b.classList.remove("loading"); toast(AI.errorText(e), true); }
  });
  // Vorbereitung (bestehende Funktionen)
  const addKT = async () => { const t = val("kt_txt"); if (!t) return; const obj = { aufgabe: t, fach: k.fach, faellig: val("kt_due") || null, dauer: 30, prio: "Mittel", done: false, typ: "hausaufgabe", klausur_id: k.id }; try { const r = await sbInsert("hausaufgaben", obj); STATE.hw.push(normHW({ ...r, typ: "hausaufgabe", klausur_id: k.id })); toast("Aufgabe angelegt"); route(); } catch (e) { toast(e.network ? "Keine Verbindung – nicht gespeichert." : "Speichern fehlgeschlagen: " + e.message, true); } };
  q("kt_add").onclick = addKT; q("kt_txt").onkeydown = e => { if (e.key === "Enter") addKT(); };
  const kn = q("kn_txt"); const st = q("kn_state"); kn.oninput = debounce(async () => { st.textContent = "speichert …"; await saveKL(k, { notizen: kn.value }); st.textContent = "gespeichert"; setTimeout(() => { st.textContent = ""; }, 1500); }, 700);
  q("mt_add").onclick = async () => { const u = val("mt_u"); if (!u) return; const url = /^https?:\/\//.test(u) ? u : "https://" + u; await saveKL(k, { material: k.material.concat([{ titel: val("mt_t") || url.replace(/^https?:\/\//, "").slice(0, 40), url }]) }); route(); };
  document.querySelectorAll("[data-delmat]").forEach(b => b.onclick = async () => { const m = k.material.slice(); m.splice(+b.dataset.delmat, 1); await saveKL(k, { material: m }); route(); });
  const mitList = () => k.mitnehmen.length ? k.mitnehmen : (MITNEHMEN_DEFAULT[k.fach] || ["Stifte", "Wasser"]).map(t => ({ id: uid(), text: t, done: false }));
  document.querySelectorAll("[data-mit]").forEach(b => b.onclick = async () => { const items = mitList().map(t => ({ ...t })); const i = +b.dataset.mit; if (items[i]) items[i].done = !items[i].done; await saveKL(k, { mitnehmen: items }); route(); });
  document.querySelectorAll("[data-delmit]").forEach(b => b.onclick = async () => { const items = mitList().filter((t, i) => i !== +b.dataset.delmit); await saveKL(k, { mitnehmen: items.length ? items : [{ id: uid(), text: "—", done: false }] }); route(); });
  const miAdd = async () => { const t = val("mi_txt"); if (!t) return; await saveKL(k, { mitnehmen: mitList().concat([{ id: uid(), text: t, done: false }]) }); route(); }; q("mi_add").onclick = miAdd; q("mi_txt").onkeydown = e => { if (e.key === "Enter") miAdd(); };
  const kv = q("kv_save"); if (kv) kv.onclick = async () => { await saveKL(k, { vokabel_lektionen: [...document.querySelectorAll(".kvl:checked")].map(x => x.value) }); bump(); toast("Gespeichert"); route(); };
}
function topicModal(t, k) {
  const isNew = !t; t = t || { title: "", description: "", priority: 2, status: "active" };
  openModal(isNew ? "Neues Thema" : "Thema bearbeiten", '<div class="form"><label class="fld">Titel<input id="t_title" value="' + esc(t.title) + '" placeholder="z. B. Short Story Writing" maxlength="160"></label><label class="fld">Beschreibung (optional)<input id="t_desc" value="' + esc(t.description || "") + '"></label><div class="form c2"><label class="fld">Priorität<select id="t_prio">' + [3, 2, 1].map(p => '<option value="' + p + '"' + (t.priority === p ? " selected" : "") + '>' + PRIO_LABEL[p] + '</option>').join("") + '</select></label><label class="fld">Status<select id="t_status"><option value="active"' + (t.status === "active" ? " selected" : "") + '>Aktiv</option><option value="paused"' + (t.status === "paused" ? " selected" : "") + '>Pausiert</option><option value="done"' + (t.status === "done" ? " selected" : "") + '>Abgeschlossen</option></select></label></div><p class="hint">Die Priorität gewichtet das Thema in Lernplan und Prüfungsbereitschaft. Pausierte und abgeschlossene Themen schlägt der Plan nicht mehr vor.</p></div>',
    (isNew ? '' : '<button class="btn danger left" id="t_del">Löschen</button>') + '<button class="btn" id="t_cancel">Abbrechen</button><button class="btn primary" id="t_save">Speichern</button>', () => {
      const q = id => document.getElementById(id); q("t_cancel").onclick = closeModal;
      q("t_save").onclick = async () => { const title = val("t_title"); if (!title) { q("t_title").focus(); return; } const row = { title, description: val("t_desc") || null, priority: +val("t_prio"), status: val("t_status") };
        if (isNew) await dbInsert("topics", Object.assign(row, { exam_id: k.id, subject_id: subjectId(k.fach), sort: topicsOfExam(k.id).length })); else await dbPatch("topics", t.id, row); closeModal(); route(); };
      const d = q("t_del"); if (d) d.onclick = async () => { if (!confirm("Thema „" + t.title + "“ mit allen Unterthemen und Übungen löschen?")) return; await dbDelete("topics", t.id); const sids = ES.subtopics.filter(s => s.topic_id === t.id).map(s => s.id); ES.subtopics = ES.subtopics.filter(s => s.topic_id !== t.id); ES.exercises = ES.exercises.filter(e => !sids.includes(e.subtopic_id)); bump(); closeModal(); route(); };
    });
}
function subtopicModal(st) {
  openModal("Unterthema bearbeiten", '<div class="form"><label class="fld">Titel<input id="s_title" value="' + esc(st.title) + '" maxlength="160"></label><label class="fld">Beschreibung (optional)<input id="s_desc" value="' + esc(st.description || "") + '" placeholder="Worauf kommt es an?"></label><label class="fld">Schwierigkeit<select id="s_diff">' + [1, 2, 3].map(x => '<option value="' + x + '"' + (st.difficulty === x ? " selected" : "") + '>' + DIFF_LABEL[x] + '</option>').join("") + '</select></label><p class="hint">Der Lernstand entsteht nur aus Übungen – er lässt sich nicht von Hand setzen.</p></div>',
    '<button class="btn" id="s_cancel">Abbrechen</button><button class="btn primary" id="s_save">Speichern</button>', () => {
      const q = id => document.getElementById(id); q("s_cancel").onclick = closeModal;
      q("s_save").onclick = async () => { const title = val("s_title"); if (!title) return; await dbPatch("subtopics", st.id, { title, description: val("s_desc") || null, difficulty: +val("s_diff"), updated_at: new Date().toISOString() }); closeModal(); route(); };
    });
}
function exerciseModal(ex, subId) {
  const isNew = !ex; ex = ex || { type: "free_text", difficulty: 2, question: "", options: null, correct_index: 0, expected_answer: "", solution: "" };
  let type = ex.type;
  const optsHtml = () => type === "multiple_choice" ? '<label class="fld">Antwortmöglichkeiten <span class="t-cap">(eine pro Zeile, die richtige mit * markieren)</span><textarea id="x_opts" style="min-height:110px">' + esc((ex.options || []).map((o, i) => (i === ex.correct_index ? "* " : "") + o).join("\n")) + '</textarea></label>'
    : type === "matching" ? '<label class="fld">Paare <span class="t-cap">(eine pro Zeile: links = rechts)</span><textarea id="x_opts" style="min-height:110px">' + esc((ex.options || []).map(p => p[0] + " = " + p[1]).join("\n")) + '</textarea></label>'
    : '<label class="fld">' + (type === "translation" ? "Richtige Übersetzung" : "Erwartete Antwort (optional)") + '<textarea id="x_exp" style="min-height:70px">' + esc(ex.expected_answer || "") + '</textarea></label>';
  const body = () => '<div class="form"><label class="fld">Art<select id="x_type">' + Object.keys(TYPE_NAMES).map(t => '<option value="' + t + '"' + (t === type ? " selected" : "") + '>' + TYPE_NAMES[t] + '</option>').join("") + '</select></label><label class="fld">Aufgabe<textarea id="x_q" style="min-height:80px">' + esc(ex.question) + '</textarea></label><div id="x_opts_wrap">' + optsHtml() + '</div><label class="fld">Lösung / Erklärung (optional)<textarea id="x_sol" style="min-height:70px">' + esc(ex.solution || "") + '</textarea></label><label class="fld">Schwierigkeit<select id="x_diff">' + [1, 2, 3].map(x => '<option value="' + x + '"' + (ex.difficulty === x ? " selected" : "") + '>' + DIFF_LABEL[x] + '</option>').join("") + '</select></label></div>';
  openModal(isNew ? "Neue Übung" : "Übung bearbeiten", body(), '<button class="btn" id="x_cancel">Abbrechen</button><button class="btn primary" id="x_save">Speichern</button>', () => {
    const q = id => document.getElementById(id);
    q("x_type").onchange = () => { ex.question = q("x_q").value; type = q("x_type").value; q("x_opts_wrap").innerHTML = optsHtml(); };
    q("x_cancel").onclick = closeModal;
    q("x_save").onclick = async () => {
      const question = q("x_q").value.trim(); if (!question) { q("x_q").focus(); return; }
      const row = { type, question, difficulty: +val("x_diff"), solution: q("x_sol").value.trim() || null, options: null, correct_index: null, expected_answer: null };
      if (type === "multiple_choice") { const lines = q("x_opts").value.split("\n").map(x => x.trim()).filter(Boolean); const ci = lines.findIndex(x => x.startsWith("*")); if (lines.length < 2 || ci < 0) { toast("Mindestens zwei Antworten, die richtige mit * markieren.", true); return; } row.options = lines.map(x => x.replace(/^\*\s*/, "")); row.correct_index = ci; }
      else if (type === "matching") { const pairs = q("x_opts").value.split("\n").map(x => x.split("=").map(y => y.trim())).filter(p => p.length === 2 && p[0] && p[1]); if (pairs.length < 2) { toast("Mindestens zwei Paare im Format „links = rechts“.", true); return; } row.options = pairs; }
      else { row.expected_answer = q("x_exp").value.trim() || null; if (type === "translation" && !row.expected_answer) { toast("Bitte die richtige Übersetzung angeben.", true); return; } }
      if (isNew) await dbInsert("exercises", Object.assign(row, { subtopic_id: subId, source: "user" })); else await dbPatch("exercises", ex.id, row);
      LP_OPEN.add(subId); closeModal(); route(); toast("Übung gespeichert");
    };
  });
}

/* =====================================================================
   KI · strukturierte Lernaktionen mit Kontext aus der Plattform
   ===================================================================== */
const KI_OPTS = [["erklaeren", "Erklären", "Erkläre mir dieses Thema.", "bulb", "explain"], ["ueben", "Üben", "Stelle mir Aufgaben.", "dumbbell", "practice"], ["pruefen", "Prüfen", "Teste mein Wissen.", "check", "quiz"], ["korrigieren", "Korrigieren", "Analysiere meine Antwort.", "pen", "correct"], ["simulieren", "Prüfung simulieren", "Teste mich wie in einer echten Prüfung.", "clock", "simulate"], ["sokratisch", "Selbst draufkommen", "Stell mir Fragen statt Lösungen.", "bubble", "socratic"]];
let KI = { mode: "", sub: "", thread: [], busy: false, error: "", key: "" };
const kiMode = () => KI_OPTS.find(o => o[0] === KI.mode);
const kiDraftKey = () => "lc_ki_draft_" + KI.mode + "_" + KI.sub;
function kiCtxSelect() {
  const exams = upcomingKL().filter(k => subsOfExam(k.id).length);
  return '<select id="ki_ctx"><option value="">Thema wählen …</option>' + exams.map(k => '<optgroup label="' + esc(k.fach + " · " + klTitle(k)) + '">' + subsOfExam(k.id).map(s => '<option value="' + esc(s.id) + '"' + (s.id === KI.sub ? " selected" : "") + '>' + esc(s.title) + '</option>').join("") + '</optgroup>').join("") + '</select>';
}
function kiCtxSummary() {
  const st = subById(KI.sub); if (!st) return "";
  const m = masteryOf(st.id); const mist = recentMistakes(st.id, 3); const ev = (eventsBySub()[st.id] || []).slice(-10);
  const ok = ev.filter(e => +e.result >= 0.5).length, bad = ev.filter(e => +e.result < 0.5).length;
  return '<div class="ctx-sum"><span>Lernstand ' + (m.score == null ? "– (noch keine Übung)" : m.score + " %") + '</span><span>Letzte Übungen: ' + ok + ' richtig · ' + bad + ' falsch</span>' + (mist.length ? '<span>Zuletzt schwierig: ' + esc(mist.join(", ")) + '</span>' : '') + '<span class="t-cap">Dieser Kontext wird der KI mitgegeben.</span></div>';
}
V.ki = () => {
  if (!engineReady()) return pageHead("Mit KI lernen") + setupCard();
  const q = ROUTE.query; if (q.sub && q.sub !== KI.sub) { KI.sub = q.sub; KI.thread = []; } if (q.mode && q.mode !== KI.mode) { KI.mode = q.mode; KI.thread = []; }
  const head = pageHead("Mit KI lernen", { sub: "Was möchtest du tun? Die KI kennt dein Thema, deinen Lernstand und deine letzten Fehler." });
  const unavailable = AI.state === "unavailable" ? '<div class="notice"><span class="dot" style="background:var(--orange)"></span><span>' + esc(AI.errorText({ code: AI.reason })) + ' Die Einrichtung steht in <code>docs/SETUP.md</code> (Schritt „KI“). Alles andere funktioniert ohne KI.</span><button class="btn sm" id="ki_retry">Erneut prüfen</button></div>' : '';
  const ctx = '<div class="ctxbar"><span class="t-sub">Thema</span>' + kiCtxSelect() + '</div>' + kiCtxSummary();
  const grid = '<div class="ki-grid">' + KI_OPTS.map(o => '<button class="opt' + (KI.mode === o[0] ? " on" : "") + '" data-ki="' + o[0] + '"><span class="oi">' + ICO[o[3]] + '</span><span class="ot">' + o[1] + '</span><span class="od">„' + o[2] + '“</span></button>').join("") + '</div>';
  return netNotice() + head + unavailable + ctx + grid + (kiMode() ? '<div class="section" id="ki_panel">' + kiPanel() + '</div>' : '');
};
function kiPanel() {
  const o = kiMode(); const needsSub = o[4] !== "correct";
  const st = subById(KI.sub);
  if (needsSub && !st) return sectionHead(o[1]) + '<div class="card">' + emptyState("lernplan", "Wähle zuerst ein Thema", "Die KI arbeitet mit deinem Lernplan: Wähle oben ein Unterthema. Noch keins angelegt? Das geht im Lernplan.", '<a class="btn sm" href="#/lernplan">Lernplan</a>') + '</div>';
  const draft = lsGet(kiDraftKey(), "");
  const thread = KI.thread.map(kiMsg).join("");
  const started = KI.thread.length > 0;
  const placeholder = { explain: "Was genau ist unklar? (optional)", practice: "Wünsche für die Aufgabe? (optional)", quiz: "Deine Antwort …", correct: "Füge hier deine Antwort oder deinen Text ein …", simulate: "", socratic: started ? "Deine Antwort …" : "Woran arbeitest du gerade? (optional)" }[o[4]];
  const composer = (o[4] === "simulate" && started) ? '' : '<div class="composer">' + (o[4] === "correct" && !started ? '<div style="flex:1;display:flex;flex-direction:column;gap:6px"><input id="ki_task" placeholder="Aufgabenstellung (optional)" value="' + esc(lsGet(kiDraftKey() + "_task", "")) + '" style="border:none;box-shadow:none"><textarea id="ki_in" placeholder="' + esc(placeholder) + '" style="min-height:140px">' + esc(draft) + '</textarea></div>' : '<textarea id="ki_in" placeholder="' + esc(placeholder) + '">' + esc(draft) + '</textarea>') + '<button class="btn primary' + (KI.busy ? " loading" : "") + '" id="ki_send">' + (started || o[4] === "correct" ? "Senden" : "Starten") + '</button></div>';
  return sectionHead(o[1], started ? '<button class="shl" id="ki_reset">Neu beginnen</button>' : '') + '<div class="card ki-card">' + (thread ? '<div class="thread">' + thread + '</div>' : '<p class="hint" style="margin:0 0 var(--s4)">' + kiIntro(o[4], st) + '</p>') + (KI.busy ? '<div class="msg ai"><span class="spinner"></span> Die KI denkt nach …</div>' : '') + (KI.error ? '<div class="fb bad"><div class="fb-t">' + ICO.x + '<b>' + esc(KI.error) + '</b></div></div>' : '') + composer + '</div>';
}
function kiIntro(m, st) {
  const t = st ? "„" + esc(st.title) + "“" : "deine Antwort";
  return { explain: "Die KI erklärt " + t + " passend zu deinem Lernstand und endet mit einer Kontrollfrage.", practice: "Die KI erstellt eine neue Übung zu " + t + ". Sie wird im Lernplan gespeichert und fließt nach dem Lösen in deinen Lernstand ein.", quiz: "Die KI stellt dir Fragen zu " + t + " und wartet auf deine Antwort. Jede Antwort zählt für deinen Lernstand.", correct: "Füge deine Antwort ein. Du bekommst eine Rückmeldung nach Inhalt, Struktur, Sprache, Grammatik und Aufgabenbezug – als Lernhilfe, nicht als Note.", simulate: "Die KI erstellt eine realistische Prüfungsaufgabe zu " + t + ". Du bearbeitest sie im Prüfungsmodus mit Zeitlimit.", socratic: "Die KI gibt dir keine fertige Lösung, sondern stellt gezielte Fragen – du kommst selbst drauf." }[m];
}
function kiMsg(m, idx) {
  if (m.role === "user") return '<div class="msg me">' + esc(m.text).replace(/\n/g, "<br>") + '</div>';
  const r = m.data || {}; const kind = m.kind;
  if (kind === "explain") return '<div class="msg ai"><b>' + esc(r.title || "") + '</b>' + mdLite(r.explanation) + (r.key_points && r.key_points.length ? '<ul>' + r.key_points.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul>' : '') + (r.check_question ? '<div class="kq"><span class="kind">Kontrollfrage</span>' + esc(r.check_question) + '</div>' : '') + '</div>';
  if (kind === "quiz") return '<div class="msg ai">' + (r.verdict && r.verdict !== "none" ? '<div class="verdict ' + r.verdict + '">' + ({ correct: "Richtig", partial: "Teilweise richtig", wrong: "Nicht richtig" }[r.verdict]) + '</div>' : '') + (r.feedback ? mdLite(r.feedback) : '') + (r.next_question ? '<div class="kq"><span class="kind">Frage</span>' + esc(r.next_question) + '</div>' : '') + '</div>';
  if (kind === "socratic") return '<div class="msg ai">' + mdLite(r.message) + (r.question ? '<div class="kq"><span class="kind">Frage an dich</span>' + esc(r.question) + '</div>' : '') + '</div>';
  if (kind === "correct") return '<div class="msg ai">' + (r.summary ? '<p>' + esc(r.summary) + '</p>' : '') + rubricHtml(r) + '</div>';
  if (kind === "practice") return '<div class="msg ai">' + kiExercise(r, idx) + '</div>';
  if (kind === "simulate") return '<div class="msg ai"><b>' + esc(r.title) + '</b>' + mdLite(r.instructions) + (r.material ? '<div class="solution"><div class="kind">Material</div>' + esc(r.material).replace(/\n/g, "<br>") + '</div>' : '') + (r.expectations && r.expectations.length ? '<div class="rb-sec"><b>Worauf es ankommt</b><ul>' + r.expectations.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></div>' : '') + '<button class="btn primary" style="margin-top:var(--s4)" data-simstart="' + idx + '">' + ICO.clock + 'Prüfung starten · ' + (r.time_minutes || 30) + ' Min.</button></div>';
  return '<div class="msg ai">' + esc(JSON.stringify(r)) + '</div>';
}
const mdLite = s => s ? '<div class="md">' + esc(s).split(/\n{2,}/).map(p => '<p>' + p.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>") + '</p>').join("") + '</div>' : "";
function kiExercise(r, idx) {
  const ex = r.exercise || {}; const st = r._state || {};
  let html = '<div class="kind">' + esc(TYPE_NAMES[ex.type] || "Übung") + (r._saved ? " · im Lernplan gespeichert" : "") + '</div><div class="t-headline" style="margin:4px 0 var(--s3)">' + esc(ex.question).replace(/\n/g, "<br>") + '</div>';
  if (ex.type === "multiple_choice") html += '<div class="choices">' + (ex.options || []).map((o, i) => '<button class="opt-choice' + (st.pick != null ? (i === ex.correct_index ? " right" : i === st.pick ? " wrongpick" : "") : "") + '" data-kpick="' + idx + ':' + i + '"' + (st.pick != null ? " disabled" : "") + '>' + esc(o) + '</button>').join("") + '</div>';
  else if (!st.done) html += '<textarea id="kx_' + idx + '" placeholder="Deine Antwort …" style="margin-top:var(--s2)">' + esc(st.answer || "") + '</textarea><button class="btn primary" style="margin-top:var(--s3)" data-kcheck="' + idx + '">Antwort prüfen</button>';
  else html += '<div class="t-callout" style="white-space:pre-wrap;color:var(--text);margin-top:var(--s2)">' + esc(st.answer) + '</div>';
  if (st.rubric) html += rubricHtml(st.rubric);
  if (st.pick != null && ex.solution) html += '<div class="solution"><div class="kind">Erklärung</div>' + esc(ex.solution) + '</div>';
  return html;
}
function kiHistory() {   // kompakte Gesprächshistorie für Folgeanfragen
  return KI.thread.slice(-12).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.role === "user" ? m.text : JSON.stringify(m.data).slice(0, 4000) }));
}
async function kiSend() {
  const o = kiMode(); const inp = document.getElementById("ki_in"); const text = inp ? inp.value.trim() : "";
  const taskEl = document.getElementById("ki_task"); const task = taskEl ? taskEl.value.trim() : "";
  if (o[4] === "correct" && !text) { inp.focus(); return; }
  if (o[4] === "quiz" && KI.thread.length && !text) { inp.focus(); return; }
  const st = subById(KI.sub); const ex = st ? examOfSub(st) : null;
  const payload = { mode: o[4], subtopic_id: st ? st.id : null, topic_id: st ? st.topic_id : null, exam_id: ex ? ex.id : null, input: text, history: kiHistory() };
  if (o[4] === "correct") { payload.mode = "correct"; payload.answer = text; payload.exercise = { type: "free_text", question: task || (st ? "Freie Antwort zum Thema " + st.title : "Freie Antwort") }; }
  if (text) KI.thread.push({ role: "user", text: (task ? "Aufgabe: " + task + "\n\n" : "") + text });
  KI.busy = true; KI.error = ""; renderKiPanel();
  try {
    const r = await AI.call(payload);
    lsSet(kiDraftKey(), ""); lsSet(kiDraftKey() + "_task", "");
    const msg = { role: "ai", kind: o[4], data: r };
    if (o[4] === "practice" && st && r.exercise) { const saved = await saveAiExercise(st, r.exercise); r._saved = true; r._id = saved.id; }
    if (o[4] === "correct") { const rub = AI.normRubric(r); msg.data = Object.assign(rub, { summary: r.summary || "" }); if (st) logEvent({ type: "ai_feedback", result: rub.overall / 100, subtopic_id: st.id, topic_id: st.topic_id, exam_id: ex ? ex.id : null, subject: ex ? ex.fach : null, difficulty: st.difficulty, detail: { source: "ki_korrektur", rubric: rub.criteria, mistakes: rub.mistakes, task: task.slice(0, 300) } }); }
    if (o[4] === "quiz" && st && r.verdict && r.verdict !== "none") { const res = r.verdict === "correct" ? 1 : r.verdict === "partial" ? 0.5 : 0; logEvent({ type: res >= 0.5 ? "exercise_correct" : "exercise_wrong", result: res, subtopic_id: st.id, topic_id: st.topic_id, exam_id: ex ? ex.id : null, subject: ex ? ex.fach : null, difficulty: st.difficulty, detail: { source: "ki_quiz", given: text.slice(0, 500), mistake: r.mistake || null } }); }
    KI.thread.push(msg);
    if (st) syncMasteryCache([st.id]);
  } catch (e) {
    lsSet(kiDraftKey(), text); if (task) lsSet(kiDraftKey() + "_task", task);
    if (text) KI.thread.pop();
    KI.error = AI.errorText(e) + (text ? " Deine Eingabe ist gespeichert." : "");
  }
  KI.busy = false;
  if (ROUTE.name === "ki") { if (AI.state === "unavailable") route(); else renderKiPanel(); }
}
function renderKiPanel() { const p = document.getElementById("ki_panel"); if (!p) return; p.innerHTML = kiPanel(); bindKiPanel(); const t = p.querySelector(".thread"); if (t) t.lastElementChild && t.lastElementChild.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
async function saveAiExercise(st, x) {
  const row = { subtopic_id: st.id, type: Object.keys(TYPE_NAMES).includes(x.type) ? x.type : "free_text", difficulty: Math.min(3, Math.max(1, +x.difficulty || 2)), question: String(x.question || "").slice(0, 8000), options: x.type === "multiple_choice" ? (x.options || []) : x.type === "matching" ? (x.pairs || x.options || []) : null, correct_index: x.type === "multiple_choice" ? (+x.correct_index || 0) : null, expected_answer: x.expected_answer || null, solution: x.solution || null, source: "ai" };
  return (await dbInsert("exercises", row)).row;
}
async function kiGenerateExercise(st) {
  const ex = examOfSub(st);
  const r = await AI.call({ mode: "practice", subtopic_id: st.id, topic_id: st.topic_id, exam_id: ex ? ex.id : null, input: "", history: [] });
  if (!r.exercise) throw new Error("Keine Übung erhalten");
  return saveAiExercise(st, r.exercise);
}
function bindKiPanel() {
  const s = document.getElementById("ki_send"); if (s) s.onclick = kiSend;
  const inp = document.getElementById("ki_in"); if (inp) { inp.oninput = debounce(() => lsSet(kiDraftKey(), inp.value), 300); inp.onkeydown = e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) kiSend(); }; }
  const task = document.getElementById("ki_task"); if (task) task.oninput = debounce(() => lsSet(kiDraftKey() + "_task", task.value), 300);
  const rs = document.getElementById("ki_reset"); if (rs) rs.onclick = () => { KI.thread = []; KI.error = ""; renderKiPanel(); };
  document.querySelectorAll("[data-kpick]").forEach(b => b.onclick = () => {
    const [i, p] = b.dataset.kpick.split(":").map(Number); const m = KI.thread[i]; const ex = m.data.exercise; m.data._state = { pick: p, done: true };
    const st = subById(KI.sub); const exam = st && examOfSub(st); const ok = p === ex.correct_index;
    if (st) { logEvent({ type: ok ? "exercise_correct" : "exercise_wrong", result: ok ? 1 : 0, subtopic_id: st.id, topic_id: st.topic_id, exam_id: exam ? exam.id : null, subject: exam ? exam.fach : null, exercise_id: m.data._id || null, difficulty: ex.difficulty || 2, detail: { source: "ki_uebung", question: String(ex.question).slice(0, 300), given: ex.options[p] } }); syncMasteryCache([st.id]); }
    renderKiPanel();
  });
  document.querySelectorAll("[data-kcheck]").forEach(b => b.onclick = async () => {
    const i = +b.dataset.kcheck; const m = KI.thread[i]; const ex = m.data.exercise; const ans = document.getElementById("kx_" + i).value.trim(); if (!ans) return;
    b.classList.add("loading"); const st = subById(KI.sub);
    const auto = Engine.checkExercise(ex, ans);
    try {
      let rub = null, res = auto.result;
      if (res == null) { rub = await AI.correct({ item: { exercise: ex, subtopic_id: st && st.id }, answer: ans }); res = rub.overall / 100; }
      m.data._state = { answer: ans, done: true, rubric: rub };
      if (st) { const exam = examOfSub(st); logEvent({ type: rub ? "ai_feedback" : res >= 0.5 ? "exercise_correct" : "exercise_wrong", result: res, subtopic_id: st.id, topic_id: st.topic_id, exam_id: exam ? exam.id : null, subject: exam ? exam.fach : null, exercise_id: m.data._id || null, difficulty: ex.difficulty || 2, detail: { source: "ki_uebung", given: ans.slice(0, 1500), rubric: rub && rub.criteria, mistakes: rub ? rub.mistakes : [] } }); syncMasteryCache([st.id]); }
    } catch (e) { m.data._state = { answer: ans }; toast(AI.errorText(e) + " Deine Antwort bleibt im Feld.", true); }
    renderKiPanel();
  });
  document.querySelectorAll("[data-simstart]").forEach(b => b.onclick = async () => {
    const r = KI.thread[+b.dataset.simstart].data; const st = subById(KI.sub);
    const exRow = st ? await saveAiExercise(st, { type: "short_writing", question: r.title + "\n\n" + r.instructions + (r.material ? "\n\nMaterial:\n" + r.material : ""), solution: (r.expectations || []).join("\n"), difficulty: 3 }) : null;
    const s = Engine.createSession({ mode: "exam", label: "Simulation · " + (st ? st.title : r.title), timeLimitS: (Math.min(180, Math.max(10, +r.time_minutes || 30))) * 60, feedback: false, hints: false, scope: { subtopic_id: st ? st.id : null, topic_id: st ? st.topic_id : null, exam_id: st && examOfSub(st) ? examOfSub(st).id : null, subject: st && examOfSub(st) ? examOfSub(st).fach : null },
      items: [{ kind: "exercise", key: "sim:" + (exRow ? exRow.id : Date.now()), subtopic_id: st ? st.id : null, topic_id: st ? st.topic_id : null, exercise: exRow || { id: null, type: "short_writing", difficulty: 3, question: r.title + "\n\n" + r.instructions } }] });
    s.masteryBefore = st ? { [st.id]: masteryOf(st.id).score } : {};
    if (tsActive()) await tsFinish("abandoned", true);
    TS = s; UI = {}; tsSave();
    dbInsert("training_sessions", { id: s.id, mode: "exam", status: "active", label: s.label, subtopic_id: s.scope.subtopic_id, topic_id: s.scope.topic_id, exam_id: s.scope.exam_id ?? null, subject: s.scope.subject, started_at: new Date(s.started_at).toISOString(), time_limit_s: s.time_limit_s, question_count: 1 });
    location.hash = "#/trainer/session";
  });
}
function bindKI() {
  const c = document.getElementById("ki_ctx"); if (c) c.onchange = () => { KI.sub = c.value; KI.thread = []; KI.error = ""; history.replaceState(null, "", "#/ki" + (KI.sub ? "?sub=" + KI.sub + (KI.mode ? "&mode=" + KI.mode : "") : "")); route(); };
  document.querySelectorAll("[data-ki]").forEach(b => b.onclick = () => { KI.mode = KI.mode === b.dataset.ki ? "" : b.dataset.ki; KI.thread = []; KI.error = ""; history.replaceState(null, "", "#/ki" + (KI.sub ? "?sub=" + KI.sub : "") + (KI.mode ? (KI.sub ? "&" : "?") + "mode=" + KI.mode : "")); route(); const p = document.getElementById("ki_panel"); if (p) p.scrollIntoView({ block: "start", behavior: "smooth" }); });
  const rt = document.getElementById("ki_retry"); if (rt) rt.onclick = async () => { AI.state = "unknown"; try { await AI.call({ mode: "ping" }); toast("KI ist erreichbar"); } catch (e) { toast(AI.errorText(e), true); } route(); };
  if (document.getElementById("ki_panel")) bindKiPanel();
}

/* =====================================================================
   FORTSCHRITT · echte Daten, nur was beim Lernen hilft
   ===================================================================== */
V.fortschritt = () => {
  if (!engineReady()) return pageHead("Fortschritt") + setupCard();
  const now = Date.now(); const t = todayISO(); const mbd = minutesByDay();
  const weekStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const ws = weekStart(now); const wsPrev = new Date(ws); wsPrev.setDate(ws.getDate() - 7);
  const inRange = (iso, a, b) => iso >= isoLocal(a) && iso < isoLocal(b);
  const sumMin = (a, b) => Math.round(Object.entries(mbd).filter(([d]) => inRange(d, a, b)).reduce((s, [, v]) => s + v, 0));
  const wsNext = new Date(ws); wsNext.setDate(ws.getDate() + 7);
  const minW = sumMin(ws, wsNext), minP = sumMin(wsPrev, ws);
  const sessW = ES.sessions.filter(s => s.started_at && new Date(s.started_at) >= ws && (s.active_seconds || 0) >= 60).length;
  const exTypes = ["exercise_correct", "exercise_wrong", "ai_feedback", "exam_result", "self_assessment"];
  const exW = ES.events.filter(e => exTypes.includes(e.type) && new Date(e.created_at) >= ws).length, exP = ES.events.filter(e => exTypes.includes(e.type) && new Date(e.created_at) >= wsPrev && new Date(e.created_at) < ws).length;
  const vs = Engine.vocabStats(STATE.vo, now); const streak = learnStreak();
  const delta = (a, b, u) => { if (!a && !b) return "Noch keine Daten"; const d = a - b; return d === 0 ? "wie letzte Woche" : '<span class="' + (d > 0 ? "up" : "down") + '">' + (d > 0 ? "+" : "−") + Math.abs(d) + (u || "") + '</span> zur Vorwoche'; };
  const head = pageHead("Fortschritt", { sub: "Wie viel du lernst, was sitzt – und wo du ansetzen solltest." });
  const kpis = '<div class="kpis"><div class="card kpi"><div class="kl">Lernzeit diese Woche</div><div class="num">' + (minW >= 60 ? Math.floor(minW / 60) + '<small>Std.</small> ' + (minW % 60) + '<small>Min.</small>' : minW + '<small>Min.</small>') + '</div><div class="kd">' + delta(minW, minP, " Min.") + ' · ' + plural(sessW, "Session", "Sessions") + '</div></div><div class="card kpi"><div class="kl">Übungen diese Woche</div><div class="num">' + exW + '</div><div class="kd">' + delta(exW, exP) + '</div></div><div class="card kpi"><div class="kl">Vokabeln sicher</div><div class="num">' + vs.secure + '<small>von ' + vs.total + '</small></div><div class="kd">' + vs.due + ' fällig · ' + vs.fresh + ' noch neu</div></div><div class="card kpi"><div class="kl">Am Stück gelernt</div><div class="num">' + streak + '<small>' + (streak === 1 ? "Tag" : "Tage") + '</small></div><div class="kd">' + (streak ? "Tage in Folge mit Lernaktivität" : "Heute ist ein guter Tag für den Anfang") + '</div></div></div>';
  const ms = Engine.milestones({ streak, secureVocab: vs.secure, hoursTotal: Object.values(mbd).reduce((a, b) => a + b, 0) / 60 });
  const miles = ms.length ? '<div class="milestones">' + ms.map(m => '<span class="pill p-accent">' + ICO.check.replace("<svg", '<svg style="width:12px;height:12px;display:inline;vertical-align:-2px;margin-right:4px"') + esc(m.title) + '</span>').join("") + '</div>' : '';
  // Letzte 7 Tage
  const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(now - i * 864e5); const iso = isoLocal(d); days.push({ iso, lbl: DSHORT[d.getDay()], v: Math.round(mbd[iso] || 0) }); }
  const mx = Math.max(1, ...days.map(d => d.v));
  const chart = '<div>' + sectionHead("Lernzeit · 7 Tage", '<span class="sub">' + days.reduce((a, d) => a + d.v, 0) + ' Min.</span>') + '<div class="card">' + (days.some(d => d.v) ? '<div class="bars">' + days.map(d => '<div class="bc' + (d.iso === t ? " cur" : "") + '"><span class="bv">' + (d.v || "") + '</span><span class="bb" style="height:' + Math.max(2, d.v / mx * 100) + '%"></span><span class="bl">' + d.lbl + '</span></div>').join("") + '</div>' : emptyState("clock", "Noch keine Lernzeit", "Starte ein Training – jede Minute wird hier gezählt.").replace('class="empty"', 'class="empty sm"')) + '</div></div>';
  // Fehlerentwicklung: Fehlerquote je Woche (8 Wochen)
  const wk = []; for (let i = 7; i >= 0; i--) { const a = new Date(ws); a.setDate(ws.getDate() - i * 7); const b = new Date(a); b.setDate(a.getDate() + 7); const ev = ES.events.filter(e => e.result != null && new Date(e.created_at) >= a && new Date(e.created_at) < b); const wrong = ev.filter(e => +e.result < 0.5).length; wk.push({ lbl: "KW" + isoWeek(a), n: ev.length, rate: ev.length ? Math.round(wrong / ev.length * 100) : null }); }
  const err = '<div>' + sectionHead("Fehlerquote", '<span class="sub">Anteil falscher Antworten je Woche</span>') + '<div class="card">' + (wk.some(w => w.n) ? '<div class="bars">' + wk.map((w, i) => '<div class="bc' + (i === 7 ? " cur" : "") + '"><span class="bv">' + (w.rate == null ? "" : w.rate + "%") + '</span><span class="bb" style="height:' + (w.rate == null ? 2 : Math.max(2, w.rate)) + '%;' + (w.rate != null && w.rate >= 40 ? "background:var(--orange)" : "") + '"></span><span class="bl">' + w.lbl + '</span></div>').join("") + '</div><div class="hint" style="margin-top:var(--s3)">Sinkende Balken heißen: weniger Fehler bei gleichem Stoff. Grundlage: ' + plural(wk.reduce((a, w) => a + w.n, 0), "Antwort", "Antworten") + '.</div>' : emptyState("target", "Noch keine Antworten", "").replace('class="empty"', 'class="empty sm"')) + '</div></div>';
  // Prüfungsbereitschaft & Themenfortschritt
  const up = upcomingKL();
  const ready = '<div>' + sectionHead("Prüfungsbereitschaft", '<a class="shl" href="#/lernplan">Lernplan</a>') + '<div class="card tight">' + (up.length ? up.map(k => { const r = readinessOf(k); return '<a class="meter" href="#/lernplan/' + esc(k.id) + '" style="text-decoration:none;color:inherit;display:grid"><span class="mt-l">' + esc(k.fach) + ' · ' + esc(klTitle(k)) + '<span class="mt-s">' + daysLabel(daysUntil(k.datum)) + (r.total ? " · " + r.withData + " von " + r.total + " Bereichen geübt" : " · keine Unterthemen") + '</span></span><span class="mt-v">' + (r.score == null ? "—" : r.score + " %") + '</span>' + progBar(r.score || 0) + '</a>'; }).join("") : emptyState("flag", "Keine Prüfung geplant", "").replace('class="empty"', 'class="empty sm"')) + '</div></div>';
  const topicRows = ES.topics.filter(tp => { const ex = tp.exam_id != null ? klById(tp.exam_id) : null; return !ex || (daysUntil(ex.datum) >= 0 && ex.punkte == null); }).map(tp => { const subs = subsOfTopic(tp.id); if (!subs.length) return ""; const withD = subs.filter(s => masteryOf(s.id).score != null).length; const avg = Math.round(subs.reduce((a, s) => a + (masteryOf(s.id).score || 0), 0) / subs.length); const ex = tp.exam_id != null ? klById(tp.exam_id) : null; return '<div class="meter"><span class="mt-l">' + esc(tp.title) + '<span class="mt-s">' + (ex ? esc(ex.fach) + " · " : "") + withD + ' von ' + subs.length + ' Unterthemen geübt</span></span><span class="mt-v">' + (withD ? avg + " %" : "—") + '</span>' + progBar(avg) + '</div>'; }).join("");
  const topicsCard = '<div>' + sectionHead("Themenfortschritt") + '<div class="card tight">' + (topicRows || emptyState("lernplan", "Noch keine Themen", "").replace('class="empty"', 'class="empty sm"')) + '</div></div>';
  // Vokabeln
  const tot = Math.max(1, vs.total);
  const vok = '<div>' + sectionHead("Vokabeln", '<a class="shl" href="#/vokabeln">Sammlungen</a>') + '<div class="card"><div class="num" style="font-size:34px;margin:var(--s2) 0 var(--s4)">' + Math.round(vs.secure / tot * 100) + ' %<span class="t-sub" style="font-size:15px;margin-left:8px;letter-spacing:0">sicher (Intervall ≥ 7 Tage)</span></div><div class="stackbar"><i style="width:' + (vs.mastered / tot * 100) + '%;background:var(--accent)"></i><i style="width:' + ((vs.secure - vs.mastered) / tot * 100) + '%;background:rgba(45,91,215,.55)"></i><i style="width:' + (vs.learning / tot * 100) + '%;background:rgba(45,91,215,.25)"></i><i style="width:' + (vs.fresh / tot * 100) + '%;background:var(--fill-3)"></i></div><div class="legend"><span><i style="background:var(--accent)"></i>Sehr sicher ' + vs.mastered + '</span><span><i style="background:rgba(45,91,215,.55)"></i>Sicher ' + (vs.secure - vs.mastered) + '</span><span><i style="background:rgba(45,91,215,.25)"></i>Im Lernen ' + vs.learning + '</span><span><i style="background:var(--fill-3)"></i>Neu ' + vs.fresh + '</span></div><div class="hint" style="margin-top:var(--s3)">' + ES.events.filter(e => e.type.startsWith("vocabulary") && new Date(e.created_at) >= ws).length + ' Abfragen diese Woche · ' + vs.trouble + ' Karten mit Fehlern</div></div></div>';
  const weak = '<div>' + sectionHead("Schwachstellen") + '<div class="card tight">' + weakList(5) + '</div></div>';
  const hj = currentHJ(); const ges = gesamtSchnitt(hj);
  const noten = '<div class="section">' + sectionHead("Ergebnisse", '<a class="shl" href="#/noten">Alle Noten</a>') + '<div class="list"><a class="li" href="#/noten"><div class="li-main"><div class="li-title">Schnitt ' + hj + '</div><div class="li-sub">Alle belegten Fächer</div></div><span class="li-trail" style="color:var(--text);font-size:17px;font-weight:600">' + (ges == null ? "—" : fmtPt(ges) + " P.") + '<span class="chev">' + ICO.chev + '</span></span></a>' + pastKL().filter(k => k.punkte != null).slice(0, 4).map(k => '<a class="li" href="#/lernplan/' + esc(k.id) + '"><div class="li-main"><div class="li-title">' + esc(k.fach) + ' · ' + esc(klTitle(k)) + '</div><div class="li-sub">' + esc(fmtD(k.datum)) + ' · Note ' + PT_NOTE[k.punkte] + '</div></div><span class="pt ' + ptClass(k.punkte) + '">' + k.punkte + '</span></a>').join("") + '</div></div>';
  return netNotice() + head + kpis + miles + '<div class="section"><div class="grid two">' + chart + err + '</div></div><div class="section"><div class="grid two">' + ready + weak + '</div></div><div class="section"><div class="grid two">' + topicsCard + vok + '</div></div>' + noten;
};

/* =====================================================================
   EINSTELLUNGEN · Konto, Lernzeit, Synchronisation, KI
   ===================================================================== */
const V_einstellungen_base = V.einstellungen, bindEinstellungen_base = bindEinstellungen;
V.einstellungen = () => {
  if (!engineReady()) return setupCard() + '<div class="mt">' + V_einstellungen_base() + '</div>';
  const u = Api.user || {}; const failed = Api.failed();
  const acc = '<div class="card"><h2>Konto</h2><div class="inforow"><span class="d">E-Mail</span><span class="x">' + esc(u.email || "—") + '</span></div><div class="inforow"><span class="d">Datenschutz</span><span class="x">Deine Lerndaten sind per Row Level Security an dein Konto gebunden. Andere Konten können sie weder lesen noch ändern.</span></div><div style="display:flex;gap:var(--s2);margin-top:var(--s4);flex-wrap:wrap"><button class="btn sm" id="s_pw">Passwort ändern</button><button class="btn sm danger" id="s_logout">Abmelden</button></div></div>';
  const learn = '<div class="card mt"><h2>Lernzeit pro Tag</h2><div class="form c2"><label class="fld">Zeitbudget für den Tagesplan (Minuten)<input id="s_budget" type="number" min="5" max="240" step="5" value="' + budgetMinutes() + '"></label></div><div class="hint" style="margin-top:var(--s2)">Der Tagesplan verteilt diese Zeit auf fällige Vokabeln und deine wichtigsten Unterthemen.</div><button class="btn primary mini" id="s_budget_save" style="margin-top:var(--s3)">Speichern</button></div>';
  const sync = '<div class="card mt"><h2>Synchronisation</h2><div class="inforow"><span class="d">Status</span><span class="x">' + (STATE.offline ? "Offline – Änderungen werden lokal gesammelt" : Api.pending ? Api.pending + " Änderungen warten auf Übertragung" : "Alles gespeichert") + '</span></div>' + (failed.length ? '<div class="inforow"><span class="d" style="color:var(--red)">Fehlgeschlagen</span><span class="x">' + failed.slice(-5).map(f => esc(f.method + " " + f.path.split("?")[0].replace("/rest/v1/", "") + ": " + f.error)).join("<br>") + '</span></div>' : '') + '<div style="display:flex;gap:var(--s2);margin-top:var(--s4);flex-wrap:wrap"><button class="btn sm" id="s_sync">Jetzt synchronisieren</button>' + (failed.length ? '<button class="btn sm" id="s_clearfail">Fehlerliste leeren</button>' : '') + '</div></div>';
  const ai = '<div class="card mt"><h2>KI</h2><div class="hint">Die KI läuft über eine Supabase Edge Function. Der API-Schlüssel liegt nur auf dem Server.</div><div style="margin-top:var(--s3);display:flex;gap:var(--s2);align-items:center;flex-wrap:wrap"><span class="pill ' + (AI.state === "ok" ? "p-green" : AI.state === "unavailable" ? "p-amber" : "") + '">' + (AI.state === "ok" ? "verbunden" : AI.state === "unavailable" ? "nicht eingerichtet" : "noch nicht geprüft") + '</span><button class="btn sm" id="s_aitest">Verbindung testen</button></div></div>';
  return acc + learn + sync + ai + '<div class="mt">' + V_einstellungen_base() + '</div>';
};
bindEinstellungen = function () {
  bindEinstellungen_base();
  const q = id => document.getElementById(id);
  const lo = q("s_logout"); if (lo) lo.onclick = async () => { if (tsActive()) await tsFinish("abandoned", true); TS = null; tsSave(); await Api.signOut(); STATE.needAuth = true; AUTH_MODE = "login"; location.hash = "#/dashboard"; route(); };
  const pw = q("s_pw"); if (pw) pw.onclick = () => { AUTH_MODE = "newpw"; STATE.needAuth = true; route(); };
  const bs = q("s_budget_save"); if (bs) bs.onclick = async () => { const v = Math.min(240, Math.max(5, +val("s_budget") || 30)); if (ES.profile) await dbPatchProfile({ daily_minutes: v }); todayPlan(true); toast("Gespeichert"); };
  const sy = q("s_sync"); if (sy) sy.onclick = async () => { await Api.flush(); route(); toast(Api.pending ? "Noch nicht alles übertragen – keine Verbindung?" : "Alles gespeichert"); };
  const cf = q("s_clearfail"); if (cf) cf.onclick = () => { Api.clearFailed(); route(); };
  const at = q("s_aitest"); if (at) at.onclick = async () => { at.classList.add("loading"); try { await AI.call({ mode: "ping" }); toast("KI ist erreichbar"); } catch (e) { toast(AI.errorText(e), true); } route(); };
};
async function dbPatchProfile(p) { Object.assign(ES.profile, p); bump(); return Api.write("PATCH", "profiles", "id=eq." + encodeURIComponent(ES.profile.id), p); }
