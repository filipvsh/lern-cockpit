/* =====================================================================
   LERN-COCKPIT · AUFTRAG FÜR HEUTE · THEMEN-ASSISTENT · PROBEKLAUSUR
   Die App sagt, was heute dran ist (todayPlan + Engine.examRoadmap) und
   führt Schritt für Schritt durch. Ohne KI-Schlüssel: Probeklausuren
   erstellen und korrigieren lassen geht über claude.ai (Text wird
   vorbereitet und kopiert).
   ===================================================================== */

/* ---------------- Typische Klausurthemen (Gymnasium NRW, EF) ---------------- */
const TOPIC_SUGGESTIONS = {
  "Deutsch": ["Sachtextanalyse", "Argumentationsstruktur erkennen", "Textgebundene Erörterung", "Kurzgeschichte analysieren", "Gedichtanalyse", "Kommunikationsmodelle (Watzlawick, Schulz von Thun)", "Gesprächsanalyse", "Rhetorische Mittel und ihre Wirkung", "Zitieren und Textbelege"],
  "Englisch": ["Analysis of a non-fictional text", "Comment / argumentative essay", "Short story analysis", "Characterisation", "Narrative perspective and techniques", "Stylistic devices and their effect", "Mediation (German → English)", "Writing a summary", "Linking words and useful phrases"],
  "Französisch": ["Vocabulaire de la leçon", "Passé composé / imparfait", "Subjonctif", "Pronoms (objet, y, en)", "Compréhension écrite", "Production écrite (lettre, courriel)", "Médiation (Deutsch → Französisch)"],
  "Mathe": ["Funktionen und ihre Graphen", "Ableitungsregeln", "Tangentengleichung", "Extrem- und Wendepunkte", "Kurvendiskussion", "Exponentialfunktionen", "Vektoren: Grundlagen", "Wahrscheinlichkeit und Baumdiagramme"],
  "Vert. Mathe": ["Funktionen und ihre Graphen", "Ableitungsregeln", "Extrem- und Wendepunkte", "Kurvendiskussion", "Exponentialfunktionen"],
  "Physik": ["Gleichförmige Bewegung", "Beschleunigte Bewegung", "s-t- und v-t-Diagramme auswerten", "Newtonsche Gesetze", "Energieerhaltung", "Impuls", "Kreisbewegung"],
  "Chemie": ["Atombau und Periodensystem", "Bindungsarten", "Alkane und Alkohole", "Funktionelle Gruppen", "Reaktionsgeschwindigkeit", "Chemisches Gleichgewicht"],
  "Erdkunde": ["Klima- und Vegetationszonen", "Klimadiagramme auswerten", "Landwirtschaft und Tragfähigkeit", "Bodenbildung und Bodendegradation", "Wasser als Ressource", "Karten und Statistiken auswerten"],
  "SoWi": ["Sozialisation und Rollentheorie", "Markt und Preisbildung", "Politische Partizipation", "Wirtschaftspolitik", "Karikaturanalyse", "Statistiken auswerten"],
  "Philosophie": ["Was ist Philosophie?", "Rationalismus und Empirismus", "Utilitarismus", "Kants Pflichtethik", "Argumente analysieren", "Problemerörterung"],
  "Kunst": ["Bildanalyse", "Formale Gestaltungsmittel", "Werkvergleich"]
};

/** Themen-Assistent: in 2 Minuten festlegen, was drankommt */
function topicAssistant(k) {
  const have = new Set(subsOfExam(k.id).map(s => s.title.toLowerCase()));
  const sugg = (TOPIC_SUGGESTIONS[k.fach] || []).filter(t => !have.has(t.toLowerCase()));
  const picked = new Set();
  openModal("Was kommt in " + esc(k.fach) + " dran?",
    '<p class="hint">Hak an, was laut Lehrkraft, Heft oder Arbeitsblättern drankommt. Fehlt etwas, schreib es unten dazu – eine Zeile pro Thema. Lieber zu viel als zu wenig: Was du gut kannst, erkennt die App schnell.</p>' +
    (sugg.length ? '<div class="pick">' + sugg.map((t, i) => '<button class="pickchip" data-pick="' + i + '">' + esc(t) + '</button>').join("") + '</div>' : '') +
    '<label class="fld" style="margin-top:var(--s4)">Weitere Themen<textarea id="ta_more" style="min-height:90px" placeholder="z. B. The American Dream&#10;Kapitel 3: Kurzgeschichten"></textarea></label>' +
    '<p class="hint" id="ta_count">Noch nichts ausgewählt.</p>',
    '<button class="btn" id="ta_cancel">Später</button><button class="btn primary" id="ta_save" disabled>Plan erstellen</button>', () => {
      const q = id => document.getElementById(id);
      const list = () => [...picked].map(i => sugg[i]).concat(val("ta_more").split(/\n+/).map(x => x.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean));
      const upd = () => { const n = list().length; q("ta_count").textContent = n ? plural(n, "Thema", "Themen") + " – daraus baut die App deinen Plan bis zur Klausur." : "Noch nichts ausgewählt."; q("ta_save").disabled = !n; };
      document.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { const i = +b.dataset.pick; if (picked.has(i)) picked.delete(i); else picked.add(i); b.classList.toggle("on", picked.has(i)); upd(); });
      q("ta_more").oninput = upd;
      q("ta_cancel").onclick = closeModal;
      q("ta_save").onclick = async () => {
        const titles = [...new Set(list().map(t => t.slice(0, 160)))]; if (!titles.length) return;
        const btn = q("ta_save"); btn.classList.add("loading");
        try {
          let t = topicsOfExam(k.id)[0];
          if (!t) t = (await dbInsert("topics", { title: klTitle(k), exam_id: k.id, subject_id: subjectId(k.fach), priority: 2, status: "active" })).row;
          let n = subsOfTopic(t.id).length;
          for (const title of titles) if (!have.has(title.toLowerCase())) await dbInsert("subtopics", { topic_id: t.id, title, difficulty: 2, sort: n++ });
          closeModal(); toast("Plan steht: " + plural(titles.length, "Thema", "Themen")); route();
        } catch (e) { btn.classList.remove("loading"); toast("Speichern fehlgeschlagen: " + e.message, true); }
      };
      upd();
    });
}

/* ---------------- Claude ohne API-Schlüssel ---------------- */
/** Text in die Zwischenablage und claude.ai mit vorausgefülltem Text öffnen */
async function openInClaude(text) {
  try { await navigator.clipboard.writeText(text); } catch (e) {}
  window.open("https://claude.ai/new?q=" + encodeURIComponent(text), "_blank", "noopener");
  toast("Auftrag kopiert – falls claude.ai ihn nicht schon eingefügt hat: einfügen und senden.");
}
const examTopics = k => subsOfExam(k.id).map(s => s.title);
function mockPrompt(k, minutes) {
  const tp = examTopics(k);
  return "Du bist meine Lehrkraft im Fach " + k.fach + " (Gymnasium NRW, Einführungsphase EF). Am " + fmtDL(k.datum) + " schreibe ich eine Klausur" + (k.thema && !/^Klausur Nr/.test(k.thema) ? " zum Thema „" + k.thema + "“" : "") + ".\n\n" +
    "Erstelle mir eine realistische Probeklausur für " + minutes + " Minuten" + (tp.length ? " zu diesen Themen:\n- " + tp.join("\n- ") : "") + "\n\n" +
    "Format wie eine echte Klausur: Material bzw. Text (falls in diesem Fach üblich), 2–3 Aufgaben mit Operatoren und Punkten. " +
    "Zeig mir den Erwartungshorizont noch NICHT – ich schicke dir zuerst meine Lösung, dann korrigierst du sie.";
}
function correctionPrompt(k, task, answer) {
  return "Du bist meine Lehrkraft im Fach " + k.fach + " (Gymnasium NRW, EF). Korrigiere meine Probeklausur wie eine echte Klausur.\n\n" +
    "AUFGABE:\n" + (task || "(siehe oben in unserem Chat)") + "\n\nMEINE LÖSUNG:\n" + (answer || "(auf Papier – ich schicke ein Foto)") + "\n\n" +
    "Bitte: 1) Punkte je Aufgabe nach Erwartungshorizont, 2) Gesamtnote in Punkten (0–15), 3) die drei wichtigsten Fehler mit Verbesserung, 4) was ich bis zur Klausur noch konkret üben soll.";
}

/* ---------------- Probeklausur ---------------- */
const OWN_TASK_FACH = ["Deutsch", "Englisch", "Französisch", "Philosophie", "SoWi", "Erdkunde", "Kunst"];
function mockModal(k) {
  if (!subsOfExam(k.id).length) { topicAssistant(k); return; }
  let min = mockMinutes(k); let src = OWN_TASK_FACH.includes(k.fach) ? "own" : "app";
  const body = () => '<p class="hint">Wie in der echten Klausur: Zeit läuft, keine Hilfen, kein Handy. Danach bewertest du dich – oder lässt Claude korrigieren.</p>' +
    '<label class="fld">Aufgabe<div class="seg full"><button data-src="own" class="' + (src === "own" ? "on" : "") + '">Echte Klausuraufgabe</button><button data-src="app" class="' + (src === "app" ? "on" : "") + '">Aufgaben aus der App</button></div></label>' +
    (src === "own" ? '<ol class="steps" style="margin-top:var(--s3)"><li>Aufgabe holen: <button class="linkbtn" id="mk_claude">Probeklausur bei Claude erstellen</button> – oder eine alte Klausur bzw. Buchaufgabe nehmen.</li><li>Aufgabentext unten einfügen (oder auf Papier lassen).</li><li>Start drücken und schreiben – hier oder auf Papier.</li></ol><label class="fld">Aufgabentext (optional)<textarea id="mk_task" style="min-height:110px" placeholder="Aufgabe hier einfügen …">' + esc(lsGet("lc_mocktask_" + k.id, "")) + '</textarea></label>'
      : '<p class="hint" style="margin-top:var(--s3)">Die App stellt Aufgaben aus deinen ' + plural(subsOfExam(k.id).length, "Thema", "Themen") + ' zusammen – die schwächsten zuerst.</p>') +
    '<label class="fld">Zeit<div class="seg full">' + [45, 60, 90, 135].map(m => '<button data-mmin="' + m + '" class="' + (min === m ? "on" : "") + '">' + m + ' Min.</button>').join("") + '</div></label>';
  openModal("Probeklausur " + esc(k.fach), '<div id="mk_body">' + body() + '</div>', '<button class="btn" id="mk_cancel">Abbrechen</button><button class="btn primary" id="mk_go">' + ICO.play + 'Start – Zeit läuft</button>', () => {
    const bind = () => {
      document.querySelectorAll("[data-src]").forEach(b => b.onclick = () => { src = b.dataset.src; upd(); });
      document.querySelectorAll("[data-mmin]").forEach(b => b.onclick = () => { min = +b.dataset.mmin; upd(); });
      const c = document.getElementById("mk_claude"); if (c) c.onclick = () => openInClaude(mockPrompt(k, min));
      const t = document.getElementById("mk_task"); if (t) t.oninput = () => lsSet("lc_mocktask_" + k.id, t.value);
    };
    const upd = () => { document.getElementById("mk_body").innerHTML = body(); bind(); };
    bind();
    document.getElementById("mk_cancel").onclick = closeModal;
    document.getElementById("mk_go").onclick = () => {
      if (src === "own") startTraining({ mode: "mock", exam_id: k.id, minutes: min, task: val("mk_task"), planKey: "mock:" + k.id });
      else startTraining({ mode: "exam", exam_id: k.id, minutes: min, count: Math.max(4, Math.round(min / 8)), planKey: "mock:" + k.id });
    };
  });
}

/* ---------------- Auftrag für heute (Dashboard) ---------------- */
function missionCard(plan) {
  const items = plan.items; const open = items.filter(i => !i.done); const next = open[0];
  const mins = open.reduce((a, i) => a + Math.max(0, i.minutes - (i.doneMin || 0)), 0);
  const streak = learnStreak();
  const late = new Date().getHours() >= 17 && open.length && !items.some(i => i.done || i.doneMin);
  const kl = upcomingKL().filter(k => !isVocabTest(k))[0];
  const road = kl && daysUntil(kl.datum) <= KLAUSUR_HORIZON ? roadmapOf(kl) : null;
  const mockStep = road && road.find(s => s.kind === "mock");
  const icon = it => ICO[it.kind === "vocab" || it.kind === "test" || it.kind === "probe" ? "vokabeln" : it.kind === "mock" ? "clock" : it.kind === "setup" ? "lernplan" : it.kind === "errors" ? "target" : "play"];
  const steps = items.map((it, i) => '<li class="mstep' + (it.done ? " done" : it === next ? " next" : "") + '"><span class="mn">' + (it.done ? ICO.check : i + 1) + '</span><div class="mt"><b>' + esc(it.title) + '</b><div class="t-sub">' + esc(it.sub || "") + '</div>' + (it.reasons && it.reasons.length && !it.done ? '<div class="why">Warum: ' + esc(it.reasons[0]) + '</div>' : '') + '</div><span class="mm">' + it.minutes + ' Min.</span>' + (it.done ? '' : '<button class="iconbtn" data-plan="' + i + '" aria-label="Diesen Schritt starten" title="Diesen Schritt starten">' + icon(it) + '</button>') + '</li>').join("");
  const head = !items.length ? "Heute ist nichts geplant" : open.length ? (late ? "Es ist " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " – fang jetzt an" : "Noch " + plural(open.length, "Schritt", "Schritte") + " · ca. " + mins + " Min.") : "Auftrag erledigt ✓";
  const notif = "Notification" in window && Notification.permission === "default" && open.length ? '<button class="btn plain sm" id="ms_notify">Erinnere mich, wenn ich es vergesse</button>' : '';
  return '<div class="card mission' + (open.length ? "" : " complete") + (late ? " late" : "") + '"><div class="label">' + ICO.target + 'Dein Auftrag für heute' + (streak ? ' · <span class="streak">' + streak + (streak === 1 ? " Tag" : " Tage") + ' in Folge</span>' : '') + '</div><h3>' + head + '</h3>' +
    (road ? '<div class="t-sub" style="margin-top:4px">' + esc(kl.fach) + '-Klausur in ' + plural(daysUntil(kl.datum), "Tag", "Tagen") + (mockStep && mockStep.day > 0 ? ' · Probeklausur am ' + esc(fmtD(addDays(todayISO(), mockStep.day))) : '') + ' · <a href="#/lernplan/' + esc(kl.id) + '">Plan bis zur Klausur</a></div>' : '') +
    (items.length ? '<ol class="msteps">' + steps + '</ol>' : '<p class="t-sub" style="margin-top:var(--s3)">Trag deine nächste Klausur ein – dann plant die App jeden Tag für dich.</p>') +
    '<div class="cont-foot">' + (next ? '<button class="btn primary lg" id="plan_go">' + ICO.play + 'Los: ' + esc(next.title) + '</button>' : items.length ? '<span class="t-callout">Gut gemacht. Morgen geht es weiter.</span>' : '<a class="btn primary" href="#/lernplan">Klausur eintragen</a>') + notif + '</div></div>';
}
