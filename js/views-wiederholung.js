/* =====================================================================
   LERN-COCKPIT · WIEDERHOLUNG
   Arbeiten im Nachhinein verstehen: Klausur-Archiv (PDF/Foto über das
   Material), Fehleranalyse pro Arbeit, Erklärungen, Videos und ein
   Lern-Modus, der Fehler einzeln durchgeht.
   Routen:  #/wiederholung              Übersicht + Archiv
            #/wiederholung/<id>         eine Arbeit
            #/wiederholung/<id>?modus=1 Lern-Modus (Fehler einzeln)
   Daten:   Einstellung „wiederholung“ = { entries: [ … ] }  (Format: docs/REGELN.md)
   Ohne neue Tabelle: nur Einstellungen + Material (Migration 006).
   ===================================================================== */
const WD_KEY = "wiederholung";
const WD = { open: {}, shown: false };
const wdAll = () => { const d = setting(WD_KEY, null); return d && Array.isArray(d.entries) ? d : { entries: [] }; };
const wdById = id => wdAll().entries.find(e => e.id === id);
const wdNl = t => esc(t || "").replace(/\n/g, "<br>");
const wdOk = e => (e.fehler || []).filter(f => f.status === 1).length;
const wdArchiv = () => (typeof ES !== "undefined" && ES.docs && typeof materialReady === "function" && materialReady()) ? ES.docs.filter(d => /^klausur/i.test(d.title || "")) : [];
const wdHref = (e, q) => "#/wiederholung/" + encodeURIComponent(e.id) + (q || "");
async function wdUpdate(fn) { const d = JSON.parse(JSON.stringify(wdAll())); fn(d); await setSetting(WD_KEY, d); route(); }
const wdStat = (id, fid) => { const e = wdById(id); return e ? (e.fehler || []).find(f => f.id === fid) : null; };

/* ---------- Übersicht ---------- */
V.wiederholung = () => {
  if (ROUTE.sub) {
    const e = wdById(ROUTE.sub);
    if (!e) return pageHead("Wiederholung", { back: ["#/wiederholung", "Wiederholung"] }) + '<div class="card">' + emptyState("info", "Nicht gefunden", "Diese Analyse gibt es nicht (mehr).") + '</div>';
    return ROUTE.query.modus ? wdModus(e) : wdEntry(e);
  }
  const d = wdAll(), docs = wdArchiv();
  const canUp = typeof materialReady === "function" && materialReady();
  const head = pageHead("Wiederholung", { sub: "Arbeiten nachbereiten: Fehler verstehen, Erklärungen lesen, Videos schauen, nochmal üben.", actions: '<button class="btn" id="wd_import">Analyse einfügen</button>' + (canUp ? '<button class="btn primary" id="wd_up">' + ICO.plus + 'Klausur hochladen</button>' : "") });
  const cards = d.entries.slice().sort((a, b) => (a.datum || "") < (b.datum || "") ? 1 : -1).map(e => {
    const n = (e.fehler || []).length, ok = wdOk(e);
    return '<a class="card wd-card" href="' + wdHref(e) + '"><span class="dot" style="background:' + fcol(e.fach) + '"></span><div class="wd-main"><b>' + esc(e.fach) + " · " + esc(e.titel) + '</b><span class="t-sub">' + (e.datum ? esc(fmtD(e.datum)) + " · " : "") + (e.note ? "Note " + esc(e.note) + " · " : "") + ok + " von " + n + ' Fehlern verstanden</span><div class="wd-bar"><i style="width:' + (n ? Math.round(ok / n * 100) : 0) + '%"></i></div></div><span class="chev">' + ICO.chev + "</span></a>";
  }).join("");
  const known = new Set(d.entries.map(e => e.klausur_id).filter(Boolean));
  const todo = (typeof pastKL === "function" ? pastKL() : []).filter(k => k.punkte != null && !known.has(k.id) && !d.entries.some(e => e.fach === k.fach && e.datum === k.datum)).slice(0, 6);
  const todoHtml = todo.length ? '<div class="section">' + sectionHead("Noch ohne Analyse") + '<div class="list">' + todo.map(k => '<div class="li"><div class="li-main"><div class="li-title">' + esc(k.fach) + " · " + esc(typeof klTitle === "function" ? klTitle(k) : (k.thema || "Klausur")) + '</div><div class="li-sub">' + esc(fmtD(k.datum)) + " · Note " + PT_NOTE[k.punkte] + '</div></div></div>').join("") + "</div></div>" : "";
  const arch = canUp ? '<div class="section">' + sectionHead("Klausur-Archiv") + (docs.length ? '<div class="doc-grid">' + docs.map(docTile).join("") + "</div>" : '<div class="card">' + emptyState("doc", "Noch keine Klausur hochgeladen", "Lade deine Arbeit als PDF oder Foto hoch. Der Titel beginnt dann mit „Klausur“ und erscheint hier.", '<button class="btn primary sm" id="wd_up2">Klausur hochladen</button>') + "</div>") + "</div>" : "";
  const how = '<div class="card wd-how"><h2>So kommt eine Arbeit rein</h2><ol class="steps"><li>Klausur hier hochladen (Archiv) und im Claude-Projekt „Schule“ schicken.</li><li>Claude schreibt dir die Fehleranalyse mit Erklärungen und Videos.</li><li>Hier auf <b>Analyse einfügen</b> tippen und den Text einfügen. Danach: Lern-Modus.</li></ol></div>';
  return netNotice() + head + (cards ? '<div class="section">' + sectionHead("Meine Arbeiten") + cards + "</div>" : '<div class="card">' + emptyState("check", "Noch keine Analyse", "Sobald Claude eine Arbeit analysiert hat, fügst du sie hier ein.") + "</div>") + todoHtml + arch + how;
};

/* ---------- Eine Arbeit ---------- */
function wdEntry(e) {
  const fs = e.fehler || [], n = fs.length, ok = wdOk(e), open = n - ok;
  const vids = (e.themen || []).flatMap(t => t.videos || []); const vd = vids.filter(v => v.done).length;
  const head = pageHead(esc(e.fach) + " · " + esc(e.titel), { back: ["#/wiederholung", "Wiederholung"], sub: wdNl(e.fazit), actions: open ? '<a class="btn primary" href="' + wdHref(e, "?modus=1") + '">Lern-Modus · ' + open + " offen</a>" : "" });
  const kpi = '<div class="grid three"><div class="card"><h2>Ergebnis</h2><div class="pbig" style="font-size:36px">' + (e.punkte != null ? e.punkte : "–") + '</div><div class="sm">Punkte' + (e.note ? " · Note " + esc(e.note) : "") + '</div></div><div class="card"><h2>Fehler</h2><div class="pbig" style="font-size:36px">' + ok + "/" + n + '</div><div class="sm">verstanden</div></div><div class="card"><h2>Videos</h2><div class="pbig" style="font-size:36px">' + vd + "/" + vids.length + '</div><div class="sm">geschaut</div></div></div>';
  const ST = { 0: "○", 1: "✓", 2: "↻" };
  const fl = fs.map(f => '<details class="card wd-f" data-wdk="' + esc(e.id + "|" + f.id) + '"' + (WD.open[e.id + "|" + f.id] ? " open" : "") + '><summary><span class="wd-st s' + (f.status || 0) + '">' + ST[f.status || 0] + '</span><b>' + esc(f.aufgabe || "Aufgabe") + "</b>" + (f.thema ? '<span class="t-sub"> · ' + esc(f.thema) + "</span>" : "") + "</summary>" +
    '<div class="wd-body">' + (f.was ? "<h4>Was passiert ist</h4><p>" + wdNl(f.was) + "</p>" : "") + (f.richtig ? "<h4>So geht es richtig</h4><p>" + wdNl(f.richtig) + "</p>" : "") + (f.tipp ? '<h4>Merke dir</h4><p class="wd-tip">' + wdNl(f.tipp) + "</p>" : "") +
    '<div class="wd-btns"><button class="btn sm' + (f.status === 1 ? " primary" : "") + '" data-wdst="' + esc(e.id + "|" + f.id + "|1") + '">✓ Verstanden</button><button class="btn sm' + (f.status === 2 ? " primary" : "") + '" data-wdst="' + esc(e.id + "|" + f.id + "|2") + '">↻ Nochmal üben</button><button class="btn sm" data-wdst="' + esc(e.id + "|" + f.id + "|0") + '">Zurücksetzen</button></div></div></details>').join("");
  const th = (e.themen || []).map((t, ti) => '<div class="card wd-t"><h2>' + esc(t.titel) + "</h2>" + (t.text ? "<p>" + wdNl(t.text) + "</p>" : "") +
    ((t.videos || []).length ? "<h4>Videos</h4>" + t.videos.map((v, vi) => '<label class="wd-v"><input type="checkbox" data-wdv="' + esc(e.id + "|" + ti + "|" + vi) + '"' + (v.done ? " checked" : "") + '><a href="' + (v.id ? "https://www.youtube.com/watch?v=" + encodeURIComponent(v.id) : "https://www.youtube.com/results?search_query=" + encodeURIComponent(v.q || v.t || "")) + '" target="_blank" rel="noopener">' + esc(v.t || "Video") + (v.id ? "" : " 🔎") + "</a></label>").join("") : "") +
    ((t.links || []).length ? "<h4>Zum Nachlesen</h4>" + t.links.map(l => '<div class="wd-v"><a href="' + esc(l.u) + '" target="_blank" rel="noopener">' + esc(l.t || l.u) + "</a></div>").join("") : "") + "</div>").join("");
  return netNotice() + head + kpi + (fs.length ? '<div class="section">' + sectionHead("Fehlerliste") + fl + "</div>" : "") + (th ? '<div class="section">' + sectionHead("Erklärungen und Videos") + th + "</div>" : "");
}

/* ---------- Lern-Modus: Fehler einzeln ---------- */
function wdModus(e) {
  const back = '<a class="backlink" href="' + wdHref(e) + '">' + ICO.back + "Zur Übersicht</a>";
  const fs = e.fehler || [], q = fs.filter(f => f.status !== 1).sort((a, b) => (a.status || 0) - (b.status || 0));
  if (!q.length) return back + '<div class="card ck-done">🎉 <b>Alles verstanden!</b> Schau in ein paar Tagen noch einmal rein und rechne die Aufgaben ohne Lösung nach.</div>';
  const f = q[0], ok = wdOk(e);
  return back + '<div class="wd-prog"><span class="t-sub">' + ok + " von " + fs.length + ' verstanden · noch ' + q.length + '</span><div class="wd-bar"><i style="width:' + Math.round(ok / fs.length * 100) + '%"></i></div></div>' +
    '<div class="card wd-fc"><span class="eyebrow">' + esc(f.aufgabe || "") + (f.thema ? " · " + esc(f.thema) : "") + "</span><h2>Was ist hier schiefgegangen?</h2><p>" + wdNl(f.was) + "</p>" +
    (WD.shown ? '<h4>So geht es richtig</h4><p>' + wdNl(f.richtig) + "</p>" + (f.tipp ? '<p class="wd-tip">' + wdNl(f.tipp) + "</p>" : "") + '<div class="wd-btns"><button class="btn primary" id="wd_ok">✓ Verstanden</button><button class="btn" id="wd_again">↻ Nochmal später</button></div>'
      : '<p class="hint">Rechne oder schreibe es erst selbst auf Papier. Dann aufdecken.</p><button class="btn primary" id="wd_show">Lösung aufdecken</button>') + "</div>";
}

/* ---------- Analyse einfügen ---------- */
function wdImportModal() {
  openModal("Analyse einfügen", '<p class="hint" style="margin-bottom:var(--s3)">Füge den JSON-Text ein, den Claude dir zur Arbeit geschrieben hat. Gleiche Arbeiten werden aktualisiert, dein Fortschritt bleibt erhalten.</p><textarea id="wd_json" style="min-height:220px;width:100%;font-family:monospace;font-size:12px" placeholder="{ &quot;fach&quot;: &quot;Mathe&quot;, &quot;titel&quot;: &quot;…&quot;, &quot;fehler&quot;: [ … ] }"></textarea>',
    '<button class="btn" id="wd_cancel">Abbrechen</button><button class="btn primary" id="wd_go">Importieren</button>', () => {
      document.getElementById("wd_cancel").onclick = closeModal;
      document.getElementById("wd_go").onclick = async () => {
        let j; try { j = JSON.parse(document.getElementById("wd_json").value.trim().replace(/^```(json)?|```$/g, "")); } catch (err) { toast("Das ist kein gültiger JSON-Text.", true); return; }
        const list = Array.isArray(j) ? j : Array.isArray(j.entries) ? j.entries : [j];
        if (!list.every(x => x && x.fach && x.titel && Array.isArray(x.fehler))) { toast("Pflichtfelder: fach, titel, fehler[]", true); return; }
        closeModal();
        await wdUpdate(d => list.forEach(x => {
          x.id = x.id || (typeof slug === "function" ? slug(x.fach + " " + x.titel + " " + (x.datum || "")) : String(Date.now()));
          x.fehler.forEach((f, i) => { f.id = f.id || "f" + (i + 1); f.status = f.status || 0; });
          const old = d.entries.find(o => o.id === x.id);
          if (old) x.fehler.forEach(f => { const of_ = (old.fehler || []).find(o => o.id === f.id); if (of_ && of_.status) f.status = of_.status; });
          (x.themen || []).forEach((t, ti) => (t.videos || []).forEach((v, vi) => { const ov = old && old.themen && old.themen[ti] && old.themen[ti].videos && old.themen[ti].videos[vi]; if (ov && (ov.id || ov.q) === (v.id || v.q) && ov.done) v.done = true; }));
          const i = d.entries.findIndex(o => o.id === x.id); if (i >= 0) d.entries[i] = x; else d.entries.push(x);
        }));
        toast(list.length + (list.length === 1 ? " Analyse gespeichert" : " Analysen gespeichert"));
      };
    });
}

function bindWiederholung() {
  const q = id => document.getElementById(id);
  if (q("wd_import")) q("wd_import").onclick = wdImportModal;
  ["wd_up", "wd_up2"].forEach(id => { if (q(id)) q(id).onclick = () => uploadModal({ title: "Klausur " }); });
  document.querySelectorAll("details[data-wdk]").forEach(d => d.ontoggle = () => { WD.open[d.dataset.wdk] = d.open; });
  document.querySelectorAll("[data-wdst]").forEach(b => b.onclick = () => { const [eid, fid, st] = b.dataset.wdst.split("|"); wdUpdate(d => { const f = d.entries.find(e => e.id === eid).fehler.find(x => x.id === fid); f.status = +st; }); });
  document.querySelectorAll("[data-wdv]").forEach(c => c.onchange = () => { const [eid, ti, vi] = c.dataset.wdv.split("|"); wdUpdate(d => { const v = d.entries.find(e => e.id === eid).themen[+ti].videos[+vi]; v.done = c.checked; }); });
  const e = ROUTE.sub ? wdById(ROUTE.sub) : null;
  if (e && ROUTE.query.modus) {
    const cur = (e.fehler || []).filter(f => f.status !== 1).sort((a, b) => (a.status || 0) - (b.status || 0))[0];
    if (q("wd_show")) q("wd_show").onclick = () => { WD.shown = true; route(); };
    if (q("wd_ok")) q("wd_ok").onclick = () => { WD.shown = false; wdUpdate(d => { d.entries.find(x => x.id === e.id).fehler.find(f => f.id === cur.id).status = 1; }); };
    if (q("wd_again")) q("wd_again").onclick = () => { WD.shown = false; wdUpdate(d => { d.entries.find(x => x.id === e.id).fehler.find(f => f.id === cur.id).status = 2; }); };
  }
}
