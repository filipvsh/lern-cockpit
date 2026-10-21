/* =====================================================================
   LERN-COCKPIT · DRANBLEIBEN
   XP für Lektionen, Spiele und Lernrunden · Tagesziel · Serie (Tage in
   Folge mit XP) · „Serie in Gefahr“ · Level · Abzeichen.
   Gespeichert in „einstellungen“: lektion_xp (XP je Tag, Name historisch),
   xp_total, xp_ziel, abzeichen (Datum je Abzeichen), perfekt (Anzahl).
   ===================================================================== */
const XP_GOALS = [[20, "Locker"], [30, "Normal"], [50, "Ehrgeizig"]];
const xpLog = () => setting("lektion_xp", {}) || {};
const xpOn = d => +(xpLog()[d] || 0);
const xpToday = () => xpOn(todayISO());
const xpGoal = () => +setting("xp_ziel", 30) || 30;
const xpTotal = () => Math.max(+setting("xp_total", 0) || 0, Object.values(xpLog()).reduce((a, x) => a + (+x || 0), 0));
/** Tage in Folge mit XP – heute zählt mit, wenn schon etwas gemacht ist */
function xpStreak() { const m = xpLog(); let n = 0, d = todayISO(); if (!m[d]) d = addDays(d, -1); while (m[d]) { n++; d = addDays(d, -1); } return n; }
const xpWeek = () => { let s = 0; for (let i = 0; i < 7; i++) s += xpOn(addDays(todayISO(), -i)); return s; };
const LEVEL_XP = 200;
const xpLevel = () => { const t = xpTotal(); return { level: Math.floor(t / LEVEL_XP) + 1, into: t % LEVEL_XP, need: LEVEL_XP }; };
/** Serie in Gefahr: gestern war etwas, heute noch nicht */
const streakAtRisk = () => xpToday() === 0 && !!xpLog()[addDays(todayISO(), -1)];

const BADGES = [
  { id: "s3", ico: "🔥", name: "Dranbleiber", desc: "3 Tage in Folge", ok: c => c.streak >= 3 },
  { id: "s7", ico: "🗓️", name: "Eine Woche!", desc: "7 Tage in Folge", ok: c => c.streak >= 7 },
  { id: "s14", ico: "💪", name: "Zwei Wochen", desc: "14 Tage in Folge", ok: c => c.streak >= 14 },
  { id: "s30", ico: "🏅", name: "Monats-Held", desc: "30 Tage in Folge", ok: c => c.streak >= 30 },
  { id: "x100", ico: "⭐", name: "100 XP", desc: "100 XP gesammelt", ok: c => c.total >= 100 },
  { id: "x500", ico: "🌟", name: "500 XP", desc: "500 XP gesammelt", ok: c => c.total >= 500 },
  { id: "x1000", ico: "🏆", name: "1000 XP", desc: "1000 XP gesammelt", ok: c => c.total >= 1000 },
  { id: "x2500", ico: "💎", name: "2500 XP", desc: "2500 XP gesammelt", ok: c => c.total >= 2500 },
  { id: "perfekt", ico: "🎯", name: "Fehlerfrei", desc: "Eine Lektion ohne Fehler", ok: c => c.perfect >= 1 },
  { id: "perfekt10", ico: "🧠", name: "Profi", desc: "10 Lektionen ohne Fehler", ok: c => c.perfect >= 10 },
  { id: "ziel5", ico: "✅", name: "Zielsicher", desc: "5× Tagesziel geschafft", ok: c => c.goalDays >= 5 },
  { id: "w200", ico: "🚀", name: "Starke Woche", desc: "200 XP in 7 Tagen", ok: c => c.week >= 200 }
];
function badgeCtx() { const goal = xpGoal(); return { streak: xpStreak(), total: xpTotal(), perfect: +setting("perfekt", 0) || 0, goalDays: Object.values(xpLog()).filter(x => +x >= goal).length, week: xpWeek() }; }
const earnedBadges = () => setting("abzeichen", {}) || {};

/**
 * XP gutschreiben. opts.perfect: fehlerfreie Lektion. Meldet Tagesziel und neue Abzeichen.
 * Gibt die neuen Abzeichen zurück.
 */
async function addXP(n, opts) {
  n = Math.max(0, Math.round(+n || 0)); if (!n) return [];
  const t = todayISO(); const before = xpToday();
  const m = Object.assign({}, xpLog()); m[t] = (+m[t] || 0) + n;
  Object.keys(m).sort().slice(0, -120).forEach(d => delete m[d]);   // 120 Tage aufheben
  const total = xpTotal() + n;
  await setSetting("lektion_xp", m); await setSetting("xp_total", total);
  if (opts && opts.perfect) await setSetting("perfekt", (+setting("perfekt", 0) || 0) + 1);
  const had = earnedBadges(); const ctx = badgeCtx();
  const fresh = BADGES.filter(b => !had[b.id] && b.ok(ctx));
  if (fresh.length) { const e = Object.assign({}, had); fresh.forEach(b => e[b.id] = t); await setSetting("abzeichen", e); }
  const goal = xpGoal();
  if (fresh.length) toast(fresh.map(b => b.ico + " Neues Abzeichen: " + b.name).join(" · "));
  else if (before < goal && before + n >= goal) toast("🔥 Tagesziel geschafft! Serie: " + plural(xpStreak(), "Tag", "Tage"));
  return fresh;
}
/** XP für eine beendete Lernrunde im Trainer */
function sessionXP(ts) {
  if (!ts || ts.status !== "completed") return 0;
  const n = (ts.answers || []).length;
  return n ? 10 + Math.min(15, n) : 0;
}

/** Bereich für die schnelle Lektion: Wörter der nächsten Klausur, sonst alle */
function quickScope() {
  const k = upcomingKL().filter(x => !isVocabTest(x)).find(x => linkedCollections(x).flatMap(c => cardsOf(c.id)).length >= 4);
  return k ? "exam:" + k.id : "";
}

/* ---------- Anzeige ---------- */
function motivationCard() {
  const st = xpStreak(), today = xpToday(), goal = xpGoal(), lv = xpLevel(); const risk = streakAtRisk();
  const pct = Math.min(100, Math.round(today / goal * 100));
  const title = risk ? "Deine Serie ist in Gefahr!" : today >= goal ? "Tagesziel geschafft!" : today ? "Noch " + (goal - today) + " XP bis zum Tagesziel" : st ? "Halte deine Serie am Leben" : "Starte deine Serie";
  const go = today < goal && typeof gameCards === "function" && gameCards(quickScope()).length >= 4 ? '<button class="btn ' + (risk ? "primary " : "") + 'sm mo-go" data-lesson="' + esc(quickScope()) + '">' + (risk ? "Serie retten" : "XP holen") + '</button>' : '';
  return '<div class="card mo-card' + (risk ? " risk" : today >= goal ? " done" : "") + '">' +
    '<div class="mo-row"><div class="mo-flame' + (today ? " lit" : "") + '">🔥<b>' + st + '</b></div>' +
    '<div class="mo-main"><div class="mo-t">' + title + '</div><div class="mo-bar"><i style="width:' + pct + '%"></i></div><div class="t-sub">' + today + ' / ' + goal + ' XP heute · Level ' + lv.level + ' (' + lv.into + '/' + lv.need + ')</div></div>' + go + '</div>' +
    (risk ? '<div class="mo-risk">' + plural(st, "Tag", "Tage") + ' am Stück – eine Lektion (3 Min.) rettet sie.</div>' : '') +
    (typeof pushSupported === "function" && pushSupported() && PUSH.checked && !pushOn() ? '<a class="mo-push" href="#/einstellungen">🔔 Push-Erinnerungen einschalten – damit deine Serie nicht reißt</a>' : '') + '</div>';
}
function badgesSection() {
  const e = earnedBadges();
  return '<div class="card"><h2>Abzeichen <span class="count">' + Object.keys(e).length + '/' + BADGES.length + '</span></h2><div class="bd-grid">' +
    BADGES.map(b => '<div class="bd' + (e[b.id] ? "" : " off") + '" title="' + esc(b.desc) + '"><span class="bd-i">' + b.ico + '</span><b>' + esc(b.name) + '</b><span class="t-sub">' + (e[b.id] ? fmtDL(e[b.id]) : esc(b.desc)) + '</span></div>').join("") + '</div>' +
    '<div class="mo-goal"><span class="t-sub">Tagesziel</span><div class="seg">' + XP_GOALS.map(([g, l]) => '<button class="' + (xpGoal() === g ? "on" : "") + '" data-xpgoal="' + g + '">' + l + ' · ' + g + ' XP</button>').join("") + '</div></div></div>';
}
function bindMotivation() {
  document.querySelectorAll("[data-xpgoal]").forEach(b => b.onclick = async () => { await setSetting("xp_ziel", +b.dataset.xpgoal); route(); });
}

/* ---------- Erinnerung: Serie in Gefahr (Benachrichtigung, solange die App im Hintergrund offen ist) ---------- */
setInterval(() => {
  try {
    if (!STATE.loaded || !("Notification" in window) || Notification.permission !== "granted" || !streakAtRisk()) return;
    const now = new Date(); const hm = two(now.getHours()) + ":" + two(now.getMinutes()); const n = notifiedToday(); const rt = setting("erinnerung_uhrzeit", "18:00");
    if (hm >= rt && !n.keys.includes("serie")) { notify("🔥 Deine Serie ist in Gefahr!", plural(xpStreak(), "Tag", "Tage") + " am Stück – eine Lektion (3 Min.) rettet sie.", "lc-serie"); markNotified("serie"); }
    else if (hm >= "21:00" && n.keys.includes("serie") && !n.keys.includes("serie2")) { notify("Letzte Chance für heute 🔥", "Noch bis Mitternacht – sonst ist die Serie weg.", "lc-serie2"); markNotified("serie2"); }
  } catch (e) {}
}, 60000);
