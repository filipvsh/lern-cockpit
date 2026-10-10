/* =====================================================================
   LERN-COCKPIT · VOKABELTEST
   Ein Vokabeltest ist eine Prüfung (Tabelle „klausuren“) mit fester
   Sammlung, z. B. „Voc. 7A p. 222/223“ am 7. Oktober. Bis zum Termin
   verteilt die App die Wörter auf die Tage (Engine.testQueue), zeigt,
   wie viele sitzen, und bietet einen Probetest mit Zeitlimit.
   ===================================================================== */
const TEST_LANGS = ["Französisch", "Englisch", "Latein", "Spanisch"];
const whenText = d => d === 0 ? "heute" : d === 1 ? "morgen" : "in " + d + " Tagen";

/** Test eintragen / bearbeiten */
function testModal(k, presetCol) {
  const isNew = !k; const col0 = k ? linkedCollections(k)[0] : presetCol ? colById(presetCol) : null;
  const fach0 = k ? k.fach : col0 ? langName(col0.source_language) : "Französisch";
  const cols = () => ES.collections.filter(c => !isTermCollection(c));
  const colOpts = sel => '<option value="__new">Neue Sammlung anlegen</option>' + cols().map(c => '<option value="' + esc(c.id) + '"' + (sel && sel.id === c.id ? " selected" : "") + '>' + esc(c.name) + ' (' + plural(cardsOf(c.id).length, "Karte", "Karten") + ')</option>').join("");
  openModal(isNew ? "Vokabeltest eintragen" : "Vokabeltest bearbeiten",
    '<div class="form"><label class="fld">Was kommt dran?<input id="vt_name" value="' + esc(k ? vtName(k) : col0 ? col0.name : "") + '" placeholder="z. B. Voc. 7A p. 222/223" maxlength="80"></label>' +
    '<div class="form c2"><label class="fld">Fach<select id="vt_fach">' + TEST_LANGS.map(f => '<option' + (f === fach0 ? " selected" : "") + '>' + f + '</option>').join("") + '</select></label><label class="fld">Datum<input id="vt_date" type="date" value="' + esc(k ? k.datum : "") + '"></label></div>' +
    '<label class="fld">Vokabeln aus<select id="vt_col">' + colOpts(col0) + '</select></label>' +
    '<p class="hint">Bis zum Test verteilt die App alle Wörter auf die Tage, fragt falsche öfter ab und sagt dir vorher, wie viel Prozent du im Test voraussichtlich weißt.</p></div>',
    (isNew ? '' : '<button class="btn danger left" id="vt_del">Löschen</button>') + '<button class="btn" id="vt_cancel">Abbrechen</button><button class="btn primary" id="vt_save">' + (isNew ? "Test eintragen" : "Speichern") + '</button>', () => {
      const q = id => document.getElementById(id);
      q("vt_cancel").onclick = closeModal;
      q("vt_save").onclick = async () => {
        const name = val("vt_name"), dt = val("vt_date"), fach = val("vt_fach");
        if (!name) { q("vt_name").focus(); return; }
        if (!dt) { toast("Bitte das Datum des Tests wählen", true); return; }
        const btn = q("vt_save"); btn.classList.add("loading");
        try {
          let col = val("vt_col") === "__new" ? null : colById(val("vt_col"));
          if (!col) {
            const code = LANG_CODE[fach] || "fr";
            let nm = name; let n = 2; while (ES.collections.some(c => c.name.toLowerCase() === nm.toLowerCase())) nm = name + " (" + n++ + ")";
            col = (await dbInsert("vocab_collections", { name: nm, source_language: code, target_language: "de", subject_id: subjectId(fach) })).row;
          }
          const row = { fach, thema: VT_PREFIX + name, datum: dt, vokabel_lektionen: [col.name], description: "Vokabeltest", subject_id: subjectId(fach), halbjahr: hjOf(dt) };
          let id;
          if (isNew) {
            const core = { fach, thema: row.thema, datum: dt, prep: "Nicht begonnen" };
            let r, local = null;
            try { r = await sbInsert("klausuren", Object.assign({ nr: null, dauer: 20, topics_migrated: true }, row, core)); }
            catch (e) { if (e.network) throw e; r = await sbInsert("klausuren", core); local = row; }   // ältere Tabelle ohne Zusatzspalten
            const nk = normKL(Object.assign({}, row, r)); nk.topics_migrated = true; STATE.kl.push(nk); id = nk.id;
            if (local) { Object.assign(nk, local); lsSet("lc_kl_" + id, local); }
          } else {
            await saveKL(k, row); id = k.id;
          }
          bump(); closeModal();
          toast(isNew ? "Vokabeltest eingetragen" : "Gespeichert");
          if (ROUTE.name === "lernplan" && String(ROUTE.sub) === String(id)) route(); else location.hash = "#/lernplan/" + id;
          if (isNew && !cardsOf(col.id).length) setTimeout(() => importModal(col.id), 150);
        } catch (e) { btn.classList.remove("loading"); toast(e.network ? "Keine Verbindung – der Test wurde nicht gespeichert." : "Speichern fehlgeschlagen: " + e.message, true); }
      };
      const d = q("vt_del"); if (d) d.onclick = async () => {
        if (!confirm("Vokabeltest löschen? Die Vokabeln selbst bleiben in der Sammlung.")) return;
        try { await sbDelete("klausuren", k.id); STATE.kl = STATE.kl.filter(x => x.id !== k.id); bump(); closeModal(); location.hash = "#/lernplan"; toast("Test gelöscht"); }
        catch (e) { toast("Löschen fehlgeschlagen: " + e.message, true); }
      };
      setTimeout(() => q(k ? "vt_date" : "vt_name").focus(), 50);
    });
}

/** Ganze Vokabelliste auf einmal einfügen */
function importModal(colId) {
  const col = colById(colId); if (!col) return;
  let swap = false;
  const parsed = () => {
    const r = Engine.parseVocabList(document.getElementById("im_txt").value);
    const items = r.items.map(x => swap ? { begriff: x.bedeutung, bedeutung: x.begriff } : x);
    const have = new Set(cardsOf(col.id).map(v => Engine.normalize(v.begriff)));
    const seen = new Set(); const fresh = [], dup = [];
    items.forEach(x => { const n = Engine.normalize(x.begriff); if (have.has(n) || seen.has(n)) dup.push(x); else { seen.add(n); fresh.push(x); } });
    return { fresh, dup, skipped: r.skipped };
  };
  const src = langName(col.source_language), tgt = langName(col.target_language);
  const preview = () => {
    const p = parsed(); const el = document.getElementById("im_prev"); const go = document.getElementById("im_go");
    go.disabled = !p.fresh.length; go.textContent = p.fresh.length ? plural(p.fresh.length, "Vokabel", "Vokabeln") + " hinzufügen" : "Hinzufügen";
    el.innerHTML = (p.fresh.length ? '<div class="list" style="max-height:220px;overflow:auto">' + p.fresh.slice(0, 200).map(x => '<div class="vrow" style="grid-template-columns:1fr 1fr"><span class="vt">' + esc(x.begriff) + '</span><span class="vb">' + esc(x.bedeutung) + '</span></div>').join("") + '</div>' : '') +
      '<p class="hint" style="margin-top:var(--s3)">' + (p.fresh.length ? plural(p.fresh.length, "Vokabel erkannt", "Vokabeln erkannt") : "Noch nichts erkannt") +
      (p.dup.length ? " · " + plural(p.dup.length, "ist schon drin", "sind schon drin") : "") +
      (p.skipped.length ? ' · <span style="color:var(--orange)">' + plural(p.skipped.length, "Zeile", "Zeilen") + ' ohne Trenner: „' + esc(p.skipped.slice(0, 2).join("“, „")) + '“</span>' : "") + '</p>';
  };
  openModal("Liste einfügen · " + esc(col.name),
    '<p class="hint">Eine Vokabel pro Zeile, links ' + esc(src) + ', rechts ' + esc(tgt) + '. Trenne mit Tab, „ - “, „ = “ oder „;“. Mehrere richtige Übersetzungen mit Komma oder „/“.</p>' +
    '<textarea id="im_txt" style="min-height:180px;font-family:var(--mono, ui-monospace, monospace);font-size:14px" placeholder="la rentrée - der Schulbeginn&#10;le/la prof - der/die Lehrer/in&#10;avoir peur de qc = Angst haben vor etw."></textarea>' +
    '<label class="trck" style="margin-top:var(--s3)"><input type="checkbox" id="im_swap"> Meine Liste steht andersherum (' + esc(tgt) + ' links)</label><div id="im_prev"></div>',
    '<button class="btn" id="im_cancel">Abbrechen</button><button class="btn primary" id="im_go" disabled>Hinzufügen</button>', () => {
      const q = id => document.getElementById(id);
      q("im_cancel").onclick = closeModal;
      q("im_txt").oninput = debounce(preview, 150);
      q("im_swap").onchange = e => { swap = e.target.checked; preview(); };
      q("im_go").onclick = async () => {
        const p = parsed(); if (!p.fresh.length) return;
        const btn = q("im_go"); btn.classList.add("loading");
        const rows = p.fresh.map(x => ({ begriff: x.begriff, bedeutung: x.bedeutung, sprache: col.name, collection_id: col.id, source_language: col.source_language, target_language: col.target_language, subject_id: col.subject_id || null, level: 0, next: todayISO(), alternatives: [] }));
        try {
          for (let i = 0; i < rows.length; i += 100) {
            const part = rows.slice(i, i + 100); const r = await Api.insert("vokabeln", part);
            (Array.isArray(r) && r.length ? r : part).forEach(x => STATE.vo.push(normVO(x)));
          }
          bump(); closeModal(); route(); toast(plural(rows.length, "Vokabel", "Vokabeln") + " hinzugefügt");
        } catch (e) { btn.classList.remove("loading"); bump(); toast(e.network ? "Keine Verbindung – die Liste wurde nicht gespeichert. Der Text bleibt im Feld." : "Speichern fehlgeschlagen: " + e.message, true); }
      };
      setTimeout(() => q("im_txt").focus(), 50);
    });
}

/** Ablauf bis zum Test: wie viele neue Wörter an welchem Tag (Schätzung nach heutigem Stand) */
function testSchedule(k) {
  const d = daysUntil(k.datum); let unseen = testStatusOf(k).unseen; const out = [];
  for (let i = 0; i <= d; i++) {
    const left = d - i; const date = addDays(todayISO(), i);
    if (left === 0) { out.push({ date, label: "Test", sub: "Kurz vorher alles einmal durchgehen" }); break; }
    if (left === 1) { out.push({ date, label: "Alles wiederholen + Probetest", sub: "Jede Vokabel noch einmal – unsichere zuerst" }); continue; }
    const n = Engine.testNewQuota(unseen, left); unseen -= n;
    out.push({ date, label: n ? plural(n, "neue Vokabel", "neue Vokabeln") + (i ? " + Wiederholung" : "") : "Wiederholung", sub: n ? "Falsche kommen nach 10 Minuten noch einmal" : "Was fällig ist und was noch nicht sitzt" });
  }
  return out;
}
function testWordRow(v, k) {
  const p = Math.round(Engine.recallProbability(v, testDayMs(k)) * 100);
  const st = Engine.isNew(v) ? ["noch nicht gelernt", "var(--text-3)"] : v.last_result === "wrong" ? ["zuletzt falsch", "var(--orange)"] : Engine.isTestSecure(v, testDayMs(k)) ? ["sitzt · " + p + " % am Testtag", "var(--green)"] : [p + " % am Testtag", "var(--accent)"];
  const sg = Engine.stageOf(v);
  return '<button class="vrow" data-editvo="' + esc(v.id) + '"><span class="vt">' + esc(v.begriff) + '</span><span class="vb">' + esc(v.bedeutung) + '</span><span class="t-cap vstat" style="color:' + st[1] + '">' + st[0] + '</span><span class="stage ' + sg.key + '">' + sg.label + '</span></button>';
}
function testDetail(k) {
  const d = daysUntil(k.datum), past = d < 0 || k.punkte != null;
  const col = linkedCollections(k)[0] || null; const cards = testCards(k); const st = testStatusOf(k);
  const q = past ? [] : testQueueOf(k); const dir = testDir(k.id);
  const head = '<a class="backlink" href="#/lernplan">' + ICO.back + 'Lernplan</a><div class="topic-head"><div style="min-width:0"><div class="eyebrow"><span class="dot" style="background:' + fcol(k.fach) + ';margin-right:6px"></span>' + esc(k.fach) + ' · Vokabeltest</div><h1 class="t-large">' + esc(vtName(k)) + '</h1><div class="meta">' + esc(fmtDL(k.datum)) + (col ? ' · Sammlung <a href="#/vokabeln/' + esc(col.id) + '">' + esc(col.name) + '</a>' : '') + '</div>' +
    '<div class="ph-actions">' + (!past && cards.length ? '<button class="btn primary" id="vt_learn">' + ICO.play + (q.length ? "Heute lernen · " + plural(q.length, "Karte", "Karten") : "Zusatzrunde") + '</button><button class="btn" id="vt_probe">' + ICO.clock + 'Probetest</button>' : '') + '<button class="btn" id="vt_edit">Bearbeiten</button></div></div>' +
    '<div class="topic-stats">' + (past ? '<div class="stat"><div class="num">' + (k.punkte != null ? k.punkte : "—") + '</div><small>Punkte</small></div>' : '<div class="stat"><div class="num">' + d + '</div><small>' + (d === 1 ? "Tag" : "Tage") + ' bis zum Test</small></div>' + (cards.length ? '<div class="stat">' + ring((st.expected || 0) / 100, 88, 7, (st.expected == null ? "—" : st.expected + "%"), "erwartet") + '</div>' : '')) + '</div></div>';
  if (!cards.length) return netNotice() + head + '<div class="card">' + emptyState("vokabeln", "Trag die Vokabeln ein", "Am schnellsten: die ganze Liste auf einmal einfügen – eine Vokabel pro Zeile, z. B. „la rentrée - der Schulbeginn“.", (col ? '<button class="btn primary sm" id="vt_import">Liste einfügen</button> <button class="btn sm" id="vt_add">Einzeln hinzufügen</button>' : '<button class="btn primary sm" id="vt_newlist">Liste einfügen</button> <button class="btn sm" id="vt_edit2">Vorhandene Sammlung wählen</button>')) + '</div>';
  const status = past ? '' : '<div class="notice"><span class="dot" style="background:' + (q.length ? "var(--accent)" : "var(--green)") + '"></span><span>' + (q.length ? '<b>Heute:</b> ' + [q.filter(Engine.isNew).length ? plural(q.filter(Engine.isNew).length, "neue Vokabel", "neue Vokabeln") : "", q.filter(c => !Engine.isNew(c)).length ? plural(q.filter(c => !Engine.isNew(c)).length, "Wiederholung", "Wiederholungen") : ""].filter(Boolean).join(" und ") + '. ' : '<b>Für heute erledigt.</b> ') + (st.expected == null ? "Noch keine Vorhersage – lern die ersten Wörter." : 'Wenn der Test so wäre wie jetzt, wüsstest du etwa <b>' + st.expected + ' %</b> der Wörter. ' + st.secure + ' von ' + st.total + ' sitzen sicher (≥ 90 % am Testtag)') + (st.wrong ? ', ' + st.wrong + ' zuletzt falsch' : '') + '.</span></div>';
  const dirSw = '<div class="dirsw" style="margin-bottom:var(--s4)"><span class="t-sub">Abfrage</span><div class="seg"><button class="' + (dir === "reverse" ? "on" : "") + '" data-vtdir="reverse">' + esc(dirLabel(col, "reverse")) + '</button><button class="' + (dir === "forward" ? "on" : "") + '" data-vtdir="forward">' + esc(dirLabel(col, "forward")) + '</button><button class="' + (dir === "both" ? "on" : "") + '" data-vtdir="both" title="Beide Richtungen gemischt">Beide ⇄</button></div></div>';
  const sched = past ? '' : '<div>' + sectionHead("Bis zum Test") + '<div class="card"><div class="tl">' + testSchedule(k).map((s, i) => '<div class="tls ' + (i === 0 ? "now" : "") + '"><div class="d">' + (i === 0 ? "Heute · " : "") + esc(fmtD(s.date)) + '</div><div class="x">' + esc(s.label) + '</div><div class="y">' + esc(s.sub) + '</div></div>').join("") + '</div></div></div>';
  const tday = testDayMs(k);
  const order = cards.slice().sort((a, b) => ((b.last_result === "wrong") - (a.last_result === "wrong")) || (Engine.recallProbability(a, tday) - Engine.recallProbability(b, tday)));
  const words = '<div class="section" style="margin-top:0">' + sectionHead("Vokabeln <span class=\"t-sub\" style=\"font-weight:400\">' + cards.length + '</span>", col ? '<span style="display:flex;gap:var(--s4)"><button class="shl" id="vt_import">Liste einfügen</button><button class="shl" id="vt_add">Einzeln hinzufügen</button></span>' : '') + dirSw + '<div class="list">' + order.map(v => testWordRow(v, k)).join("") + '</div></div>';
  const danger = '<div style="text-align:center;padding:var(--s3)"><button class="btn plain sm" id="vt_del2" style="color:var(--red)">Test löschen</button></div>';
  return netNotice() + head + status + '<div class="grid main-aside"><div style="min-width:0">' + words + '</div><div class="stack" style="min-width:0">' + sched + danger + '</div></div>';
}
function probeModal(k) {
  const n = testCards(k).length; let min = Math.max(5, Math.min(30, Math.round(n * 0.35 / 5) * 5 || 10));
  const body = () => '<p class="hint">Wie in der Schule: ' + esc(dirLabel(linkedCollections(k)[0], testDir(k.id))) + ', alle ' + n + ' Vokabeln in zufälliger Reihenfolge, ohne Rückmeldung zwischendurch. Am Ende siehst du dein Ergebnis und welche Wörter du noch üben solltest.</p><label class="fld">Zeit<div class="seg full">' + [10, 15, 20, 30].map(m => '<button data-pm="' + m + '" class="' + (min === m ? "on" : "") + '">' + m + ' Min.</button>').join("") + '</div></label>';
  openModal("Probetest", '<div id="pm_body">' + body() + '</div>', '<button class="btn" id="pm_cancel">Abbrechen</button><button class="btn primary" id="pm_go">' + ICO.play + 'Probetest starten</button>', () => {
    const bind = () => document.querySelectorAll("[data-pm]").forEach(b => b.onclick = () => { min = +b.dataset.pm; document.getElementById("pm_body").innerHTML = body(); bind(); });
    bind();
    document.getElementById("pm_cancel").onclick = closeModal;
    document.getElementById("pm_go").onclick = () => startTraining({ mode: "testexam", exam_id: k.id, minutes: min });
  });
}
/** Test ohne Sammlung: Sammlung mit dem Namen des Tests anlegen, verknüpfen, Liste einfügen */
async function startTestImport(k) {
  let col = linkedCollections(k)[0];
  if (!col) {
    const code = LANG_CODE[k.fach] || "fr"; const base = vtName(k).slice(0, 70);
    let nm = base, n = 2; while (ES.collections.some(c => c.name.toLowerCase() === nm.toLowerCase())) nm = base + " (" + n++ + ")";
    try { col = (await dbInsert("vocab_collections", { name: nm, source_language: code, target_language: "de", subject_id: subjectId(k.fach) })).row; await saveKL(k, { vokabel_lektionen: [col.name] }); bump(); route(); }
    catch (e) { toast("Sammlung konnte nicht angelegt werden: " + e.message, true); return; }
  }
  if (!cardsOf(col.id).length) importModal(col.id);
}
function bindTestDetail(k) {
  const nl = document.getElementById("vt_newlist"); if (nl) nl.onclick = () => startTestImport(k);
  const q = id => document.getElementById(id); const col = linkedCollections(k)[0] || null;
  ["vt_edit", "vt_edit2"].forEach(id => { const b = q(id); if (b) b.onclick = () => testModal(k); });
  const l = q("vt_learn"); if (l) l.onclick = () => startTraining({ mode: "test", exam_id: k.id, planKey: "test:" + k.id });
  const p = q("vt_probe"); if (p) p.onclick = () => probeModal(k);
  document.querySelectorAll("#vt_import").forEach(b => b.onclick = () => importModal(col.id));
  document.querySelectorAll("#vt_add").forEach(b => b.onclick = () => vocabModal(null, col.id));
  document.querySelectorAll("[data-vtdir]").forEach(b => b.onclick = () => { lsSet("lc_vtdir_" + k.id, b.dataset.vtdir); route(); });
  document.querySelectorAll("[data-editvo]").forEach(b => b.onclick = () => { const v = STATE.vo.find(x => String(x.id) === b.dataset.editvo); if (v) vocabModal(v); });
  const d = q("vt_del2"); if (d) d.onclick = async () => {
    if (!confirm("Vokabeltest löschen? Die Vokabeln selbst bleiben in der Sammlung.")) return;
    try { await sbDelete("klausuren", k.id); STATE.kl = STATE.kl.filter(x => x.id !== k.id); bump(); location.hash = "#/lernplan"; toast("Test gelöscht"); }
    catch (e) { toast("Löschen fehlgeschlagen: " + e.message, true); }
  };
}
