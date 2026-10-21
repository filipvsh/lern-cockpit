// Welche Erinnerungen sind jetzt fällig? Rein, ohne Netz – getestet in tests/push.test.mjs.
// Eingaben: Einstellungen (wie in der App), anstehende Klausuren, aktuelle Zeit.
// Regeln (Uhrzeit Europe/Berlin, je Tag und Art höchstens einmal, nie nach 22 Uhr):
//   lernen   ab der Erinnerungszeit, wenn das Tagesziel noch offen ist (Serie in Gefahr / Ziel offen)
//   letzte   21–22 Uhr, wenn heute noch nichts gemacht ist und eine Serie läuft
//   klausur  ab der Erinnerungszeit, wenn eine Klausur in 1, 3 oder 7 Tagen ist
export const TZ = "Europe/Berlin";
export function localNow(now, tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(x => [x.type, x.value]));
  return { date: p.year + "-" + p.month + "-" + p.day, hm: p.hour + ":" + p.minute };
}
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);
export function streakOf(xp, today) { let n = 0, d = today; if (!xp[d]) d = addDays(d, -1); while (xp[d]) { n++; d = addDays(d, -1); } return n; }
const plural = (n, a, b) => n + " " + (n === 1 ? a : b);

export function plan({ settings, exams, now }) {
  const s = settings || {}; const { date, hm } = localNow(now);
  if (s.push_aus) return { messages: [], log: null };
  const log = s.push_log && s.push_log.date === date ? { date, keys: [...s.push_log.keys] } : { date, keys: [] };
  const rt = /^\d\d:\d\d$/.test(s.erinnerung_uhrzeit || "") ? s.erinnerung_uhrzeit : "18:00";
  const xp = s.lektion_xp || {}; const today = +xp[date] || 0; const goal = +s.xp_ziel || 30;
  const streak = streakOf(xp, date); const risk = today === 0 && !!xp[addDays(date, -1)];
  const out = []; const send = (key, m) => { if (!log.keys.includes(key)) { out.push(Object.assign({ tag: "lc-" + key }, m)); log.keys.push(key); } };
  if (hm >= "22:00" || hm < "07:00") return { messages: [], log: null };
  if (hm >= rt && hm < "21:00" && today < goal) {
    if (risk) send("lernen", { title: "🔥 Deine Serie ist in Gefahr!", body: plural(streak, "Tag", "Tage") + " am Stück – eine Lektion (3 Min.) rettet sie.", url: "#/dashboard" });
    else if (!today) send("lernen", { title: "Zeit für heute 📚", body: "3 Minuten Lektion reichen – und deine Serie läuft.", url: "#/dashboard" });
    else send("lernen", { title: "Fast geschafft 💪", body: "Noch " + (goal - today) + " XP bis zu deinem Tagesziel.", url: "#/dashboard" });
  }
  if (hm >= "21:00" && risk) send("letzte", { title: "Letzte Chance für heute 🔥", body: "Noch bis Mitternacht – sonst ist deine Serie von " + plural(streak, "Tag", "Tagen") + " weg.", url: "#/dashboard" });
  if (hm >= rt) {
    const k = (exams || []).filter(e => e.datum && e.punkte == null).map(e => Object.assign({ d: daysBetween(date, e.datum) }, e)).filter(e => [1, 3, 7].includes(e.d)).sort((a, b) => a.d - b.d)[0];
    if (k) send("klausur", { title: (k.fach || "Klausur") + (k.description === "Vokabeltest" ? "-Vokabeltest " : "-Klausur ") + (k.d === 1 ? "morgen" : "in " + k.d + " Tagen"), body: k.d === 1 ? "Heute noch einmal alles wiederholen – du schaffst das!" : "Öffne den Klausur-Modus – alles für diese Klausur an einem Ort.", url: "#/klausur/" + k.id });
  }
  return { messages: out, log: out.length ? log : null };
}
