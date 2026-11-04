/* =====================================================================
   LERN-COCKPIT · FÄCHER
   #/faecher        alle Fächer des Halbjahrs: nächste Klausur, offene
                    Aufgaben, Fehler, Schnitt – Fächer mit Klausur zuerst
   #/fach/<Fach>    ein Fach = eine Seite: Klausur-Modus, Kurs/Checkliste,
                    Fehlerheft, Vokabeln, Hausaufgaben, Noten
   ===================================================================== */
const fachExam = f => upcomingKL().find(k => k.fach === f && !isVocabTest(k));
const fachTests = f => upcomingKL().filter(k => k.fach === f && isVocabTest(k));
const fachHW = f => openHW().filter(h => h.fach === f);
const FACH_LANG = { "Französisch": "fr", "Englisch": "en", "Spanisch": "es", "Latein": "la" };
function faecherList() {
  const hj = currentHJ();
  const all = Object.keys(LAUFBAHN).filter(f => belegung(f, hj));
  upcomingKL().forEach(k => { if (!all.includes(k.fach)) all.push(k.fach); });
  const rank = f => { const k = fachExam(f); return k ? daysUntil(k.datum) : 999; };
  return all.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "de"));
}

V.faecher = () => {
  if (!STATE.loaded) return pageHead("Fächer");
  const hj = currentHJ();
  const rows = faecherList().map(f => {
    const k = fachExam(f), hw = fachHW(f).length, err = typeof fehlerOf === "function" ? fehlerOf(f).length : 0, s = fachSchnitt(f, hj).gesamt;
    const d = k ? daysUntil(k.datum) : null;
    return '<a class="fa-row" href="#/fach/' + encodeURIComponent(f) + '"><span class="fa-dot" style="background:' + fcol(f) + '"></span><div class="fa-main"><b>' + esc(f) + '</b><span class="fa-meta">' +
      [k ? '<span class="fa-exam' + (d <= 7 ? " soon" : "") + '">Klausur ' + (d === 0 ? "heute" : d === 1 ? "morgen" : "in " + d + " Tagen") + '</span>' : '', hw ? hw + " Aufgabe" + (hw === 1 ? "" : "n") : "", err ? err + " Fehler zum Üben" : ""].filter(Boolean).join(" · ") + '</span></div>' +
      (s != null ? '<span class="pt ' + ptClass(Math.round(s)) + '">' + fmtPt(s) + '</span>' : '') + '<span class="chev">' + ICO.chev + '</span></a>';
  }).join("");
  return pageHead("Fächer", { sub: "Ein Fach antippen – alles dazu auf einer Seite." }) +
    '<div class="card fa-list">' + rows + '</div>' +
    '<div class="fa-links"><a class="btn" href="#/lernplan">' + ICO.lernplan + 'Alle Klausuren & Lernplan</a>' + (typeof fehlerAll === "function" && fehlerAll().length ? '<a class="btn" href="#/fehler">📕 Fehlerheft (' + fehlerAll().length + ')</a>' : '') + '</div>';
};

V.fach = () => {
  const f = decodeURIComponent(ROUTE.sub || ""); if (!f) { location.hash = "#/faecher"; return ""; }
  const hj = currentHJ(); const k = fachExam(f); const s = fachSchnitt(f, hj);
  const back = '<a class="backlink" href="#/faecher">' + ICO.back + 'Fächer</a>';
  const head = '<div class="fa-head" style="--fc:' + fcol(f) + '"><span class="fa-big-dot"></span><h1 class="t-large">' + esc(f) + '</h1></div>';
  // 1. Klausur
  let exam;
  if (k) { const d = daysUntil(k.datum); const r = readinessOf(k);
    exam = '<a class="card fa-exam-card" href="#/klausur/' + esc(k.id) + '"><div class="fa-ec-l"><span class="eyebrow">Nächste Klausur · ' + esc(fmtDL(k.datum)) + '</span><b>' + esc(k.thema || "Klausur") + '</b><span class="t-sub">' + (r.score != null ? r.score + " % vorbereitet · " : "") + 'Klausur-Modus öffnen</span></div><div class="fa-days"><span>' + d + '</span><small>' + (d === 1 ? "Tag" : "Tage") + '</small></div></a>';
  } else exam = '<div class="card fa-noexam"><b>Keine Klausur geplant</b><span class="t-sub">Sobald ein Termin feststeht, hier eintragen – dann baut die App den Lernplan.</span><a class="btn sm" href="#/lernplan">Termin eintragen</a></div>';
  // 2. Lernen: Kurse, Checklisten, Vokabeln
  const learn = [];
  if (/Mathe/.test(f)) learn.push(matheCard());
  if (f === "Französisch") learn.push(drillCard());
  if (k && typeof klCheckCard === "function") learn.push(klCheckCard(k));
  const lang = FACH_LANG[f];
  if (lang) { const cols = ES.collections.filter(c => !isArchived(c.id) && (c.source_language === lang)); const n = cols.reduce((a, c) => a + cardsOf(c.id).length, 0);
    learn.push('<a class="card dr-card" href="#/vokabeln"><span class="dr-ic">🗂️</span><span class="dr-tx"><b>Vokabeln</b><span class="t-sub">' + plural(cols.length, "Sammlung", "Sammlungen") + ' · ' + n + ' Wörter</span></span><span class="chev">' + ICO.chev + '</span></a>'); }
  fachTests(f).forEach(t => learn.push('<a class="card dr-card" href="#/lernplan/' + esc(t.id) + '"><span class="dr-ic">📝</span><span class="dr-tx"><b>Vokabeltest ' + esc(fmtDL(t.datum)) + '</b><span class="t-sub">' + esc(t.thema || "") + '</span></span><span class="chev">' + ICO.chev + '</span></a>'));
  const errs = typeof fehlerOf === "function" ? fehlerOf(f) : [];
  if (errs.length) learn.push('<a class="card dr-card fa-err" href="#/fehler?fach=' + encodeURIComponent(f) + '"><span class="dr-ic">📕</span><span class="dr-tx"><b>Fehlerheft: ' + errs.length + ' Fehler</b><span class="t-sub">Genau die Aufgaben, die du falsch hattest – jetzt üben</span></span><span class="chev">' + ICO.chev + '</span></a>');
  // 3. Hausaufgaben
  const hw = fachHW(f);
  const hwc = '<div class="card"><div class="km-row-h"><h2 style="margin:0">Hausaufgaben</h2><a class="btn sm" href="#/aufgaben?neu=1">' + ICO.plus + 'Neu</a></div>' + (hw.length ? '<div style="margin-top:8px">' + hw.map(h => hwRow(h)).join("") + '</div>' : '<p class="t-sub" style="margin:8px 0 0">Nichts offen in ' + esc(f) + '.</p>') + '</div>';
  // 4. Noten
  const nc = '<a class="card fa-grade" href="#/noten"><div><h2 style="margin:0">Noten ' + hj + '</h2><span class="t-sub">' + (s.rows.length ? plural(s.rows.length, "Eintrag", "Einträge") : "Noch keine Noten") + ' · antippen zum Eintragen</span></div>' + (s.gesamt != null ? '<span class="pt ' + ptClass(Math.round(s.gesamt)) + ' big">' + fmtPt(s.gesamt) + '</span>' : '<span class="chev">' + ICO.chev + '</span>') + '</a>';
  return back + head + exam + (learn.length ? '<h2 class="fa-sec">Lernen</h2>' + learn.join("") : '') + hwc + nc;
};
function bindFach() {}
