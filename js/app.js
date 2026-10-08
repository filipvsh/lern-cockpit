/* =====================================================================
   LERN-COCKPIT · APP
   Anmeldung, Dashboard, Vokabeln, Trainer-Start, Router und Start.
   Lernplan, KI, Fortschritt und Einstellungen: js/views-learn.js
   ===================================================================== */

/* ---------- kleine Helfer ---------- */
function fmtClock(ms) { const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ":" + two(m) : m) + ":" + two(s); }
function setLast(o) { lsSet("lc_last", Object.assign({}, o, { ts: Date.now() })); }
const agoText = d => d == null ? "noch nie" : d === 0 ? "heute" : d === 1 ? "gestern" : "vor " + d + " Tagen";
const engineReady = () => STATE.engine === "ready";
function masteryBadge(score, attempts) {
  if (score == null) return '<span class="t-sub">Neu</span>';
  return progBar(score, score < 60 ? "o" : "") + '<span class="pct">' + score + ' %</span>';
}
const dirPref = colId => (lsGet("lc_vokdir3", {}) || {})[colId || "all"] || "forward";
const setDirPref = (colId, d) => { const m = lsGet("lc_vokdir3", {}) || {}; m[colId || "all"] = d; lsSet("lc_vokdir3", m); };
function netNotice() {
  const n = Api.pending, failed = Api.failed().length;
  if (STATE.offline) return '<div class="notice"><span class="dot" style="background:var(--orange)"></span><span>Offline – du siehst den zuletzt geladenen Stand' + (STATE.snapshotAt ? " (" + new Date(STATE.snapshotAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + ")" : "") + '. Änderungen werden gespeichert und automatisch nachgereicht.</span><button class="btn sm" onclick="init()">Erneut verbinden</button></div>';
  if (n) return '<div class="notice"><span class="spinner"></span><span>' + plural(n, "Änderung wird", "Änderungen werden") + ' synchronisiert …</span></div>';
  if (failed) return '<div class="notice"><span class="dot" style="background:var(--red)"></span><span>' + plural(failed, "Änderung konnte", "Änderungen konnten") + ' nicht gespeichert werden.</span><a class="btn sm" href="#/einstellungen">Details</a></div>';
  return "";
}

/* =====================================================================
   ANMELDUNG
   ===================================================================== */
let AUTH_MODE = "login";
V.auth = () => {
  const m = AUTH_MODE;
  const title = m === "signup" ? "Konto erstellen" : m === "reset" ? "Passwort zurücksetzen" : m === "newpw" ? "Neues Passwort" : "Anmelden";
  const sub = m === "signup" ? "Dein Lernstand wird in deinem Konto gespeichert – nur du kannst ihn sehen." : m === "reset" ? "Wir schicken dir einen Link per E-Mail." : m === "newpw" ? "Wähle ein neues Passwort für dein Konto." : "Melde dich an, um weiterzulernen. Hast du einen Zugangslink? Dann öffne einfach den – ohne Anmeldung.";
  return '<div class="auth"><div class="auth-card"><div class="brand" style="padding:0 0 var(--s6)"><div class="logo">' + document.querySelector(".brand .logo").innerHTML + '</div><div><b>Lern-Cockpit</b></div></div><h1 class="t-title">' + title + '</h1><p class="t-callout" style="margin:6px 0 var(--s6)">' + sub + '</p>' +
    '<form id="auth_form" class="form" novalidate>' +
    (m === "signup" ? '<label class="fld">Name<input id="a_name" autocomplete="name" placeholder="Filip"></label>' : '') +
    (m !== "newpw" ? '<label class="fld">E-Mail<input id="a_mail" type="email" autocomplete="email" required></label>' : '') +
    (m !== "reset" ? '<label class="fld">Passwort<input id="a_pw" type="password" autocomplete="' + (m === "login" ? "current-password" : "new-password") + '" minlength="8" required></label>' : '') +
    '<div class="err" id="a_err" role="alert"></div>' +
    '<button class="btn primary lg wide" id="a_go" type="submit">' + (m === "signup" ? "Konto erstellen" : m === "reset" ? "Link senden" : m === "newpw" ? "Passwort speichern" : "Anmelden") + '</button></form>' +
    '<div class="auth-links">' + (m === "login" ? '<button class="btn plain sm" data-am="reset">Passwort vergessen?</button><button class="btn plain sm" data-am="signup">Konto erstellen</button>' : m === "newpw" ? '' : '<button class="btn plain sm" data-am="login">Zur Anmeldung</button>') + '</div></div></div>';
};
function bindAuth() {
  document.body.classList.add("focus");
  document.querySelectorAll("[data-am]").forEach(b => b.onclick = () => { AUTH_MODE = b.dataset.am; route(); });
  const f = document.getElementById("auth_form"); const err = document.getElementById("a_err"); const go = document.getElementById("a_go");
  const first = f.querySelector("input"); if (first) setTimeout(() => first.focus(), 50);
  f.onsubmit = async e => {
    e.preventDefault(); err.textContent = "";
    const mail = val("a_mail"), pw = (document.getElementById("a_pw") || {}).value || "";
    if (AUTH_MODE !== "newpw" && !/^\S+@\S+\.\S+$/.test(mail)) { err.textContent = "Bitte gib eine gültige E-Mail-Adresse ein."; return; }
    if (AUTH_MODE !== "reset" && pw.length < 8) { err.textContent = "Das Passwort braucht mindestens 8 Zeichen."; return; }
    go.classList.add("loading");
    try {
      if (AUTH_MODE === "login") { await Api.signIn(mail, pw); await init(); return; }
      if (AUTH_MODE === "signup") { const r = await Api.signUp(mail, pw, val("a_name")); if (r.confirm) { AUTH_MODE = "login"; route(); toast("Fast geschafft: Bestätige deine E-Mail über den Link im Postfach."); return; } await init(); return; }
      if (AUTH_MODE === "reset") { await Api.recover(mail); AUTH_MODE = "login"; route(); toast("Wenn ein Konto existiert, ist der Link unterwegs."); return; }
      if (AUTH_MODE === "newpw") { await Api.updatePassword(pw); AUTH_MODE = "login"; toast("Passwort geändert"); await init(); return; }
    } catch (ex) { err.textContent = ex.message; go.classList.remove("loading"); }
  };
}
function setupCard() {
  return '<div class="card"><h2>Lern-Engine einrichten</h2><p class="hint" style="margin-bottom:var(--s4)">Lernstand, Trainer, Lernplan und KI brauchen einmalig ein Datenbank-Update. Bis dahin funktionieren Aufgaben, Stundenplan, Noten und Infos wie gewohnt.</p><ol class="steps"><li>Supabase öffnen → <b>SQL Editor</b> → <b>New query</b></li><li>Inhalt von <code>supabase/migrations/003_learning_engine.sql</code> einfügen → <b>Run</b></li><li>Diese Seite neu laden und ein Konto anlegen – deine bisherigen Daten werden automatisch übernommen.</li></ol><p class="hint" style="margin-top:var(--s4)">Die vollständige Anleitung (inkl. KI und Absicherung) steht in <code>docs/SETUP.md</code>.</p><button class="btn primary" style="margin-top:var(--s4)" onclick="init()">Neu prüfen</button></div>';
}

/* =====================================================================
   DASHBOARD · „Was ist für mich jetzt wichtig?“
   ===================================================================== */
function continueItem() {
  if (tsActive()) return { kind: "session", title: TS.label, crumb: modeName(), href: "#/trainer/session", sub: TS.status === "paused" ? "Pausiert · " + fmtClock(Engine.elapsedMs(TS, Date.now())) : "Läuft seit " + fmtClock(Engine.elapsedMs(TS, Date.now())) };
  // Anstehender Vokabeltest mit offenem Tagespensum geht vor
  const vt = upcomingTests().filter(k => daysUntil(k.datum) <= 7 && testQueueOf(k).length)[0];
  if (vt) { const st = testStatusOf(vt); const n = testQueueOf(vt).length;
    return { kind: "test", title: vtName(vt), crumb: vt.fach + " · Vokabeltest " + whenText(daysUntil(vt.datum)), m: { score: st.expected }, reasons: [plural(n, "Wort", "Wörter") + " für heute", st.expected == null ? "noch nicht begonnen" : "erwartet " + st.expected + " % im Test"], start: { mode: "test", exam_id: vt.id, planKey: "test:" + vt.id } }; }
  const last = lsGet("lc_last", null);
  if (last && last.kind === "subtopic") {
    const st = subById(last.sub); const ex = st && examOfSub(st); const m = st && masteryOf(st.id);
    if (st && (!ex || (daysUntil(ex.datum) >= 0 && ex.punkte == null)) && (m.score == null || m.score < 85))
      return { kind: "subtopic", st, ex, m, title: st.title, crumb: (ex ? ex.fach + " · " : "") + (topicById(st.topic_id) || {}).title, resumed: true, start: { mode: "topic", subtopic_id: st.id } };
  }
  const p = priorities()[0];
  if (p) return { kind: "subtopic", st: p.subtopic, ex: p.exam, m: masteryOf(p.subtopic.id), title: p.subtopic.title, crumb: (p.exam ? p.exam.fach + " · " : "") + p.topic.title, reasons: p.reasons, start: { mode: "topic", subtopic_id: p.subtopic.id } };
  const due = vocabDue().reduce((a, x) => a + x.count, 0);
  if (due) return { kind: "vocab", title: plural(due, "fällige Vokabel", "fällige Vokabeln"), crumb: "Vokabeln · Wiederholung nach Plan", start: { mode: "vocab", count: 30 } };
  return null;
}
function contCard(c) {
  if (!c) {
    const next = upcomingKL()[0];
    return '<div class="card cont"><div><div class="label">' + ICO.play + 'Als Nächstes</div><h3>' + (next ? "Lege Themen für " + esc(next.fach) + " an" : "Lege deine nächste Prüfung an") + '</h3><p class="t-callout" style="margin-top:6px">Aus Prüfung, Themen und Unterthemen entsteht dein Lernplan.</p></div><div class="cont-foot"><a class="btn primary lg" href="#/lernplan' + (next ? "/" + esc(next.id) : "") + '">Lernplan öffnen</a></div></div>';
  }
  if (c.kind === "session") return '<div class="card cont"><div><div class="label">' + ICO.play + 'Weitermachen</div><div class="crumb"><b>' + esc(c.crumb) + '</b></div><h3>' + esc(c.title) + '</h3></div><div class="cont-foot"><a class="btn primary lg" href="' + c.href + '">Fortsetzen</a><span class="t-sub">' + esc(c.sub) + ' · deine Antworten sind gespeichert</span></div></div>';
  const ringHtml = c.m ? (c.m.score == null ? ring(0, 76, 7, "Neu") : ring(c.m.score / 100, 76, 7, c.m.score + "%")) : "";
  const why = c.resumed ? "Hier hast du zuletzt aufgehört" + (c.m && c.m.lastAt ? " (" + agoText(c.m.daysSince) + ")" : "") + "." : c.reasons ? "Empfohlen: " + c.reasons.join(" · ") : "";
  return '<div class="card cont"><div><div class="label">' + ICO.play + (c.resumed ? "Weiterlernen" : "Empfohlen als Nächstes") + '</div><div class="cont-top"><div style="min-width:0"><div class="crumb"><b>' + esc(c.crumb) + '</b></div><h3>' + esc(c.title) + '</h3></div>' + ringHtml + '</div></div><div class="cont-foot"><button class="btn primary lg" id="cont_go">Weiterlernen</button><span class="t-sub">' + esc(why) + '</span></div></div>';
}
function planList(plan) {
  if (!plan.items.length) return '<div class="card">' + emptyState("check", "Heute ist nichts geplant", ES.subtopics.length ? "Keine fälligen Vokabeln und keine Prüfung in den nächsten 60 Tagen." : "Lege im Lernplan Prüfungen mit Themen an – dann entsteht hier dein Tagesplan.", '<a class="btn sm" href="#/lernplan">Lernplan</a>') + '</div>';
  const done = plan.items.filter(i => i.done).length;
  return '<div class="list">' + plan.items.map((it, i) => '<div class="li' + (it.done ? " done" : "") + '" style="--li-inset:66px"><span class="ico' + (it.done ? "" : " accent") + '">' + (it.done ? ICO.check : ICO[it.kind === "vocab" || it.kind === "test" ? "vokabeln" : it.kind === "errors" ? "target" : "lernplan"]) + '</span><div class="li-main"><div class="li-title">' + esc(it.title) + '</div><div class="li-sub">' + esc(it.sub || "") + (it.reasons && it.reasons.length && it.kind === "subtopic" ? " · " + esc(it.reasons.slice(0, 2).join(" · ")) : "") + '</div></div><span class="li-trail">' + (it.doneMin ? it.doneMin + "/" : "") + it.minutes + ' Min.' + (it.done ? "" : '<button class="btn sm" data-plan="' + i + '">Starten</button>') + '</span></div>').join("") +
    '<div class="list-foot plan-foot"><span class="t-sub">' + done + ' von ' + plan.items.length + ' erledigt · Budget ' + plan.budget + ' Min.</span>' + (done < plan.items.length ? '<button class="btn primary sm" id="plan_go">' + ICO.play + 'Training starten</button>' : '') + '</div></div>';
}
function hwToday() {
  const t = todayISO(); const list = openHW().filter(h => h.faellig && h.faellig <= addDays(t, 1));
  if (!list.length) return "";
  return '<div class="list" style="margin-top:var(--s3)">' + list.slice(0, 6).map(h => { const d = daysUntil(h.faellig); return '<div class="li" style="--li-inset:66px"><span style="width:34px;display:flex;justify-content:center;flex:0 0 auto"><button class="check" data-done="' + esc(h.id) + '" aria-label="Erledigt"></button></span><div class="li-main"><div class="li-title">' + esc(h.aufgabe) + '</div><div class="li-sub">' + esc(h.typ === "todo" ? "To-do" : h.fach) + ' · ' + (d < 0 ? '<span class="over">überfällig</span>' : d === 0 ? "heute fällig" : "morgen fällig") + (h.dauer ? " · " + h.dauer + " Min." : "") + '</div></div><span class="dot" style="background:' + (h.typ === "todo" ? "var(--text-3)" : fcol(h.fach)) + '"></span></div>'; }).join("") + '</div>';
}
function weakList(limit) {
  const ws = weakSpots(limit);
  if (!ws.length) return emptyState("target", "Noch keine Schwachstellen erkannt", ES.events.length ? "Alles, was du geübt hast, sitzt bisher ordentlich." : "Noch nicht genug Lernaktivität für eine zuverlässige Einschätzung.").replace('class="empty"', 'class="empty sm"');
  return ws.map(w => '<div class="weak"><div class="meter' + (w.pct < 60 ? " weak" : "") + '" style="padding:0"><span class="mt-l">' + esc(w.label) + '<span class="mt-s">' + esc(w.sub) + '</span></span><span class="mt-v">' + w.pct + ' %</span>' + progBar(w.pct, w.pct < 60 ? "o" : "") + '</div><div class="weak-meta"><span>' + (w.kind === "subtopic" ? (w.errors ? plural(w.errors, "Fehler", "Fehler") + " in 14 Tagen · " : "") + "zuletzt geübt " + agoText(w.daysSince) : plural(w.errors, "Karte", "Karten") + " mit Fehlern") + (w.mistakes && w.mistakes.length ? " · " + esc(w.mistakes.join(", ")) : "") + '</span><a class="btn sm" href="' + w.href + '">Jetzt trainieren</a></div></div>').join("");
}
V.dashboard = () => {
  const kl = upcomingKL(); const next = kl[0];
  const head = d => '<header class="ph"><div><div class="eyebrow">' + esc(new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })) + ' · ' + esc(nowStatus()) + '</div><h1 class="t-large">' + greeting() + ', ' + esc((Api.user && Api.user.name) || (ES.profile && ES.profile.name) || USER_NAME) + '.</h1><p class="lead">' + esc(d) + '</p></div></header>';
  if (!engineReady()) return head("Dein Lern-Cockpit bekommt gerade eine Lern-Engine.") + '<div class="dash"><div class="a-cont">' + setupCard() + '</div><div class="a-today">' + sectionHead("Heute", '<a class="shl" href="#/aufgaben">Alle Aufgaben</a>') + (hwToday() || '<div class="card">' + emptyState("check", "Keine Aufgaben für heute", "") + '</div>') + '</div>' + lessonsToday() + '</div>';
  const plan = todayPlan(); const r = next ? readinessOf(next) : null; const open = plan.items.filter(i => !i.done);
  let sum = open.length ? "Heute " + (open.length === 1 ? "steht eine Lerneinheit" : "stehen " + open.length + " Lerneinheiten") + " an – etwa " + open.reduce((a, i) => a + i.minutes, 0) + " Minuten." : plan.items.length ? "Dein Tagesplan ist erledigt." : "Heute ist nichts geplant.";
  if (next) { const d = daysUntil(next.datum); sum += " Nächste Prüfung: " + next.fach + " " + (d === 0 ? "heute" : d === 1 ? "morgen" : "in " + d + " Tagen") + (r && r.score != null ? " – " + r.score + " % vorbereitet." : "."); }
  let exam;
  if (next) {
    const d = daysUntil(next.datum);
    exam = '<a class="card exam link" href="#/lernplan/' + esc(next.id) + '"><div class="eyebrow">Deine nächste Prüfung</div><div><div class="t-sub"><span class="dot" style="background:' + fcol(next.fach) + ';margin-right:6px"></span>' + esc(next.fach) + '</div><h3>' + esc(klTitle(next)) + '</h3><div class="meta">' + esc(fmtDL(next.datum)) + (next.uhrzeit ? " · " + esc(next.uhrzeit) : "") + '</div></div><div class="exam-days"><div><div class="t-sub" style="margin-bottom:6px">Noch</div><span class="num xl">' + d + '</span><span class="unit">' + (d === 1 ? "Tag" : "Tage") + '</span></div>' + (r.score != null ? ring(r.score / 100, 84, 7, r.score + "%", "bereit") : '') + '</div>' + (r.score == null ? '<div class="t-sub">' + (r.total ? "Noch nicht genug Lernaktivität für eine zuverlässige Einschätzung." : "Noch keine Unterthemen – lege sie im Lernplan an.") + '</div>' : '<div class="t-sub">Basis: ' + r.withData + ' von ' + r.total + ' Bereichen geübt</div>') + (kl.length > 1 ? '<div class="others">' + kl.slice(1, 3).map(k => '<span style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-2)"><span><b style="font-weight:500;color:var(--text)">' + esc(k.fach) + '</b> · ' + esc(klTitle(k)) + '</span><span>' + daysLabel(daysUntil(k.datum)) + '</span></span>').join("") + '</div>' : '') + '</a>';
  } else exam = '<div class="card exam">' + emptyState("flag", "Keine Prüfung geplant", "Trag die nächste ein, sobald der Klausurplan hängt.", '<a class="btn sm" href="#/lernplan">Zum Lernplan</a>') + '</div>';
  const un = unreadNews(); const t = todayISO(); const term = STATE.termine.filter(x => x.datum >= t && x.datum <= addDays(t, 10)).slice(0, 3);
  const info = (un.length || term.length) ? '<div class="a-info">' + sectionHead("Hinweise", '<a class="shl" href="#/info">Alle</a>') + '<div class="list">' + un.slice(0, 2).map(nw => '<a class="li" href="#/info"><div class="li-main"><div class="li-title">' + esc(nw.titel) + '</div><div class="li-sub">' + esc(nw.quelle || "Info") + (nw.info ? " · " + esc(nw.info) : "") + '</div></div><span class="dot" style="background:var(--accent)"></span></a>').join("") + term.map(x => '<a class="li" href="#/info"><div class="li-main"><div class="li-title">' + esc(x.titel) + '</div><div class="li-sub">' + esc(relDay(x.datum)) + (x.uhrzeit ? " · " + esc(x.uhrzeit) : "") + '</div></div>' + ((x.art === "pflicht" || x.art === "frist") ? '<span class="pill p-red">' + (x.art === "pflicht" ? "Pflicht" : "Frist") + '</span>' : '') + '</a>').join("") + '</div></div>' : '';
  return netNotice() + dbBanner() + head(sum) + '<div class="dash"><div class="a-cont">' + (tsActive() ? contCard(continueItem()) : missionCard(plan)) + '</div><div class="a-exam">' + exam + '</div>' +
    '<div class="a-today">' + sectionHead("Heute", '<button class="shl" id="plan_new" title="Plan mit aktuellen Daten neu berechnen">Neu planen</button>') + (hwToday() || '<div class="card">' + emptyState("check", "Keine Hausaufgaben für morgen", "").replace('class="empty"', 'class="empty sm"') + '</div>') + laterHW() + '</div>' +
    '<div class="a-weak">' + sectionHead("Deine Schwachstellen", '<a class="shl" href="#/fortschritt">Fortschritt</a>') + '<div class="card tight">' + weakList(3) + '</div></div>' + lessonsToday() + info + '</div>';
};
function bindDashboard() {
  if (!engineReady()) return;
  const c = document.getElementById("cont_go"); if (c) c.onclick = () => { const it = continueItem(); if (it && it.start) startTraining(it.start); };
  const plan = todayPlan();
  document.querySelectorAll("[data-plan]").forEach(b => b.onclick = () => startPlanItem(plan.items[+b.dataset.plan]));
  const go = document.getElementById("plan_go"); if (go) go.onclick = startNextPlanItem;
  const nw = document.getElementById("plan_new"); if (nw) nw.onclick = () => { todayPlan(true); route(); toast("Plan neu berechnet"); };
  const nt = document.getElementById("ms_notify"); if (nt) nt.onclick = async () => { try { const p = await Notification.requestPermission(); toast(p === "granted" ? "Erinnerung an – um " + setting("erinnerung_uhrzeit", "18:00") + " Uhr, falls der Auftrag noch offen ist" : "Erinnerungen sind im Browser blockiert", p !== "granted"); } catch (e) {} route(); };
}

/* =====================================================================
   VOKABELN · Sammlungen, Suche, Bearbeiten, Lernrichtung
   ===================================================================== */
let VOK_FILTER = "", VOK_LANG = "";
const colCards = c => cardsOf(c.id);
function colTile(c) {
  const cards = colCards(c); const st = Engine.vocabStats(cards, Date.now());
  return '<a class="tile" href="#/vokabeln/' + esc(c.id) + '">' + (st.due ? '<span class="due" title="fällig">' + st.due + '</span>' : '') + '<div><div class="tn">' + esc(c.name) + '</div><div class="tm">' + plural(st.total, "Karte", "Karten") + (st.fresh ? " · " + st.fresh + " neu" : "") + '</div></div><div class="tf">' + progBar(st.mastery, "thin") + '<span>' + st.secure + ' sicher</span></div></a>';
}
function vocabRow(v, showCol) {
  const col = colById(v.collection_id); const now = Date.now();
  const status = Engine.isNew(v) ? "noch nicht gelernt" : Engine.isDue(v, now) ? "heute dran" : "wieder am " + new Date(v.next_review_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const st = Engine.stageOf(v);
  return '<button class="vrow" data-editvo="' + esc(v.id) + '"><span class="vt">' + esc(v.begriff) + '</span><span class="vb">' + esc(v.bedeutung) + (showCol && col ? ' <span class="t-cap">· ' + esc(col.name) + '</span>' : '') + '</span><span class="t-cap vstat">' + status + '</span><span class="stage ' + st.key + '" title="' + esc(stageHint(v)) + '">' + st.label + '</span></button>';
}
/** Erklärung der Stufe in Alltagssprache */
function stageHint(v) {
  if (Engine.isNew(v)) return "Noch nicht gelernt";
  const m = Engine.memoryOf(v); const p = Math.round(Engine.recallProbability(v, Date.now()) * 100);
  return "Heute erinnerst du dich mit etwa " + p + " % Wahrscheinlichkeit · stabil für ca. " + Math.round(m.S) + " Tage";
}
const HOWTO = '<details class="card howto"><summary>So lernst du hier – und warum es funktioniert</summary><ol>' +
  '<li><b>Neue Wörter:</b> ansehen, einmal abschreiben, dann <b>3× richtig aus dem Kopf</b> – mit Abstand dazwischen. Danach an späteren Tagen je 1×.</li>' +
  '<li><b>Fehler:</b> Du siehst die richtige Lösung (falsche Buchstaben markiert) und tippst sie einmal ab. Nach ein paar anderen Wörtern kommt es noch einmal – dann ohne Vorlage.</li>' +
  '<li><b>Klares Ende:</b> Eine Runde ist fertig, wenn jedes Wort sein Ziel erreicht hat. Höchstens 10 neue Wörter pro Tag, dann heißt es „Fertig für heute“.</li>' +
  '<li><b>Wiederholung zur richtigen Zeit:</b> Ein Wort kommt wieder, kurz bevor du es vergessen würdest (FSRS). Jedes Mal hält es länger: Lernen → Kurzzeit → Gefestigt → Langzeit.</li>' +
  '<li><b>Verteilt statt gepaukt:</b> Zweimal 10 Minuten an zwei Tagen bringen mehr als 20 Minuten am Stück. Schlaf dazwischen hilft beim Festigen.</li></ol>' +
  '<div class="src">Grundlagen: Karpicke & Roediger 2008 (Abrufen statt Wiederlesen) · Rawson & Dunlosky 2011 (3 richtige Abrufe, dann Wiederholen an späteren Tagen) · Pashler u. a. 2005 (Rückmeldung mit Lösung) · Cepeda u. a. 2008 (Abstände) · FSRS-6, getestet an ~727 Mio. echten Wiederholungen (open-spaced-repetition).</div></details>';
function lvlDots(m) { const n = Math.round((m || 0) / 20); let h = '<span class="lvl" title="Lernstand ' + (m || 0) + ' %">'; for (let i = 1; i <= 5; i++) h += '<i class="' + (i <= n ? "on" : "") + '"></i>'; return h + '</span>'; }
V.vokabeln = () => {
  if (!engineReady()) return pageHead("Vokabeln") + setupCard();
  if (ROUTE.sub) return vokCollection(decodeURIComponent(ROUTE.sub));
  const now = Date.now(); const all = Engine.vocabStats(STATE.vo, now); const due = vocabDue().reduce((a, x) => a + x.count, 0);
  const langs = [...new Set(ES.collections.map(c => c.source_language))];
  const head = pageHead("Vokabeln", { sub: all.total ? plural(all.total, "Karte", "Karten") + " in " + plural(ES.collections.length, "Sammlung", "Sammlungen") + " · " + all.secure + " sicher · " + due + " fällig" : "Lege deine erste Sammlung an.", actions: '<button class="btn" id="vt_new">' + ICO.plus + 'Test eintragen</button><button class="btn" id="col_new">' + ICO.plus + 'Sammlung</button><button class="btn primary" id="v_new">' + ICO.plus + 'Vokabel</button>' });
  const day = dayStatus();
  const daily = '<div class="card daily">' + ring(all.total ? all.mastery / 100 : 0, 64, 6, all.mastery + "%", "Ø") + '<div class="dm"><div class="t-headline">' + (day.open ? "Heute: " + [day.due ? plural(day.due, "Wiederholung", "Wiederholungen") : "", day.fresh ? plural(day.fresh, "neues Wort", "neue Wörter") : ""].filter(Boolean).join(" + ") : "Fertig für heute ✓") + '</div><div class="t-sub">' + (day.open ? "Etwa " + Math.max(3, Math.round(day.due * 0.4 + day.fresh * 1.2)) + " Minuten. Die Runde endet, wenn jedes Wort sitzt." : (day.tomorrow ? "Morgen " + (day.tomorrow === 1 ? "kommt 1 Wort" : "kommen " + day.tomorrow + " Wörter") + " wieder dran." : "Die nächsten Wörter kommen, kurz bevor du sie vergessen würdest.") + " Freiwillig üben geht trotzdem.") + '</div></div><div class="dact">' + (all.trouble ? '<button class="btn" data-vstart="errors">Fehlertraining</button>' : '') + '<button class="btn primary" data-vstart="vocab">' + (day.open ? "Lernrunde starten" : "Zusatzrunde") + '</button></div></div>' + HOWTO;
  const search = '<div class="coll-tools" style="margin-top:var(--s7)"><label class="search"><span>' + ICO.search + '</span><input id="v_filter" placeholder="Alle Vokabeln durchsuchen" value="' + esc(VOK_FILTER) + '"></label>' + (langs.length > 1 ? '<div class="seg"><button class="' + (!VOK_LANG ? "on" : "") + '" data-vlang="">Alle</button>' + langs.map(l => '<button class="' + (VOK_LANG === l ? "on" : "") + '" data-vlang="' + esc(l) + '">' + esc(groupName(l)) + '</button>').join("") + '</div>' : '') + '</div>';
  if (VOK_FILTER.trim()) {
    const f = Engine.normalize(VOK_FILTER);
    const res = STATE.vo.filter(v => (!VOK_LANG || (colById(v.collection_id) || {}).source_language === VOK_LANG) && (Engine.normalize(v.begriff).includes(f) || Engine.normalize(v.bedeutung).includes(f) || (v.alternatives || []).some(a => Engine.normalize(a).includes(f))));
    return head + daily + search + sectionHead("Suchergebnisse", '<span class="sub">' + res.length + '</span>') + (res.length ? '<div class="list">' + res.slice(0, 100).map(v => vocabRow(v, true)).join("") + '</div>' : '<div class="card">' + emptyState("search", "Nichts gefunden", "Keine Vokabel passt zu „" + esc(VOK_FILTER) + "“.") + '</div>');
  }
  const groups = {}; ES.collections.filter(c => !VOK_LANG || c.source_language === VOK_LANG).forEach(c => (groups[c.source_language] = groups[c.source_language] || []).push(c));
  const order = ["fr", "en", "la", "es", "de"].filter(l => groups[l]).concat(Object.keys(groups).filter(l => !["fr", "en", "la", "es", "de"].includes(l)));
  const body = order.map(l => { const cols = groups[l].sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true })); const cards = cols.flatMap(colCards); const st = Engine.vocabStats(cards, now);
    return '<div class="section"><div class="lang-h"><h2>' + esc(groupName(l)) + '</h2><span class="t-sub">' + plural(st.total, "Karte", "Karten") + ' · ' + st.secure + ' sicher</span></div><div class="tiles">' + cols.map(colTile).join("") + '</div></div>'; }).join("");
  // Anstehende Vokabeltests ganz oben – mit direktem Weg zum Lernen
  const tests = upcomingTests();
  const testsBox = tests.length ? '<div class="section" style="margin-top:0">' + sectionHead("Vokabeltests") + '<div class="list">' + tests.map(k => { const d = daysUntil(k.datum); const n = testCards(k).length; const st = n ? testStatusOf(k) : null; const q = n ? testQueueOf(k).length : 0;
    return '<a class="li" href="#/lernplan/' + esc(k.id) + '"><span class="ico accent">' + ICO.vokabeln + '</span><div class="li-main"><div class="li-title">' + esc(vtName(k)) + '</div><div class="li-sub">' + esc(k.fach) + ' · ' + (d === 0 ? "heute" : d === 1 ? "morgen" : "in " + d + " Tagen") + ' · ' + (!n ? '<span style="color:var(--orange)">noch keine Vokabeln eingetragen</span>' : (q ? q + " heute dran" : "heute erledigt") + (st.expected != null ? " · erwartet " + st.expected + " %" : "")) + '</div></div><span class="li-trail"><span class="btn ' + (n && !q ? "" : "primary ") + 'sm">' + (!n ? "Vokabeln eintragen" : q ? "Lernen" : "Ansehen") + '</span></span></a>'; }).join("") + '</div></div>' : '';
  return netNotice() + head + testsBox + daily + search + (ES.collections.length ? body : '<div class="section"><div class="card">' + emptyState("vokabeln", "Noch keine Sammlung", "Eine Sammlung ist wie ein Ordner, z. B. „Unité 4“.", '<button class="btn primary sm" id="col_new2">Sammlung anlegen</button>') + '</div></div>');
};
function vokCollection(id) {
  let c = colById(id);
  if (!c) { c = ES.collections.find(x => x.name === id); if (c) { location.replace("#/vokabeln/" + c.id); return ""; } return pageHead("Sammlung", { back: ["#/vokabeln", "Vokabeln"] }) + '<div class="card">' + emptyState("vokabeln", "Sammlung nicht gefunden", "Vielleicht wurde sie gelöscht.") + '</div>'; }
  const cards = colCards(c); const st = Engine.vocabStats(cards, Date.now()); const f = Engine.normalize(VOK_FILTER);
  const list = cards.filter(v => !f || Engine.normalize(v.begriff).includes(f) || Engine.normalize(v.bedeutung).includes(f)).sort((a, b) => String(a.created_at || a.id).localeCompare(String(b.created_at || b.id)));
  const dir = dirPref(c.id); const vt = testForCollection(c.id);
  const head = pageHead(esc(c.name), { back: ["#/vokabeln", "Vokabeln"], eyebrow: esc(isTermCollection(c) ? "Fachbegriffe" + (c.subject_id ? " · " + ((ES.subjects.find(x => x.id === c.subject_id) || {}).name || "") : "") : langName(c.source_language) + " → " + langName(c.target_language)), sub: plural(st.total, "Karte", "Karten") + " · " + st.due + " fällig · " + st.secure + " sicher · " + st.fresh + " neu" + (c.description ? " · " + esc(c.description) : ""), actions: '<button class="btn" id="col_edit">Bearbeiten</button>' + (isTermCollection(c) ? '' : '<button class="btn" id="vt_new">' + (vt ? "Zum Test" : "Test eintragen") + '</button>') + '<button class="btn" id="v_import">Liste einfügen</button><button class="btn" id="v_new">' + ICO.plus + 'Karte</button><button class="btn primary" data-vstart="vocab">' + ICO.play + 'Lernen</button>' });
  const tools = '<div class="coll-tools"><div class="dirsw"><span class="t-sub">Abfrage</span><div class="seg"><button class="' + (dir === "forward" ? "on" : "") + '" data-vdir="forward">' + esc(dirLabel(c, "forward")) + '</button><button class="' + (dir === "reverse" ? "on" : "") + '" data-vdir="reverse">' + esc(dirLabel(c, "reverse")) + '</button></div></div><label class="search"><span>' + ICO.search + '</span><input id="v_filter" placeholder="In ' + esc(c.name) + ' suchen" value="' + esc(VOK_FILTER) + '"></label></div>';
  const rows = list.length ? '<div class="list">' + list.slice(0, 300).map(v => vocabRow(v)).join("") + '</div>' + (list.length > 300 ? '<div class="t-sub" style="padding:12px 4px">… und ' + (list.length - 300) + ' weitere. Nutze die Suche.</div>' : '') : '<div class="card">' + (cards.length ? emptyState("search", "Nichts gefunden", "Keine Karte passt zu „" + esc(VOK_FILTER) + "“.") : emptyState("vokabeln", "Leere Sammlung", "Füge die erste Karte hinzu.", '<button class="btn primary sm" id="v_new2">Karte hinzufügen</button>')) + '</div>';
  const vtNote = vt ? '<div class="notice"><span class="dot" style="background:var(--accent)"></span><span><b>Vokabeltest ' + esc(whenText(daysUntil(vt.datum))) + ':</b> ' + esc(vtName(vt)) + ' · ' + testStatusOf(vt).secure + ' von ' + testStatusOf(vt).total + ' sitzen</span><a class="btn primary sm" href="#/lernplan/' + esc(vt.id) + '">Zum Test</a></div>' : '';
  return netNotice() + head + vtNote + tools + rows;
}
const LANG_OPTS = [["fr", "Französisch"], ["en", "Englisch"], ["la", "Latein"], ["es", "Spanisch"], ["de", "Deutsch"]];
function collectionModal(c) {
  const isNew = !c; c = c || { name: "", description: "", source_language: VOK_LANG || "fr", target_language: "de" };
  openModal(isNew ? "Neue Sammlung" : "Sammlung bearbeiten", '<div class="form"><label class="fld">Name<input id="c_name" value="' + esc(c.name) + '" placeholder="z. B. Unité 4" maxlength="80"></label><div class="form c2"><label class="fld">Sprache der Begriffe<select id="c_src">' + LANG_OPTS.map(l => '<option value="' + l[0] + '"' + (c.source_language === l[0] ? " selected" : "") + '>' + l[1] + '</option>').join("") + '</select></label><label class="fld">Übersetzung in<select id="c_tgt">' + LANG_OPTS.map(l => '<option value="' + l[0] + '"' + (c.target_language === l[0] ? " selected" : "") + '>' + l[1] + '</option>').join("") + '</select></label></div><label class="fld">Beschreibung (optional)<input id="c_desc" value="' + esc(c.description || "") + '"></label></div>',
    (isNew ? '' : '<button class="btn danger left" id="c_del">Löschen</button>') + '<button class="btn" id="c_cancel">Abbrechen</button><button class="btn primary" id="c_save">Speichern</button>', () => {
      const q = id => document.getElementById(id);
      q("c_cancel").onclick = closeModal;
      q("c_save").onclick = async () => {
        const name = val("c_name"); if (!name) { q("c_name").focus(); return; }
        if (ES.collections.some(x => x.name.toLowerCase() === name.toLowerCase() && x.id !== c.id)) { toast("Es gibt schon eine Sammlung mit diesem Namen.", true); return; }
        const row = { name, source_language: val("c_src"), target_language: val("c_tgt"), description: val("c_desc") || null, subject_id: val("c_src") === "de" ? subjectId(subjectInName(name)) : subjectId(langName(val("c_src"))) };
        try {
          if (isNew) { const r = await dbInsert("vocab_collections", row); closeModal(); location.hash = "#/vokabeln/" + r.row.id; toast("Sammlung angelegt"); }
          else {
            const old = Object.assign({}, c), oldName = old.name;
            await dbPatch("vocab_collections", c.id, row);
            if (row.name !== oldName) for (const k of STATE.kl.filter(k => (k.vokabel_lektionen || []).some(x => String(x).toLowerCase() === oldName.toLowerCase()))) await saveKL(k, { vokabel_lektionen: k.vokabel_lektionen.map(x => String(x).toLowerCase() === oldName.toLowerCase() ? row.name : x) });
            if (row.source_language !== old.source_language || row.target_language !== old.target_language || row.name !== old.name) { const ids = colCards(c).map(v => encodeURIComponent(v.id)); colCards(c).forEach(v => Object.assign(v, { source_language: row.source_language, target_language: row.target_language, sprache: name })); for (let i = 0; i < ids.length; i += 150) await Api.write("PATCH", "vokabeln", "id=in.(" + ids.slice(i, i + 150).join(",") + ")", { source_language: row.source_language, target_language: row.target_language, sprache: name }); }
            closeModal(); route(); toast("Gespeichert");
          }
        } catch (e) { toast("Speichern fehlgeschlagen: " + e.message, true); }
      };
      const d = q("c_del"); if (d) d.onclick = async () => { const n = colCards(c).length; if (!confirm("Sammlung „" + c.name + "“ " + (n ? "mit " + plural(n, "Karte", "Karten") + " " : "") + "löschen? Das lässt sich nicht rückgängig machen.")) return; try { await dbDelete("vocab_collections", c.id); STATE.vo = STATE.vo.filter(v => v.collection_id !== c.id); bump(); closeModal(); location.hash = "#/vokabeln"; toast("Sammlung gelöscht"); } catch (e) { toast("Löschen fehlgeschlagen: " + e.message, true); } };
    });
}
function vocabModal(v, presetCol) {
  const isNew = !v; v = v || { begriff: "", bedeutung: "", alternatives: [], example_sentence: "", notes: "", collection_id: presetCol || (ES.collections[0] || {}).id };
  if (!ES.collections.length) { toast("Lege zuerst eine Sammlung an.", true); collectionModal(); return; }
  const stats = isNew ? "" : '<div class="vstats"><span>' + v.correct_count + ' richtig</span><span>' + v.incorrect_count + ' falsch</span><span>Lernstand ' + v.mastery + ' %</span><span>' + (Engine.isNew(v) ? "noch nicht abgefragt" : "nächste Wiederholung " + new Date(v.next_review_at).toLocaleDateString("de-DE")) + '</span></div>';
  openModal(isNew ? "Neue Vokabel" : "Vokabel bearbeiten", stats + '<div class="form"><div class="form c2"><label class="fld">Begriff<input id="e_term" value="' + esc(v.begriff) + '" autocomplete="off" autocapitalize="off"></label><label class="fld">Übersetzung<input id="e_tr" value="' + esc(v.bedeutung) + '" autocomplete="off"></label></div><label class="fld">Weitere richtige Übersetzungen <span class="t-cap">(durch Komma getrennt)</span><input id="e_alt" value="' + esc((v.alternatives || []).join(", ")) + '" placeholder="z. B. schaffen, hinkriegen"></label><label class="fld">Beispielsatz<input id="e_ex" value="' + esc(v.example_sentence || "") + '"></label><label class="fld">Notiz<input id="e_note" value="' + esc(v.notes || "") + '"></label><label class="fld">Sammlung<select id="e_col">' + ES.collections.map(c => '<option value="' + esc(c.id) + '"' + (c.id === v.collection_id ? " selected" : "") + '>' + esc(c.name) + ' (' + esc(groupName(c.source_language)) + ')</option>').join("") + '</select></label></div>',
    (isNew ? '<button class="btn" id="e_cancel">Fertig</button><button class="btn primary" id="e_save">Hinzufügen</button>' : '<button class="btn danger left" id="e_del">Löschen</button><button class="btn" id="e_cancel">Abbrechen</button><button class="btn primary" id="e_save">Speichern</button>'), () => {
      const q = id => document.getElementById(id);
      q("e_cancel").onclick = () => { closeModal(); route(); };
      const save = async () => {
        const term = val("e_term"), tr = val("e_tr"); if (!term || !tr) { q(term ? "e_tr" : "e_term").focus(); return; }
        const col = colById(val("e_col"));
        const row = { begriff: term, bedeutung: tr, alternatives: val("e_alt").split(/\s*,\s*/).filter(Boolean), example_sentence: val("e_ex") || null, notes: val("e_note") || null, collection_id: col.id, sprache: col.name, source_language: col.source_language, target_language: col.target_language, subject_id: col.subject_id || null };
        const btn = q("e_save"); btn.classList.add("loading");
        try {
          if (isNew) {
            const dup = STATE.vo.find(x => x.collection_id === col.id && Engine.normalize(x.begriff) === Engine.normalize(term));
            if (dup && !confirm("„" + term + "“ gibt es in dieser Sammlung schon. Trotzdem anlegen?")) { btn.classList.remove("loading"); return; }
            const r = await Api.insert("vokabeln", Object.assign({ level: 0, next: todayISO() }, row));
            STATE.vo.push(normVO(r || row)); bump();
            toast("„" + term + "“ gespeichert"); ["e_term", "e_tr", "e_alt", "e_ex", "e_note"].forEach(id => q(id).value = ""); q("e_term").focus(); btn.classList.remove("loading");
          } else { await dbPatch("vokabeln", v.id, row); closeModal(); route(); toast("Gespeichert"); }
        } catch (e) { btn.classList.remove("loading"); toast(e.network ? "Keine Verbindung – die Vokabel wurde nicht gespeichert. Deine Eingabe bleibt im Formular." : "Speichern fehlgeschlagen: " + e.message, true); }
      };
      q("e_save").onclick = save; q("e_tr").onkeydown = e => { if (e.key === "Enter") save(); };
      const d = q("e_del"); if (d) d.onclick = async () => { if (!confirm("„" + v.begriff + "“ löschen?")) return; try { await dbDelete("vokabeln", v.id); closeModal(); route(); toast("Gelöscht"); } catch (e) { toast("Löschen fehlgeschlagen: " + e.message, true); } };
      setTimeout(() => q("e_term").focus(), 50);
    });
}
/** Start-Dialog für Vokabel-Sessions: Sammlung, Modus, Richtung, Anzahl */
function vocabStartModal(mode, colId) {
  const cols = ES.collections; let sel = colId || "", dir = dirPref(sel), m = mode || "vocab", count = 20;
  const render = () => {
    const c = sel ? colById(sel) : null; const pool = c ? colCards(c) : STATE.vo; const now = Date.now();
    const ds = dayStatus(pool);
    const avail = m === "errors" ? pool.filter(Engine.isTrouble).length : m === "vocab" ? Math.min(ds.due, Engine.ROUND.maxCards) + Math.min(Engine.ROUND.maxNew, ds.fresh) : pool.length;
    return '<div class="form"><label class="fld">Sammlung<select id="vs_col"><option value="">Alle Sammlungen</option>' + cols.map(x => '<option value="' + esc(x.id) + '"' + (x.id === sel ? " selected" : "") + '>' + esc(x.name) + '</option>').join("") + '</select></label>' +
      '<label class="fld">Modus</label><div class="seg full" style="margin-top:-6px"><button data-vsm="vocab" class="' + (m === "vocab" ? "on" : "") + '">Abfrage</button><button data-vsm="mixed" class="' + (m === "mixed" ? "on" : "") + '">Gemischt</button><button data-vsm="errors" class="' + (m === "errors" ? "on" : "") + '">Fehler</button></div>' +
      '<label class="fld">Richtung</label><div class="seg full" style="margin-top:-6px"><button data-vsd="forward" class="' + (dir === "forward" ? "on" : "") + '">' + esc(dirLabel(c, "forward")) + '</button><button data-vsd="reverse" class="' + (dir === "reverse" ? "on" : "") + '">' + esc(dirLabel(c, "reverse")) + '</button></div>' +
      (m === "mixed" ? '' : '<label class="fld">Höchstens<div class="seg full">' + [10, 20, 40].map(n => '<button data-vsn="' + n + '" class="' + (count === n ? "on" : "") + '">' + n + ' Karten</button>').join("") + '</div></label>') +
      '<p class="hint">' + (m === "vocab" ? (avail ? "Lernrunde mit " + plural(Math.min(avail, count), "Wort", "Wörtern") + ": fällige zuerst, dann neue. Neue brauchen 3 richtige Antworten, Wiederholungen eine – dann ist die Runde fertig." : "Für heute ist alles erledigt. Die Zusatzrunde nimmt die 10 Wörter, die du am ehesten vergisst.") : m === "errors" ? (avail ? plural(avail, "Karte", "Karten") + " mit Fehlern." : "Keine Fehlerkarten in dieser Auswahl.") : "Abwechselnd Freitext, Multiple Choice und Zuordnung.") + '</p></div>';
  };
  openModal("Vokabeln lernen", '<div id="vs_body">' + render() + '</div>', '<button class="btn" id="vs_cancel">Abbrechen</button><button class="btn primary" id="vs_go">' + ICO.play + 'Starten</button>', () => {
    const bind = () => {
      const q = id => document.getElementById(id);
      q("vs_col").onchange = e => { sel = e.target.value; dir = dirPref(sel); upd(); };
      document.querySelectorAll("[data-vsm]").forEach(b => b.onclick = () => { m = b.dataset.vsm; upd(); });
      document.querySelectorAll("[data-vsd]").forEach(b => b.onclick = () => { dir = b.dataset.vsd; upd(); });
      document.querySelectorAll("[data-vsn]").forEach(b => b.onclick = () => { count = +b.dataset.vsn; upd(); });
    };
    const upd = () => { document.getElementById("vs_body").innerHTML = render(); bind(); };
    bind();
    document.getElementById("vs_cancel").onclick = closeModal;
    document.getElementById("vs_go").onclick = () => { setDirPref(sel, dir); startTraining({ mode: m, collection_id: sel || null, direction: dir, count }); };
  });
}
function bindVokabeln() {
  const q = id => document.getElementById(id);
  const colId = ROUTE.sub ? decodeURIComponent(ROUTE.sub) : null;
  ["v_new", "v_new2"].forEach(id => { const b = q(id); if (b) b.onclick = () => vocabModal(null, colId); });
  ["col_new", "col_new2"].forEach(id => { const b = q(id); if (b) b.onclick = () => collectionModal(); });
  const ce = q("col_edit"); if (ce) ce.onclick = () => collectionModal(colById(colId));
  const vtn = q("vt_new"); if (vtn) vtn.onclick = () => { const k = colId && testForCollection(colId); if (k) location.hash = "#/lernplan/" + k.id; else testModal(null, colId); };
  const im = q("v_import"); if (im) im.onclick = () => importModal(colId);
  document.querySelectorAll("[data-vstart]").forEach(b => b.onclick = () => vocabStartModal(b.dataset.vstart, colId));
  document.querySelectorAll("[data-vdir]").forEach(b => b.onclick = () => { setDirPref(colId, b.dataset.vdir); route(); });
  document.querySelectorAll("[data-vlang]").forEach(b => b.onclick = () => { VOK_LANG = b.dataset.vlang; route(); });
  document.querySelectorAll("[data-editvo]").forEach(b => b.onclick = () => { const v = STATE.vo.find(x => String(x.id) === b.dataset.editvo); if (v) vocabModal(v); });
  const vf = q("v_filter"); if (vf) vf.oninput = debounce(() => { VOK_FILTER = vf.value; const pos = vf.selectionStart; route(); const nf = q("v_filter"); if (nf) { nf.focus(); nf.setSelectionRange(pos, pos); } }, 200);
}

/* =====================================================================
   TRAINER · Start
   ===================================================================== */
V.trainer = () => {
  if (ROUTE.sub === "session") return V.trainerSession();
  if (!engineReady()) return pageHead("Trainer") + setupCard();
  const plan = todayPlan(); const open = plan.items.filter(i => !i.done);
  const head = pageHead("Trainer", { sub: "Der aktive Lernmodus. Wähle, was du trainieren willst – der Rest der App tritt in den Hintergrund." });
  const running = tsActive() ? '<div class="notice"><span class="timer" data-tsstate><i></i><span data-tstime>' + tsClock() + '</span></span><span class="t-callout" style="color:var(--text)">' + esc(TS.label) + (TS.status === "paused" ? " · pausiert" : " · läuft") + '</span><a class="btn primary sm" href="#/trainer/session">Fortsetzen</a></div>' : '';
  const planCard = '<div class="section" style="margin-top:0">' + sectionHead("Dein Plan für heute", '<span class="sub">' + plan.items.reduce((a, i) => a + i.minutes, 0) + ' Min.</span>') + planList(plan) + '</div>';
  const due = vocabDue().reduce((a, x) => a + x.count, 0); const trouble = troubleCards().length + troubleExercises().length;
  const modes = '<div class="section">' + sectionHead("Modus wählen") + '<div class="starter">' +
    '<button class="opt" data-mode="vocab"><span class="oi">' + ICO.vokabeln + '</span><span class="ot">Vokabeln</span><span class="od">Abfrage nach Wiederholungsplan, in der Richtung deiner Wahl.</span><span class="om">' + (due ? due + " fällig" : "nichts fällig") + '</span></button>' +
    '<button class="opt" data-mode="errors"><span class="oi">' + ICO.target + '</span><span class="ot">Fehlertraining</span><span class="od">Nur Vokabeln und Aufgaben, bei denen du Schwierigkeiten hattest.</span><span class="om">' + plural(trouble, "Element", "Elemente") + '</span></button>' +
    '<button class="opt" data-mode="mixed"><span class="oi">' + ICO.dumbbell + '</span><span class="ot">Gemischtes Training</span><span class="od">Multiple Choice, Freitext, Übersetzung, Zuordnung und kurze Schreibaufgaben.</span><span class="om">aus deinen schwächsten Themen</span></button>' +
    '<button class="opt" data-mode="exam"><span class="oi">' + ICO.clock + '</span><span class="ot">Prüfungsmodus</span><span class="od">Mit Zeitlimit, ohne Hinweise. Auswertung am Ende.</span><span class="om">' + (upcomingKL().length ? "für " + esc(upcomingKL()[0].fach) + " und weitere" : "braucht eine Prüfung") + '</span></button>' +
    '<button class="opt" data-mode="free"><span class="oi">' + ICO.bulb + '</span><span class="ot">Freie Lernzeit</span><span class="od">Nur der Timer – für Hausaufgaben, Lesen oder Zusammenfassungen.</span><span class="om">zählt in deine Lernzeit</span></button></div></div>';
  const prio = priorities().slice(0, 6);
  const topics = prio.length ? '<div class="section">' + sectionHead("Empfohlene Unterthemen", '<a class="shl" href="#/lernplan">Lernplan</a>') + '<div class="list">' + prio.map(p => { const m = masteryOf(p.subtopic.id); return '<button class="li tap" data-topic="' + esc(p.subtopic.id) + '" style="width:100%;border:none;background:none;font:inherit;text-align:left"><div class="li-main"><div class="li-title">' + esc(p.subtopic.title) + '</div><div class="li-sub">' + esc((p.exam ? p.exam.fach + " · " : "") + p.topic.title + " · " + p.reasons.join(" · ")) + '</div></div><span class="li-trail st-trail">' + masteryBadge(m.score) + '<span class="chev">' + ICO.chev + '</span></span></button>'; }).join("") + '</div></div>' : '';
  return netNotice() + head + running + planCard + modes + topics;
};
function examStartModal(examId, topicId) {
  const exams = upcomingKL().filter(k => topicsOfExam(k.id).length);
  if (!exams.length) { toast("Lege zuerst Themen und Unterthemen für eine Prüfung an.", true); return; }
  let ex = examId != null ? klById(examId) : exams[0];
  openModal("Prüfungsmodus", '<div class="form"><label class="fld">Prüfung<select id="xm_ex">' + exams.map(k => '<option value="' + esc(k.id) + '"' + (ex && k.id === ex.id ? " selected" : "") + '>' + esc(k.fach + " · " + klTitle(k)) + '</option>').join("") + '</select></label><label class="fld">Thema<select id="xm_tp"></select></label><label class="fld">Zeit<div class="seg full">' + [15, 30, 45, 90].map(n => '<button data-xmin="' + n + '" class="' + (n === 45 ? "on" : "") + '">' + n + ' Min.</button>').join("") + '</div></label><p class="hint">Mehrere Aufgaben aus deinen schwächsten Unterthemen. Keine Hinweise, keine Rückmeldung zwischendurch – die Auswertung kommt am Ende. Die Zeit läuft auch weiter, wenn du die App kurz verlässt.</p></div>',
    '<button class="btn" id="xm_cancel">Abbrechen</button><button class="btn primary" id="xm_go">' + ICO.play + 'Prüfung starten</button>', () => {
      const q = id => document.getElementById(id); let mins = 45;
      const fillTopics = () => { const k = klById(q("xm_ex").value); q("xm_tp").innerHTML = '<option value="">Alle Themen</option>' + topicsOfExam(k.id).map(t => '<option value="' + esc(t.id) + '"' + (t.id === topicId ? " selected" : "") + '>' + esc(t.title) + '</option>').join(""); };
      fillTopics(); q("xm_ex").onchange = fillTopics;
      document.querySelectorAll("[data-xmin]").forEach(b => b.onclick = () => { mins = +b.dataset.xmin; document.querySelectorAll("[data-xmin]").forEach(x => x.classList.toggle("on", x === b)); });
      q("xm_cancel").onclick = closeModal;
      q("xm_go").onclick = () => startTraining({ mode: "exam", exam_id: q("xm_ex").value, topic_id: q("xm_tp").value || null, minutes: mins, count: Math.max(4, Math.round(mins / 6)) });
    });
}
function mixedStartModal() {
  const exams = upcomingKL().filter(k => topicsOfExam(k.id).length);
  openModal("Gemischtes Training", '<div class="form"><label class="fld">Worum geht es?<select id="mx_sc"><option value="">Meine schwächsten Themen + fällige Vokabeln</option>' + exams.map(k => '<option value="exam:' + esc(k.id) + '">' + esc(k.fach + " · " + klTitle(k)) + '</option>').join("") + ES.collections.map(c => '<option value="col:' + esc(c.id) + '">Vokabeln · ' + esc(c.name) + '</option>').join("") + '</select></label><p class="hint">Abwechselnd Multiple Choice, Freitext, Übersetzung, Zuordnung und kurze Schreibaufgaben – mit Rückmeldung nach jeder Aufgabe.</p></div>',
    '<button class="btn" id="mx_cancel">Abbrechen</button><button class="btn primary" id="mx_go">' + ICO.play + 'Starten</button>', () => {
      document.getElementById("mx_cancel").onclick = closeModal;
      document.getElementById("mx_go").onclick = () => { const v = val("mx_sc"); const [k, id] = v.split(":"); startTraining({ mode: "mixed", exam_id: k === "exam" ? id : null, collection_id: k === "col" ? id : null, direction: dirPref(k === "col" ? id : "") }); };
    });
}
function freeStartModal() { startTraining({ mode: "free", label: "Freie Lernzeit" }); }
function bindTrainer() {
  if (ROUTE.sub === "session") { bindTrainerSession(); return; }
  if (ROUTE.sub === "start") {   // Deep-Link: #/trainer/start?mode=…&sub=…&col=…&exam=…
    const q = ROUTE.query; history.replaceState(null, "", "#/trainer");
    if (q.mode === "topic" && q.sub) startTraining({ mode: "topic", subtopic_id: q.sub });
    else if (q.mode === "exam") examStartModal(q.exam, q.topic);
    else if (q.mode === "errors") startTraining({ mode: "errors", collection_id: q.col || null, subtopic_id: q.sub || null, direction: dirPref(q.col) });
    else if (q.mode === "vocab" || q.mode === "mixed") vocabStartModal(q.mode, q.col);
    else if (q.mode === "free") freeStartModal();
  }
  const plan = todayPlan();
  document.querySelectorAll("[data-plan]").forEach(b => b.onclick = () => startPlanItem(plan.items[+b.dataset.plan]));
  const go = document.getElementById("plan_go"); if (go) go.onclick = startNextPlanItem;
  document.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { const m = b.dataset.mode; if (m === "vocab" || m === "errors") vocabStartModal(m); else if (m === "mixed") mixedStartModal(); else if (m === "exam") examStartModal(); else freeStartModal(); });
  document.querySelectorAll("[data-topic]").forEach(b => b.onclick = () => startTraining({ mode: "topic", subtopic_id: b.dataset.topic }));
}

/* =====================================================================
   ROUTER
   ===================================================================== */
const ROUTE = { name: "dashboard", sub: "", id: "", query: {} };
const ALIASES = { klausuren: "lernplan", klausur: "lernplan", statistik: "fortschritt" };
const OWN_HEADER = ["dashboard", "vokabeln", "lernplan", "trainer", "ki", "fortschritt", "auth"];
const ENGINE_FREE = ["aufgaben", "stundenplan", "noten", "info", "ernaehrung", "einstellungen"];
function parseRoute() {
  let h = location.hash.replace(/^#\/?/, ""); const qi = h.indexOf("?"); let q = {};
  if (qi >= 0) { new URLSearchParams(h.slice(qi + 1)).forEach((v, k) => q[k] = v); h = h.slice(0, qi); }
  const parts = h.split("/").filter(Boolean);
  let name = parts[0] || "dashboard", sub = parts[1] ? decodeURIComponent(parts[1]) : "";
  if (name === "fokus") { name = "trainer"; sub = ""; q = { mode: "free" }; }
  if (name === "trainer" && (sub === "vok" || sub === "thema")) sub = "";      // alte Phase-1-Links
  if (ALIASES[name]) name = ALIASES[name];
  ROUTE.name = name; ROUTE.sub = sub; ROUTE.id = name === "lernplan" ? sub : ""; ROUTE.query = q;
  if (!V[ROUTE.name] || ROUTE.name === "auth" || ROUTE.name === "trainerSession") { ROUTE.name = "dashboard"; ROUTE.sub = ""; }
}
let LAST_KEY = "";
function skeleton() { return '<div class="page"><div class="skel h1"></div><div class="skel p"></div><div class="grid main-aside"><div class="skel blk" style="height:260px"></div><div class="skel blk" style="height:260px"></div></div><div class="skel blk"></div></div>'; }
function route() {
  parseRoute();
  let name = ROUTE.name;
  if (STATE.needAuth) name = "auth";
  renderNav(name === "auth" ? "" : name); document.body.classList.remove("focus");
  document.title = (name === "dashboard" || name === "auth" ? "" : TITLES[name] + " · ") + "Lern-Cockpit";
  const view = document.getElementById("view");
  const needs = !["ernaehrung", "info", "auth"].includes(name);
  if (needs && !STATE.loaded) { view.innerHTML = STATE.error ? '<div class="page narrow"><div class="card" style="margin-top:var(--s9)">' + emptyState("info", "Keine Verbindung", "Der Speicher ist gerade nicht erreichbar und auf diesem Gerät gibt es noch keinen gespeicherten Stand.<br><span class=\"t-cap\">" + esc(STATE.error) + "</span>", '<button class="btn primary sm" onclick="init()">Erneut versuchen</button>') + '</div></div>' : skeleton(); return; }
  document.onkeydown = null;
  const focus = name === "auth" || (name === "trainer" && ROUTE.sub === "session");
  const key = name + "/" + ROUTE.sub; const enter = key !== LAST_KEY; LAST_KEY = key;
  try {
    let html = V[name]();
    if (!OWN_HEADER.includes(name)) html = pageHead(TITLES[name], { sub: SUBTITLES[name] }) + html;
    view.innerHTML = focus ? html : '<div class="page' + (enter ? " enter" : "") + '">' + html + '</div>';
  } catch (e) { view.innerHTML = '<div class="page"><div class="card">' + emptyState("info", "Anzeigefehler", esc(e.message)) + '</div></div>'; console.error(e); return; }
  try { bindPage(name); } catch (e) { console.error(e); }
  sessTick();
  if (enter && !ROUTE.query.keep) window.scrollTo({ top: 0 });
}
function bindPage(name) {
  const b = { auth: bindAuth, dashboard: bindDashboard, aufgaben: bindAufgaben, lernplan: bindLernplan, noten: bindNoten, vokabeln: bindVokabeln, stundenplan: bindStundenplan, info: bindInfo, trainer: bindTrainer, ki: bindKI, einstellungen: bindEinstellungen, fortschritt: () => {} }[name];
  if (b) b();
}
window.addEventListener("hashchange", () => { closeModal(); const prev = ROUTE.name + "/" + ROUTE.sub; parseRoute(); if (ROUTE.name + "/" + ROUTE.sub !== prev) VOK_FILTER = ""; route(); });
window.addEventListener("resize", debounce(() => { if (ROUTE.name === "stundenplan") route(); }, 200));
Api.on("outbox", () => { if (!document.getElementById("mbg") && !document.body.classList.contains("focus") && ["dashboard", "vokabeln", "trainer"].includes(ROUTE.name)) { const n = document.querySelector("#view .notice"); if (n || Api.pending === 0) route(); } });
Api.on("auth", s => {
  if (s || STATE.open || STATE.engine !== "ready" || STATE.needAuth) return;
  if (Api.hasAccess()) { init(true); return; }   // Sitzung abgelaufen → mit dem Zugangslink neu anmelden
  STATE.needAuth = true; route();
});

/* =====================================================================
   START
   ===================================================================== */
async function init(silent) {
  const redirect = Api.handleRedirect();
  if (redirect && redirect.error) toast("Link ungültig oder abgelaufen: " + redirect.error, true);
  if (redirect && redirect.type === "recovery") { STATE.engine = "ready"; STATE.needAuth = true; AUTH_MODE = "newpw"; STATE.loaded = true; route(); return; }
  if (!silent) { STATE.loaded = false; route(); }
  try {
    let version = 0;
    try { version = await Api.rpc("lern_engine_version"); }
    catch (e) { if (e.network) throw e; version = 0; }
    STATE.engine = version >= 3 ? "ready" : "missing"; STATE.engineVersion = version;
    // Ab Version 5 (Migration 005) gibt es keine Anmeldung mehr: alle Zugriffe laufen ohne Konto
    STATE.open = version >= 5; Api.setOpen(STATE.open);
    if (STATE.open && Api.session) Api.dropSession();
    // Zugangslink: mit dem gespeicherten Schlüssel automatisch anmelden
    if (STATE.engine === "ready" && !STATE.open && !Api.session && Api.hasAccess()) {
      try { await Api.accessLogin(); }
      catch (e) { if (e.network) throw e; if (e.accessInvalid) toast("Dieser Zugangslink gilt nicht mehr – es wurde ein neuer erstellt. Öffne den neuen Link oder melde dich an.", true); }
    }
    if (STATE.engine === "ready" && !STATE.open && !Api.session) { STATE.needAuth = true; STATE.loaded = true; route(); return; }
    STATE.needAuth = false;
    if (STATE.engine === "ready" && !STATE.open) { try { const c = await Api.rpc("claim_legacy_data"); if (c && Object.keys(c).length && !c.skipped) console.info("Altdaten übernommen", c); } catch (e) { console.warn("Übernahme", e); } }
    await loadAll();
    if (STATE.engine === "ready") {
      await loadEngine(); await normalizeEngine();
      const remote = await Api.get("training_sessions", "select=id,status,state,updated_at&status=in.(active,paused)&order=updated_at.desc&limit=1").then(r => r && r[0] || null).catch(() => null);
      reconcileSession(remote);
    }
    STATE.syncedAt = Date.now();
    STATE.loaded = true; STATE.error = null; STATE.offline = false;
    saveSnap();
    Api.flush();
  } catch (e) {
    const snap = Api.loadSnapshot();
    if (e.network && snap) { restoreSnap(snap); STATE.open = Api.isOpen; STATE.offline = true; STATE.loaded = true; STATE.error = null; }
    else if (e.status === 401 && STATE.engine === "ready" && !STATE.open) { STATE.needAuth = true; STATE.loaded = true; }
    else { STATE.error = e && e.message ? e.message : String(e); STATE.loaded = false; }
  }
  route(); setTimeout(checkReminders, 1500);
}
window.init = init;
const SNAP_KEYS = ["hw", "kl", "vo", "news", "noten", "log", "settings", "termine", "aend", "v2", "dbReady", "engine"];
function saveSnap() { if (!STATE.loaded || STATE.offline || (!Api.session && !STATE.open)) return; const d = { es: ES }; SNAP_KEYS.forEach(k => d[k] = STATE[k]); Api.saveSnapshot(d); }
function restoreSnap(s) { const d = s.data; SNAP_KEYS.forEach(k => { if (d[k] !== undefined) STATE[k] = d[k]; }); Object.assign(ES, d.es || {}); STATE.snapshotAt = s.at; bump(); }
let SNAP_VER = -1; setInterval(() => { if (SNAP_VER !== ES_VER) { SNAP_VER = ES_VER; saveSnap(); } }, 30000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveSnap(); });
window.addEventListener("online", () => { if (STATE.offline) init(true); });

/* ---------------- Geräte-Abgleich ----------------
   Alle Lerndaten liegen in Supabase. Damit Handy und Laptop denselben Stand
   zeigen, wird beim Zurückkehren zur App und regelmäßig im Vordergrund neu
   geladen – nur, wenn nichts mehr auf dem Weg zum Server ist. */
let SYNCING = false, hiddenAt = 0;
async function refreshData(reason) {
  if (SYNCING || !STATE.loaded || STATE.offline || STATE.needAuth || STATE.engine !== "ready" || (!Api.session && !STATE.open)) return;
  SYNCING = true;
  try {
    await Api.idle(); if (Api.pending) return;
    const before = ES_VER;
    const [_, __, remote] = await Promise.all([loadAll(), loadEngine(),
      Api.get("training_sessions", "select=id,status,state,updated_at&status=in.(active,paused)&order=updated_at.desc&limit=1").then(r => r && r[0] || null).catch(() => null)]);
    if (ES_VER - before > 1 || Api.pending) { setTimeout(() => refreshData("nachholen"), 3000); return; }   // währenddessen lokal geändert → gleich noch einmal
    const changed = reconcileSession(remote);
    STATE.syncedAt = Date.now(); bump(); saveSnap();
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    const inSession = ROUTE.name === "trainer" && ROUTE.sub === "session";
    if (inSession) { if (changed) route(); }
    else if (!document.getElementById("mbg") && !typing) route();
  } catch (e) { if (!e.network) console.warn("Abgleich", reason, e); }
  finally { SYNCING = false; }
}
window.refreshData = refreshData;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { hiddenAt = Date.now(); if (TS) tsSync(); }
  else if (hiddenAt && Date.now() - hiddenAt > 15000 && Date.now() - hiddenAt < 10 * 60000) refreshData("zurück");   // länger weg: init() lädt ohnehin neu
});
setInterval(() => { if (document.visibilityState === "visible") refreshData("regelmäßig"); }, 120000);
init();
