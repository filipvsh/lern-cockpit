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
  const c = klCheck(k.id); if (!c && /Mathe/.test(k.fach) && typeof MC !== "undefined") return "";
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
    '<div class="kc-foot"><span class="t-sub">' + (c.src === "ki" ? "Von der KI aus deinem Zettel erstellt – prüfe die Punkte kurz." : "Selbst eingetippt.") + '</span><button class="btn sm" id="kc_reset">Neu anlegen</button></div>';
}
function kcItem(k, c, it) {
  const st = (c.st || {})[it.nr]; const i = c.items.indexOf(it), prev = c.items[i - 1], next = c.items[i + 1];
  const base = "#/klausur/" + esc(k.id) + "?tab=checkliste";
  const learn = (it.learn || []).map(b => '<div class="ck-b">' + (b.h ? '<h3>' + esc(b.h) + '</h3>' : '') + (b.t ? '<p>' + mkMd(b.t) + '</p>' : '') + (b.f ? '<div class="ck-f">' + mkMd(b.f) + '</div>' : '') + (b.ex && b.ex.length ? '<div class="ck-ex"><span>Beispiel</span><ol>' + b.ex.map(x => '<li>' + mkMd(x) + '</li>').join("") + '</ol></div>' : '') + '</div>').join("");
  const paper = (it.paper || []).concat((it.book || []).length ? ["**Buch:** " + it.book.join(" · ")] : []);
  return '<a class="backlink" href="' + base + '">' + ICO.back + 'Checkliste</a><div class="dr-head">' + (it.area ? '<div class="ck-area-l">' + esc(it.area) + ' · Punkt ' + esc(it.nr) + '</div>' : '<div class="ck-area-l">Punkt ' + esc(it.nr) + '</div>') + '<h1 class="t-large ck-h">' + esc(it.short) + '</h1>' + (it.title !== it.short ? '<div class="ck-quote">„' + esc(it.title) + '“</div>' : '') + '</div>' +
    '<div class="card ck-self"><b>Wie sicher bist du?</b><div class="seg">' + KC_ST.map(([s, ic, l]) => '<button class="' + (st === s ? "on" : "") + '" data-kcst="' + esc(it.nr) + ':' + s + '">' + ic + ' ' + l + '</button>').join("") + '</div></div>' +
    (learn ? '<div class="card ck-learn"><h2>📖 Erklärung</h2>' + learn + '</div>' : '<div class="card ck-learn"><h2>📖 Erklärung</h2><p class="t-sub" style="margin:0 0 10px">Zu diesem Punkt gibt es noch keine Erklärung.</p><button class="btn primary" id="kc_explain" data-nr="' + esc(it.nr) + '">🤖 Von der KI erklären lassen</button><div id="kc_busy"></div></div>') +
    (paper.length ? '<div class="card ck-paper"><h2>✍️ Auf Papier / iPad</h2><ul>' + paper.map(x => '<li>' + mkMd(x) + '</li>').join("") + '</ul></div>' : '') +
    '<div class="ck-nav">' + (prev ? '<a class="btn" href="' + base + '&p=' + encodeURIComponent(prev.nr) + '">← ' + esc(prev.nr) + ' · ' + esc(prev.short) + '</a>' : '<span></span>') + (next ? '<a class="btn" href="' + base + '&p=' + encodeURIComponent(next.nr) + '">' + esc(next.nr) + ' · ' + esc(next.short) + ' →</a>' : '') + '</div>';
}
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
      toast("✅ Checkliste mit " + items.length + " Punkten erstellt"); route();
    } catch (e) { busy(""); go.disabled = false; toast(AI.errorText(e), true); }
    finally { KC_BUSY = false; }
  };
  const tg = q("kc_textgo"); if (tg) tg.onclick = async () => { const items = kcFromText(q("kc_text").value); if (!items.length) return toast("Schreib mindestens einen Punkt (eine Zeile = ein Punkt).", true); await klCheckSave(k.id, { title: "Checkliste", fach: k.fach, src: "text", items, st: {}, d: todayISO() }); toast("✅ Checkliste angelegt"); route(); };
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
