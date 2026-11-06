/* =====================================================================
   LERN-COCKPIT · EIGENE CHECKLISTE JE KLAUSUR + RECHENWEG-CHECK
   Klausur-Modus → Tab „Checkliste“: Themenzettel fotografieren/PDF (KI baut
   Punkte mit Erklärung, Heft-Aufgaben, Buchseiten) oder Punkte selbst
   eintippen. Je Punkt: „Kann ich / Unsicher / Noch nicht“.
   Gespeichert in einstellungen.checklisten = { Klausur-ID: { title, fach,
   src: "ki" | "text", items: [{ nr, area, short, title, book[], learn[],
   paper[] }], st: { Nr: Status } } }
   Rechenweg-Check: Foto vom Heft → KI sagt, in welcher Zeile der Fehler ist.
   ===================================================================== */
let KC_BUSY = false;
const klChecks = () => setting("checklisten", {}) || {};
const klCheck = id => klChecks()[id] || null;
async function klCheckSave(id, c) { const all = Object.assign({}, klChecks()); if (c) all[id] = c; else delete all[id]; await setSetting("checklisten", all); }
const KC_ST = [["ok", "✅", "Kann ich"], ["mid", "🟡", "Unsicher"], ["no", "❌", "Noch nicht"]];
/** Text (eine Zeile = ein Punkt, „Überschrift:“ = Abschnitt) → Punkte */
function kcFromText(text) {
  let area = ""; const items = [];
  String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => {
    if (/:$/.test(l) && l.length < 60) { area = l.slice(0, -1); return; }
    const m = l.match(/^(\d+|[A-Z])[.)]\s*(.+)$/); const title = (m ? m[2] : l.replace(/^[-•*]\s*/, "")).trim();
    items.push({ nr: m ? m[1] : String(items.length + 1), area, short: title.split(/\s+/).slice(0, 6).join(" ").replace(/[.,;:]$/, ""), title, book: [], learn: [], paper: [] });
  });
  return items;
}
/** Karte für Fach-Seite / Klausur-Start */
function klCheckCard(k) {
  const c = klCheck(k.id);
  const ok = c ? c.items.filter(i => (c.st || {})[i.nr] === "ok").length : 0;
  return '<a class="card dr-card kc-card" href="#/klausur/' + esc(k.id) + '?tab=checkliste"><span class="dr-ic">✅</span><span class="dr-tx"><b>' + (c ? "Checkliste: " + ok + " von " + c.items.length + " „Kann ich“" : "Checkliste anlegen") + '</b><span class="t-sub">' + (c ? "Erklärungen, Heft-Aufgaben, Selbsteinschätzung" : "Themenzettel fotografieren – die App baut die Checkliste") + '</span></span><span class="chev">' + ICO.chev + '</span></a>';
}

/* ---------- Tab „Checkliste“ im Klausur-Modus ---------- */
function kmCheckliste(k) {
  const c = klCheck(k.id); const p = ROUTE.query.p;
  if (c && p != null) { const it = c.items.find(i => String(i.nr) === String(p)); if (it) return kcItem(k, c, it); }
  if (!c) return '<div class="card kc-new"><h2>Checkliste anlegen</h2><p class="t-sub" style="margin-top:0">Du hast einen Themenzettel oder eine Checkliste vom Lehrer? Dann musst du nichts abtippen.</p>' +
    '<div class="kc-opt"><b>📷 Foto oder PDF vom Zettel</b><span class="t-sub">Die KI übernimmt alle Punkte, schreibt zu jedem eine Erklärung mit Beispiel, sagt dir, was du aufschreiben sollst, und übernimmt die Buchseiten.</span>' +
    '<label class="btn kc-file">' + ICO.plus + '<span id="kc_fn">Fotos/PDF wählen</span><input type="file" id="kc_files" accept="image/*,application/pdf" multiple hidden></label>' +
    '<button class="btn primary lg wide" id="kc_ai" disabled>Checkliste erstellen</button><div id="kc_busy"></div></div>' +
    '<div class="kc-or">oder</div><div class="kc-opt"><b>✏️ Punkte selbst eintippen</b><span class="t-sub">Eine Zeile = ein Punkt. Eine Zeile mit „:“ am Ende wird Überschrift. Funktioniert auch ohne KI.</span>' +
    '<textarea id="kc_text" rows="6" placeholder="Grammatik:&#10;1. passé composé mit être&#10;2. Adjektive angleichen&#10;Wortschatz:&#10;3. Kleidung (Unité 3)"></textarea><button class="btn lg wide" id="kc_textgo">Checkliste anlegen</button></div></div>';
  const st = c.st || {}; const ok = c.items.filter(i => st[i.nr] === "ok").length; const next = c.items.find(i => st[i.nr] !== "ok");
  const areas = [...new Set(c.items.map(i => i.area || ""))];
  return '<div class="card ck-sum"><div><b>' + ok + ' von ' + c.items.length + '</b> Punkten: „Kann ich“</div>' + progBar(Math.round(ok / c.items.length * 100), ok === c.items.length ? "g" : "") +
    (next ? '<a class="btn primary ck-next" href="#/klausur/' + esc(k.id) + '?tab=checkliste&p=' + encodeURIComponent(next.nr) + '">' + ICO.play + 'Weiter mit ' + esc(next.nr) + ' · ' + esc(next.short) + '</a>' : '') + '</div>' +
    areas.map(a => '<div class="card ck-area">' + (a ? '<h2>' + esc(a) + '</h2>' : '') + c.items.filter(i => (i.area || "") === a).map(i => { const s = st[i.nr];
      return '<a class="ck-row' + (s ? " " + s : "") + '" href="#/klausur/' + esc(k.id) + '?tab=checkliste&p=' + encodeURIComponent(i.nr) + '"><span class="ck-nr">' + esc(i.nr) + '</span><div class="ck-main"><b>' + esc(i.short) + '</b>' + (i.title !== i.short ? '<span class="ck-t">' + esc(i.title) + '</span>' : '') + '</div><span class="ck-st">' + (s ? KC_ST.find(x => x[0] === s)[1] : "") + '</span><span class="chev">' + ICO.chev + '</span></a>'; }).join("") + '</div>').join("") +
    '<div class="kc-foot"><span class="t-sub">' + (c.src === "ki" ? "Von Claude aus deinem Zettel erstellt – prüfe die Punkte kurz, alles ist änderbar." : "Selbst eingetippt – alles ist änderbar.") + '</span><span><button class="btn sm" id="kc_add">' + ICO.plus + 'Punkt</button> <button class="btn sm" id="kc_reset">Neu anlegen</button></span></div>';
}
function kcItem(k, c, it) {
  const st = (c.st || {})[it.nr]; const i = c.items.indexOf(it), prev = c.items[i - 1], next = c.items[i + 1];
  const base = "#/klausur/" + esc(k.id) + "?tab=checkliste";
  const learn = (it.learn || []).map(b => '<div class="ck-b">' + (b.h ? '<h3>' + esc(b.h) + '</h3>' : '') + (b.t ? '<p>' + mkMd(b.t) + '</p>' : '') + (b.f ? '<div class="ck-f">' + mkMd(b.f) + '</div>' : '') + (b.ex && b.ex.length ? '<div class="ck-ex"><span>Beispiel</span><ol>' + b.ex.map(x => '<li>' + mkMd(x) + '</li>').join("") + '</ol></div>' : '') + '</div>').join("");
  const paper = (it.paper || []).concat((it.book || []).length ? ["**Buch:** " + it.book.join(" · ")] : []);
  return '<a class="backlink" href="' + base + '">' + ICO.back + 'Checkliste</a><div class="dr-head">' + (it.area ? '<div class="ck-area-l">' + esc(it.area) + ' · Punkt ' + esc(it.nr) + '</div>' : '<div class="ck-area-l">Punkt ' + esc(it.nr) + '</div>') + '<h1 class="t-large ck-h">' + esc(it.short) + '</h1>' + (it.title !== it.short ? '<div class="ck-quote">„' + esc(it.title) + '“</div>' : '') + '</div>' +
    '<div class="kc-tools"><button class="btn sm" id="kc_edit" data-nr="' + esc(it.nr) + '">✏️ Bearbeiten</button><button class="btn sm" id="kc_del" data-nr="' + esc(it.nr) + '">🗑 Löschen</button></div>' +
    '<div class="card ck-self"><b>Wie sicher bist du?</b><div class="seg">' + KC_ST.map(([s, ic, l]) => '<button class="' + (st === s ? "on" : "") + '" data-kcst="' + esc(it.nr) + ':' + s + '">' + ic + ' ' + l + '</button>').join("") + '</div></div>' +
    (learn ? '<div class="card ck-learn"><h2>📖 Erklärung</h2>' + learn + '</div>' : '<div class="card ck-learn"><h2>📖 Erklärung</h2><p class="t-sub" style="margin:0 0 10px">Zu diesem Punkt gibt es noch keine Erklärung.</p><button class="btn primary" id="kc_explain" data-nr="' + esc(it.nr) + '">🤖 Von der KI erklären lassen</button><div id="kc_busy"></div></div>') +
    (paper.length ? '<div class="card ck-paper"><h2>✍️ Auf Papier / iPad</h2><ul>' + paper.map(x => '<li>' + mkMd(x) + '</li>').join("") + '</ul></div>' : '') + kcQuiz(it) +
    '<div class="ck-nav">' + (prev ? '<a class="btn" href="' + base + '&p=' + encodeURIComponent(prev.nr) + '">← ' + esc(prev.nr) + ' · ' + esc(prev.short) + '</a>' : '<span></span>') + (next ? '<a class="btn" href="' + base + '&p=' + encodeURIComponent(next.nr) + '">' + esc(next.nr) + ' · ' + esc(next.short) + ' →</a>' : '') + '</div>';
}
/** nach dem Anlegen: Checkliste zeigen (auch wenn sie auf dem Start-Tab angelegt wurde) */
function kcShow(k) { const h = "#/klausur/" + k.id + "?tab=checkliste"; if (location.hash === h) route(); else location.hash = h; }
function bindKmCheckliste(k) {
  const q = id => document.getElementById(id); const busy = t => { const b = q("kc_busy"); if (b) b.innerHTML = t ? '<div class="kc-wait"><span class="spinner"></span> ' + t + '</div>' : ""; };
  const files = q("kc_files"), go = q("kc_ai");
  if (files) files.onchange = () => { const n = files.files.length; q("kc_fn").textContent = n ? plural(n, "Datei", "Dateien") + " gewählt" : "Fotos/PDF wählen"; go.disabled = !n; };
  if (go) go.onclick = async () => {
    if (KC_BUSY) return; KC_BUSY = true; go.disabled = true; busy("Die KI liest deinen Zettel und schreibt Erklärungen … das dauert bis zu 2 Minuten.");
    try {
      const r = await AI.checklist({ fach: k.fach, thema: k.thema, files: [...files.files].slice(0, 4) });
      const items = (r.items || []).filter(i => i && i.title).map((i, n) => Object.assign({ nr: String(n + 1), area: "", book: [], learn: [], paper: [] }, i, { short: i.short || i.title.slice(0, 40) }));
      if (!items.length) throw Object.assign(new Error("Auf dem Bild war nichts zu erkennen – probier ein schärferes Foto."), { code: "bad_request" });
      await klCheckSave(k.id, { title: r.title || "Checkliste", fach: k.fach, src: "ki", items, st: {}, d: todayISO() });
      toast("✅ Checkliste mit " + items.length + " Punkten erstellt"); kcShow(k);
    } catch (e) { busy(""); go.disabled = false; toast(AI.errorText(e), true); }
    finally { KC_BUSY = false; }
  };
  const tg = q("kc_textgo"); if (tg) tg.onclick = async () => { const items = kcFromText(q("kc_text").value); if (!items.length) return toast("Schreib mindestens einen Punkt (eine Zeile = ein Punkt).", true); await klCheckSave(k.id, { title: "Checkliste", fach: k.fach, src: "text", items, st: {}, d: todayISO() }); toast("✅ Checkliste angelegt"); kcShow(k); };
  const ad = q("kc_add"); if (ad) ad.onclick = () => kcEditModal(k, null);
  const ke = q("kc_edit"); if (ke) ke.onclick = () => kcEditModal(k, ke.dataset.nr);
  const kd = q("kc_del"); if (kd) kd.onclick = async () => { if (!confirm("Diesen Punkt aus deiner Checkliste löschen?")) return; const c = Object.assign({}, klCheck(k.id)); c.items = c.items.filter(i => String(i.nr) !== kd.dataset.nr); await klCheckSave(k.id, c); location.hash = "#/klausur/" + k.id + "?tab=checkliste"; route(); };
  document.querySelectorAll("[data-kcq]").forEach(b => b.onclick = () => { const p = b.dataset.kcq.split(":"); KCQ[p[0] + ":" + p[1]] = p[2] === "show" ? "show" : +p[2]; route(); });
  const qz = q("kc_quiz"); if (qz) qz.onclick = async () => {
    const c = Object.assign({}, klCheck(k.id)); const it = c.items.find(i => String(i.nr) === qz.dataset.nr); qz.disabled = true;
    const qb = q("kc_qbusy"); if (qb) qb.innerHTML = '<div class="kc-wait"><span class="spinner"></span> Claude erstellt Fragen …</div>';
    try {
      const out = [];
      for (let i = 0; i < 3; i++) { const r = await AI.call({ mode: "practice", exam_id: k.id, input: k.fach + " – Checkliste Punkt „" + it.title + "“. Erstelle eine Übung genau zu diesem Punkt" + (out.length ? ", anders als: " + out.map(x => x.question).join(" | ") : "") + "." }); if (r && r.exercise && r.exercise.question) out.push(r.exercise); }
      if (!out.length) throw Object.assign(new Error("Claude hat keine Fragen geliefert."), { code: "bad_request" });
      it.quiz = out; Object.keys(KCQ).filter(x => x.startsWith(it.nr + ":")).forEach(x => delete KCQ[x]);
      c.items = c.items.map(x => x.nr === it.nr ? it : x); await klCheckSave(k.id, c); route();
    } catch (e) { qz.disabled = false; if (qb) qb.innerHTML = ""; toast(AI.errorText(e), true); }
  };
  const rs = q("kc_reset"); if (rs) rs.onclick = async () => { if (!confirm("Checkliste neu anlegen? Die jetzige und deine Häkchen werden ersetzt.")) return; await klCheckSave(k.id, null); route(); };
  document.querySelectorAll("[data-kcst]").forEach(b => b.onclick = async () => { const [nr, v] = b.dataset.kcst.split(":"); const c = Object.assign({}, klCheck(k.id)); c.st = Object.assign({}, c.st); if (c.st[nr] === v) delete c.st[nr]; else c.st[nr] = v; await klCheckSave(k.id, c); route(); });
  const ex = q("kc_explain"); if (ex) ex.onclick = async () => {
    const c = Object.assign({}, klCheck(k.id)); const it = c.items.find(i => String(i.nr) === ex.dataset.nr); ex.disabled = true; busy("Die KI erklärt …");
    try {
      const r = await AI.call({ mode: "explain", exam_id: k.id, input: k.fach + ": " + it.title });
      const paras = String(r.explanation || "").split(/\n\s*\n/).filter(Boolean);
      it.learn = paras.map((t, n) => ({ h: n ? "" : (r.title || it.short), t, f: "", ex: [] })).concat(r.key_points && r.key_points.length ? [{ h: "Merksätze", t: "", f: r.key_points.join(" · "), ex: [] }] : []);
      if (r.check_question) it.paper = (it.paper || []).concat(["Beantworte schriftlich: " + r.check_question]);
      c.items = c.items.map(x => x.nr === it.nr ? it : x); await klCheckSave(k.id, c); route();
    } catch (e) { busy(""); ex.disabled = false; toast(AI.errorText(e), true); }
  };
}

/* ---------- Übungsfragen von Claude je Punkt ---------- */
const KCQ = {};   // Antworten in dieser Sitzung: { "Nr:i": Auswahl | "show" }
function kcQuiz(it) {
  const qs = it.quiz || [];
  if (!qs.length) return '<div class="card"><h2>🧠 Üben</h2><p class="t-sub" style="margin:0 0 10px">Lass dir von Claude Übungsfragen genau zu diesem Punkt erstellen.</p><button class="btn primary" id="kc_quiz" data-nr="' + esc(it.nr) + '">3 Übungsfragen erstellen</button><div id="kc_qbusy"></div></div>';
  return '<div class="card"><div class="km-row-h"><h2 style="margin:0">🧠 Üben</h2><button class="btn sm" id="kc_quiz" data-nr="' + esc(it.nr) + '">Neue Fragen</button></div><div id="kc_qbusy"></div>' + qs.map((x, i) => { const key = it.nr + ":" + i, a = KCQ[key];
    if (x.type === "multiple_choice" && (x.options || []).length) return '<div class="kc-q"><b>' + (i + 1) + '. ' + esc(x.question) + '</b>' + x.options.map((o, j) => '<button class="les-opt' + (a != null ? (j === x.correct_index ? " right" : a === j ? " wrongpick" : "") : "") + '" data-kcq="' + esc(key) + ':' + j + '"' + (a != null ? " disabled" : "") + '>' + esc(o) + '</button>').join("") + (a != null && x.solution ? '<div class="kc-sol">' + mkMd(x.solution) + '</div>' : '') + '</div>';
    return '<div class="kc-q"><b>' + (i + 1) + '. ' + esc(x.question) + '</b><textarea rows="2" placeholder="Deine Antwort (auf Papier geht auch)"></textarea>' + (a === "show" ? '<div class="kc-sol"><b>Lösung:</b> ' + mkMd(x.expected_answer || "") + (x.solution ? '<br>' + mkMd(x.solution) : '') + '</div>' : '<button class="btn sm" data-kcq="' + esc(key) + ':show" style="margin-top:8px">Lösung zeigen</button>') + '</div>'; }).join("") + '</div>';
}
/** Erklär-Blöcke ↔ Text zum Bearbeiten: „# Überschrift“, Text, „= Merkkasten“, „- Beispielschritt“, Leerzeile trennt Blöcke */
const kcLearnText = learn => (learn || []).map(b => [b.h ? "# " + b.h : "", b.t || "", b.f ? "= " + b.f : "", ...(b.ex || []).map(x => "- " + x)].filter(Boolean).join("\n")).join("\n\n");
const kcLearnParse = txt => String(txt || "").split(/\n\s*\n/).map(blk => { const b = { h: "", t: "", f: "", ex: [] }; blk.split("\n").forEach(l => { l = l.trim(); if (!l) return; if (l.startsWith("# ")) b.h = l.slice(2); else if (l.startsWith("= ")) b.f = l.slice(2); else if (/^- /.test(l)) b.ex.push(l.slice(2)); else b.t += (b.t ? " " : "") + l; }); return b; }).filter(b => b.h || b.t || b.f || b.ex.length);
function kcEditModal(k, nr) {
  const c = Object.assign({}, klCheck(k.id)); const it = nr != null ? c.items.find(i => String(i.nr) === String(nr)) : { nr: String(c.items.reduce((m, i) => Math.max(m, parseInt(i.nr, 10) || 0), 0) + 1), area: (c.items[c.items.length - 1] || {}).area || "", short: "", title: "", book: [], learn: [], paper: [] };
  openModal(nr != null ? "Punkt bearbeiten" : "Punkt hinzufügen", '<div class="form"><div class="form c2"><label class="fld">Nr.<input id="ke_nr" value="' + esc(it.nr) + '"></label><label class="fld">Abschnitt<input id="ke_area" value="' + esc(it.area || "") + '" placeholder="z. B. Grammatik"></label></div>' +
    '<label class="fld">Kurztitel<input id="ke_short" value="' + esc(it.short) + '" placeholder="z. B. passé composé mit être"></label><label class="fld">Wortlaut (vom Zettel)<textarea id="ke_title" rows="2">' + esc(it.title) + '</textarea></label>' +
    '<label class="fld">Erklärung<textarea id="ke_learn" rows="7" placeholder="# Überschrift&#10;Erklärung …&#10;= Merkkasten&#10;- Beispiel Schritt 1">' + esc(kcLearnText(it.learn)) + '</textarea><span class="t-sub"># Überschrift · = Merkkasten · - Beispielschritt · Leerzeile = neuer Block</span></label>' +
    '<label class="fld">Aufschreiben (eine Aufgabe pro Zeile)<textarea id="ke_paper" rows="3">' + esc((it.paper || []).join("\n")) + '</textarea></label><label class="fld">Buch (mit Komma trennen)<input id="ke_book" value="' + esc((it.book || []).join(", ")) + '"></label></div>',
    '<button class="btn" id="ke_cancel">Abbrechen</button><button class="btn primary" id="ke_save">Speichern</button>', () => {
      document.getElementById("ke_cancel").onclick = closeModal;
      document.getElementById("ke_save").onclick = async () => {
        const v = id => document.getElementById(id).value.trim(); const title = v("ke_title") || v("ke_short"); if (!title) return toast("Schreib wenigstens einen Titel.", true);
        const row = Object.assign({}, it, { nr: v("ke_nr") || it.nr, area: v("ke_area"), short: v("ke_short") || title.slice(0, 40), title, learn: kcLearnParse(document.getElementById("ke_learn").value), paper: v("ke_paper").split("\n").map(x => x.trim()).filter(Boolean), book: v("ke_book").split(",").map(x => x.trim()).filter(Boolean) });
        c.items = nr != null ? c.items.map(x => String(x.nr) === String(nr) ? row : x) : c.items.concat([row]);
        if (nr != null && String(row.nr) !== String(nr) && c.st && c.st[nr]) { c.st = Object.assign({}, c.st); c.st[row.nr] = c.st[nr]; delete c.st[nr]; }
        await klCheckSave(k.id, c); closeModal(); toast("Gespeichert"); location.hash = "#/klausur/" + k.id + "?tab=checkliste&p=" + encodeURIComponent(row.nr); route();
      };
    });
}

/* ---------- Rechenweg-Check per Foto ---------- */
function rechenwegButton(task, expected, solution) {
  return '<div class="rw-box"><button class="btn rw-btn" data-rw="1" data-task="' + esc(task || "") + '" data-exp="' + esc(expected || "") + '" data-sol="' + esc(solution || "") + '">📷 Rechenweg prüfen lassen</button><span class="t-sub">Foto von deiner Rechnung – die KI zeigt dir die Zeile mit dem Fehler.</span></div>';
}
function bindRechenweg() {
  document.querySelectorAll("[data-rw]").forEach(b => b.onclick = () => rechenwegModal(b.dataset.task, b.dataset.exp, b.dataset.sol));
}
function rechenwegModal(task, expected, solution) {
  openModal("📷 Rechenweg prüfen", (task ? '<div class="rw-task"><span class="t-sub">Aufgabe</span><b>' + esc(task) + '</b></div>' : '<label class="fld">Welche Aufgabe hast du gerechnet?<textarea id="rw_task" rows="2" placeholder="z. B. Löse x² + 2x − 8 = 0"></textarea></label>') +
    '<label class="btn primary lg wide rw-pick">📷 Foto aufnehmen oder wählen<input type="file" id="rw_file" accept="image/*" capture="environment" hidden></label><p class="t-sub">Tipp: gerade von oben, gut beleuchtet, nur diese eine Aufgabe im Bild.</p><div id="rw_out"></div>', "", () => {
    const f = document.getElementById("rw_file"); const out = document.getElementById("rw_out");
    f.onchange = async () => {
      if (!f.files[0]) return; const t = task || (document.getElementById("rw_task") || {}).value || "";
      if (!t.trim()) { toast("Schreib kurz dazu, welche Aufgabe das ist.", true); f.value = ""; return; }
      out.innerHTML = '<div class="kc-wait"><span class="spinner"></span> Die KI liest deinen Rechenweg …</div>';
      try { out.innerHTML = rechenwegResult(await AI.workcheck({ task: t, expected, solution, file: f.files[0] })); }
      catch (e) { out.innerHTML = '<div class="fb bad"><div class="fb-t">' + ICO.x + '<b>' + esc(AI.errorText(e)) + '</b></div></div>'; }
      f.value = "";
    };
  });
}
function rechenwegResult(r) {
  const V = { correct: ["ok", "✅ Weg und Ergebnis stimmen"], partial: ["mid", "🟡 Ansatz richtig – unterwegs ein Fehler"], wrong: ["bad", "❌ Da stimmt etwas Grundlegendes nicht"], unreadable: ["mid", "📷 Nicht lesbar – bitte schärferes Foto"] }[r.verdict] || ["mid", ""];
  return '<div class="rw-res ' + V[0] + '"><b>' + V[1] + '</b>' + (r.summary ? '<p>' + esc(r.summary) + '</p>' : '') + '</div>' +
    ((r.steps || []).length ? '<ol class="rw-steps">' + r.steps.map(s => '<li class="' + (s.ok ? "ok" : "bad") + '"><span>' + (s.ok ? "✓" : "✗") + '</span><div><code>' + esc(s.line) + '</code>' + (s.comment ? '<em>' + esc(s.comment) + '</em>' : '') + '</div></li>').join("") + '</ol>' : '') +
    (r.first_error ? '<div class="rw-err"><b>Erster Fehler:</b> ' + esc(r.first_error) + '</div>' : '') + (r.tip ? '<div class="dr-tip">💡 ' + esc(r.tip) + '</div>' : '');
}
