/* =====================================================================
   LERN-COCKPIT · SCHREIB-TRAINER (Klausur-Modus, Tab „Schreiben“)
   Die Klausur-Texte üben: Aufgabe, Bausteine zum Antippen, Wortzähler,
   Prüfen ohne Internet (js/fr-check.js) mit „Übernehmen“, Checkliste,
   Mustertext, KI-Korrektur (wenn die Edge Function „ai-tutor“ läuft).
   Entwürfe in „einstellungen“: schreiben_<Klausur> = { Aufgabe: Text }.
   ===================================================================== */
const WRITE_TASKS = [
  { id: "mail", title: "Mail: Shopping", min: 80, mail: true,
    prompt: "Schreib eine kurze Mail (ca. 80 Wörter) an eine Freundin: Du warst shoppen. Was hast du gekauft, wie sieht es aus, was hat es gekostet?",
    bausteine: ["Salut …,", "Hier, je suis allé(e) au magasin.", "J'ai acheté …", "Il coûte … euros.", "Elle coûte … euros.", "C'est très confortable.", "Je préfère …", "Et toi ?", "Bises,"],
    model: "Salut Léa,\nHier, je suis allée au magasin avec ma mère. J'ai acheté un pull bleu et une casquette noire. Le pull est très confortable et pas cher : il coûte 20 euros. La casquette est cool, mais un peu chère. J'aime beaucoup mon nouveau style décontracté !\nEt toi, tu aimes faire du shopping ?\nBises,\nFilip" },
  { id: "person", title: "Person beschreiben", min: 50,
    prompt: "Beschreib in 5–6 Sätzen, was eine Person trägt (Kleidung, Farben, Stil).",
    bausteine: ["Elle porte …", "Il porte …", "Son style est …", "Il/Elle a aussi …", "J'aime son …", "C'est très élégant."],
    model: "Elle porte une robe rouge et des baskets blanches. Elle a aussi une casquette grise. Son style est sportif et moderne. Lui, il porte un jean bleu, une chemise blanche et un manteau noir. Il est très élégant." },
  { id: "dialog", title: "Dialog im Geschäft", min: 50,
    prompt: "Schreib einen Dialog im Geschäft (6–8 Zeilen): Du suchst etwas, probierst es an, fragst nach dem Preis und bezahlst.",
    bausteine: ["— Bonjour, je cherche …", "— Quelle couleur ?", "— Je peux l'essayer ?", "— Il coûte combien ?", "— Je le prends.", "— Je peux payer par carte ?", "— Merci, au revoir !"],
    model: "— Bonjour, je cherche un pantalon.\n— Quelle couleur ?\n— Noir, s'il vous plaît.\n— Voilà. Vous voulez l'essayer ?\n— Oui, merci. … Il est parfait. Il coûte combien ?\n— 35 euros.\n— D'accord, je le prends. Je peux payer par carte ?\n— Bien sûr. Merci et au revoir !" }
];
let WR = { task: "mail", res: null, ai: null, aiBusy: false, aiErr: "" };
const wrKey = k => "schreiben_" + k.id;
const wrText = (k, t) => ((setting(wrKey(k), {}) || {})[t] || "");
const wrTask = () => WRITE_TASKS.find(t => t.id === WR.task) || WRITE_TASKS[0];
/** Genus aus den Klausur-Vokabeln (la robe → robe: f) */
function wrGenders(k) {
  const g = {}; examVocab(k).forEach(v => { const m = String(v.begriff).split(/\s*[;,/]\s*/)[0].match(/^(le|la|un|une)\s+(.+)$/i); if (m) g[m[2].toLowerCase()] = /^(la|une)$/i.test(m[1]) ? "f" : "m"; }); return g;
}
/** welche Klausur-Vokabeln im Text vorkommen */
function wrVocabUsed(k, text) {
  const t = " " + text.toLowerCase().replace(/[’']/g, "' ") + " ";
  return examVocab(k).map(v => String(v.begriff).split(/\s*[;,/]\s*/)[0].replace(/^(le|la|les|un|une|des|l')\s*/i, "").toLowerCase()).filter((w, i, a) => w.length > 2 && a.indexOf(w) === i && t.includes(" " + w));
}
function wrChecklist(k, task, text) {
  const n = FRCHECK.wordCount(text); const used = wrVocabUsed(k, text); const bs = task.bausteine.filter(b => text.toLowerCase().includes(b.replace(/[—…(].*$/, "").trim().toLowerCase().slice(0, 12))).length;
  const rows = [[n >= task.min, n + " / " + task.min + " Wörter"], [used.length >= 5, plural(used.length, "Klausur-Vokabel", "Klausur-Vokabeln") + " benutzt" + (used.length ? ": " + used.slice(0, 8).join(", ") : "")], [bs >= 2, plural(bs, "Baustein", "Bausteine") + " benutzt"]];
  if (task.mail) rows.push([/^(salut|bonjour|cher|chère|coucou)/i.test(text.trim()), "Anrede am Anfang (Salut …,)"], [/(bises|à bientôt|a bientot|amitiés|salut)[\s,!.]*\S*\s*$/i.test(text.trim()), "Gruß am Ende (Bises, …)"]);
  return rows;
}
function kmSchreiben(k) {
  const task = wrTask(); const text = wrText(k, task.id); const n = FRCHECK.wordCount(text);
  const tabs = '<div class="seg wr-tasks">' + WRITE_TASKS.map(t => '<button class="' + (t.id === task.id ? "on" : "") + '" data-wrtask="' + t.id + '">' + esc(t.title) + '</button>').join("") + '</div>';
  const res = WR.res && WR.res.task === task.id ? WR.res : null;
  const marked = res ? wrMarked(text, res.issues) : "";
  const issues = res ? (res.issues.length ? '<div class="wr-issues">' + res.issues.map((e, i) => '<div class="wr-is"><div><s>' + esc(e.wrong) + '</s> → <b>' + esc(e.fix) + '</b><div class="t-sub">' + esc(e.msg) + '</div></div><button class="btn sm" data-wrfix="' + i + '">Übernehmen</button></div>').join("") + '</div>'
    : '<div class="fb ok"><div class="fb-t"><b>Keine typischen Fehler gefunden 👍</b></div><div class="fb-x">Die Prüfung erkennt Elision, Artikel, Angleichung, Verbformen und Akzente – nicht alles. Vergleich trotzdem mit dem Mustertext.</div></div>') : '';
  const check = res ? '<div class="wr-check">' + wrChecklist(k, task, text).map(([ok, t]) => '<div class="' + (ok ? "ok" : "") + '">' + (ok ? "✓" : "○") + ' ' + esc(t) + '</div>').join("") + '</div>' : '';
  const ai = WR.aiBusy ? '<div class="pdf-loading"><span class="spinner"></span> Die KI liest deinen Text …</div>' : WR.aiErr ? '<div class="hint">' + esc(WR.aiErr) + '</div>' : WR.ai && WR.ai.task === task.id ? wrAiHtml(WR.ai.r) : '';
  return tabs + '<div class="card wr-card"><div class="wr-prompt">' + esc(task.prompt) + '</div><div class="wr-bs">' + task.bausteine.map((b, i) => '<button class="wr-b" data-wrb="' + i + '">' + esc(b) + '</button>').join("") + '</div>' +
    '<textarea id="wr_text" class="wr-ta" spellcheck="false" autocapitalize="sentences" placeholder="Schreib hier auf Französisch …">' + esc(text) + '</textarea>' +
    '<div class="wr-bar"><span class="t-sub" id="wr_n">' + n + ' / ' + task.min + ' Wörter</span><span class="grow"></span>' + (AI.state !== "unavailable" ? '<button class="btn" id="wr_ai"' + (WR.aiBusy ? " disabled" : "") + '>KI-Korrektur</button>' : '') + '<button class="btn primary" id="wr_check">Prüfen</button></div>' +
    (marked ? '<div class="wr-marked">' + marked + '</div>' : '') + issues + check + ai +
    '<details class="wr-model"><summary>Mustertext ansehen</summary><pre>' + esc(task.model) + '</pre></details></div>';
}
function wrMarked(text, issues) {
  let h = "", p = 0; issues.filter(e => e.i >= 0).forEach(e => { if (e.i < p) return; h += esc(text.slice(p, e.i)) + '<mark class="wr-m" title="' + esc(e.msg) + '">' + esc(text.slice(e.i, e.end)) + '</mark>'; p = e.end; });
  return (h + esc(text.slice(p))).replace(/\n/g, "<br>");
}
function wrAiHtml(r) {
  return '<div class="wr-ai"><h3>KI-Korrektur' + (r.overall ? ' · ' + r.overall + ' %' : '') + '</h3>' + (r.summary ? '<p>' + esc(r.summary) + '</p>' : '') +
    (r.criteria.length ? r.criteria.map(c => '<div class="km-sub"><span>' + esc(c.name) + '</span><span class="t-sub">' + c.score + ' %</span>' + progBar(c.score, c.score >= 80 ? "g" : c.score >= 60 ? "" : "o") + (c.comment ? '<span class="t-sub" style="grid-column:1/-1">' + esc(c.comment) + '</span>' : '') + '</div>').join("") : '') +
    (r.mistakes.length ? '<h4>Fehler</h4><ul>' + r.mistakes.map(m => '<li>' + esc(typeof m === "string" ? m : (m.text || m.error || "") + (m.fix || m.correction ? " → " + (m.fix || m.correction) : "")) + '</li>').join("") + '</ul>' : '') +
    (r.next_steps.length ? '<h4>Nächste Schritte</h4><ul>' + r.next_steps.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul>' : '') + '</div>';
}
let WR_SAVE = null;
function bindKmSchreiben(k) {
  const q = id => document.getElementById(id); const ta = q("wr_text"); if (!ta) return;
  const task = wrTask();
  const save = () => { const all = Object.assign({}, setting(wrKey(k), {}) || {}); all[task.id] = ta.value; setSetting(wrKey(k), all); };
  ta.oninput = () => { const n = FRCHECK.wordCount(ta.value); q("wr_n").textContent = n + " / " + task.min + " Wörter"; clearTimeout(WR_SAVE); WR_SAVE = setTimeout(save, 800); };
  document.querySelectorAll("[data-wrtask]").forEach(b => b.onclick = () => { save(); WR.task = b.dataset.wrtask; WR.res = null; route(); });
  document.querySelectorAll("[data-wrb]").forEach(b => b.onclick = () => {
    const ins = task.bausteine[+b.dataset.wrb].replace(/ …,?$/, "").replace(/…/g, "").trim() + " ";
    const s = ta.selectionStart != null ? ta.selectionStart : ta.value.length; ta.value = ta.value.slice(0, s) + (s && !/\s$/.test(ta.value.slice(0, s)) ? " " : "") + ins + ta.value.slice(ta.selectionEnd || s); ta.focus(); ta.oninput();
  });
  q("wr_check").onclick = async () => {
    clearTimeout(WR_SAVE); save();
    WR.res = { task: task.id, issues: FRCHECK.check(ta.value, { genders: wrGenders(k) }) };
    const day = todayISO(), done = setting("schreiben_xp", {}) || {};
    if (FRCHECK.wordCount(ta.value) >= task.min && done[task.id + ":" + k.id] !== day) { await setSetting("schreiben_xp", Object.assign({}, done, { [task.id + ":" + k.id]: day })); addXP(15); }
    route();
  };
  document.querySelectorAll("[data-wrfix]").forEach(b => b.onclick = () => {
    const e = WR.res.issues[+b.dataset.wrfix];
    if (ta.value.slice(e.i, e.end) !== e.wrong) { WR.res = { task: task.id, issues: FRCHECK.check(ta.value, { genders: wrGenders(k) }) }; route(); toast("Text wurde geändert – hier die neue Prüfung"); return; }
    ta.value = ta.value.slice(0, e.i) + e.fix + ta.value.slice(e.end); save();
    WR.res = { task: task.id, issues: FRCHECK.check(ta.value, { genders: wrGenders(k) }) }; route();
  });
  const ai = q("wr_ai"); if (ai) ai.onclick = async () => {
    if (FRCHECK.wordCount(ta.value) < 10) { toast("Schreib erst ein paar Sätze.", true); return; }
    clearTimeout(WR_SAVE); save(); WR.aiBusy = true; WR.aiErr = ""; route();
    try { const r = await AI.call({ mode: "correct", exercise: { type: "short_writing", question: task.prompt, solution: task.model }, answer: ta.value, exam_mode: false, exam_id: k.id }); WR.ai = { task: task.id, r: AI.normRubric(r) }; }
    catch (e) { WR.aiErr = AI.errorText(e) + " Die Prüfung ohne Internet (Knopf „Prüfen“) funktioniert trotzdem."; }
    finally { WR.aiBusy = false; if (ROUTE.name === "klausur") route(); }
  };
}
