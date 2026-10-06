// In-Memory-Nachbildung der genutzten Supabase-Schnittstellen (PostgREST, Auth, RPC,
// Edge Function „ai-tutor“) für Ende-zu-Ende-Tests im Browser.
import { randomUUID } from "node:crypto";

const DAY = 864e5;
const iso = (d, base = Date.now()) => new Date(base + d * DAY).toISOString().slice(0, 10);
const NEW_TABLES = ["subjects", "vocab_collections", "topics", "subtopics", "exercises", "learning_events", "training_sessions", "profiles"];

export function seed() {
  const kl = [
    { id: "11111111-aaaa-4aaa-8aaa-000000000001", fach: "Englisch", thema: "Short Story Writing", datum: iso(8), nr: 1, kurs: "E5-GK4", lehrer: "Sopko", uhrzeit: "09:50", dauer: 90, raum: "B12", halbjahr: "EF.1",
      themen: [{ id: "t1", text: "Structure", done: true }, { id: "t2", text: "Narrative Perspective", done: false }, { id: "t3", text: "Characterisation", done: false }],
      material: [], notizen: "", mitnehmen: [], punkte: null, vokabel_lektionen: ["Unit 1"], topics_migrated: false },
    { id: "11111111-aaaa-4aaa-8aaa-000000000002", fach: "Deutsch", thema: "Gesprächsanalyse", datum: iso(15), nr: 1, themen: [], material: [], mitnehmen: [], punkte: null, vokabel_lektionen: [], topics_migrated: false }
  ];
  const vok = []; let n = 1;
  [["Unité 1", [["bonjour", "guten Tag"], ["la gare", "der Bahnhof"], ["réussir", "gelingen, schaffen"], ["l'avenir", "die Zukunft"], ["le travail", "die Arbeit"]]],
   ["Unit 1", [["to resolve", "lösen"], ["setting", "Schauplatz"], ["narrator", "Erzähler"], ["plot", "Handlung"]]],
   ["Chemie", [["Oxidation", "Abgabe von Elektronen"], ["Katalysator", "beschleunigt eine Reaktion"]]]]
    .forEach(([deck, words]) => words.forEach(([b, m], i) => vok.push({ id: n++, begriff: b, bedeutung: m, sprache: deck, level: i % 3, next: iso(i % 2 ? 2 : -1) })));
  return {
    klausuren: kl, vokabeln: vok,
    hausaufgaben: [{ id: "h1", aufgabe: "S. 42 Nr. 3–5", fach: "Mathe", faellig: iso(0), dauer: 30, prio: "Hoch", done: false, typ: "hausaufgabe" }],
    neuigkeiten: [], noten: [], lernlog: [], einstellungen: [], termine: [], stundenplan_aenderungen: [],
    subjects: [], vocab_collections: [], topics: [], subtopics: [], exercises: [], learning_events: [], training_sessions: [], profiles: []
  };
}

export class MockBackend {
  constructor(o = {}) {
    this.db = o.db || seed();
    this.engine = o.engine !== false;          // Migration 003 vorhanden?
    this.ai = o.ai !== false;                  // Edge Function vorhanden?
    this.open = !!o.open;                      // Migration 005: ohne Anmeldung (anon = Besitzer)
    this.offline = false;
    this.users = { "filip@example.org": { id: "aaaaaaaa-0000-4000-8000-000000000001", password: "geheim123", name: "Filip" } };
    this.log = [];
    // wie Migration 003: alte Level → Intervalle
    if (this.engine) this.db.vokabeln.forEach(v => { if (v.reps == null && v.level > 0) { v.interval_days = [0, 1, 2, 4, 7, 14, 30][v.level]; v.reps = v.level; v.next_review_at = v.next ? v.next + "T00:00:00.000Z" : null; } });
  }
  user(token) { return Object.values(this.users).find(u => "tok-" + u.id === token) || null; }
  async handle(route) {
    const req = route.request(); const u = new URL(req.url());
    if (!u.hostname.includes("supabase")) return u.protocol === "file:" ? route.continue() : route.abort();
    if (this.offline) return route.abort("internetdisconnected");
    const method = req.method(); let body = null; try { body = JSON.parse(req.postData() || "null"); } catch (e) {}
    const auth = (req.headers()["authorization"] || "").replace("Bearer ", "");
    const me = this.user(auth) || (this.open ? Object.values(this.users)[0] : null);
    const json = (status, data, headers) => route.fulfill({ status, contentType: "application/json", headers: headers || {}, body: data === undefined ? "" : JSON.stringify(data) });
    this.log.push(method + " " + u.pathname + u.search);
    // ---- Auth
    if (u.pathname.startsWith("/auth/v1/")) {
      const p = u.pathname.slice(9);
      if (p === "token" && u.searchParams.get("grant_type") === "password") { const usr = this.users[body.email]; if (!usr || usr.password !== body.password) return json(400, { error_code: "invalid_credentials", msg: "Invalid login credentials" }); return json(200, this.session(body.email)); }
      if (p === "token") { const usr = Object.entries(this.users).find(([, x]) => "ref-" + x.id === body.refresh_token); return usr ? json(200, this.session(usr[0])) : json(400, { error_code: "refresh_token_not_found" }); }
      if (p === "signup") { if (this.users[body.email]) return json(422, { error_code: "user_already_exists" }); this.users[body.email] = { id: randomUUID(), password: body.password, name: (body.data || {}).name }; return json(200, this.session(body.email)); }
      if (p === "logout") return json(204);
      if (p === "recover") return json(200, {});
      if (p === "user") { const usr = Object.values(this.users).find(x => "tok-" + x.id === auth); if (!usr) return json(401, {}); usr.password = body.password; return json(200, { id: usr.id }); }
      return json(404, {});
    }
    // ---- Edge Function
    if (u.pathname === "/functions/v1/ai-tutor") {
      if (!this.ai) return json(404, undefined);
      if (!me) return json(401, { error: "unauthorized" });
      return json(200, this.aiReply(body));
    }
    // ---- RPC
    if (u.pathname.startsWith("/rest/v1/rpc/")) {
      const fn = u.pathname.slice(13);
      if (!this.engine) return json(404, { code: "PGRST202", message: "Could not find the function" });
      if (fn === "lern_engine_version") return json(200, this.open ? 5 : 3);
      if (fn === "claim_legacy_data") { if (!me) return json(401, { code: "42501" }); const r = {}; Object.keys(this.db).forEach(t => { if (NEW_TABLES.includes(t)) return; let c = 0; this.db[t].forEach(x => { if (!x.user_id) { x.user_id = me.id; c++; } }); if (c) r[t] = c; }); if (!this.db.profiles.length) this.db.profiles.push({ id: me.id, email: "filip@example.org", name: me.name, daily_minutes: 30 }); return json(200, r); }
      return json(404, {});
    }
    // ---- REST
    const table = u.pathname.replace("/rest/v1/", "");
    if (!this.db[table] || (!this.engine && NEW_TABLES.includes(table))) return json(404, { code: "PGRST205", message: "Could not find the table" });
    if (NEW_TABLES.includes(table) && !me) return json(401, { code: "42501", message: "permission denied" });
    let rows = this.db[table];
    const filters = [...u.searchParams.entries()].filter(([k]) => !["select", "order", "limit", "on_conflict", "or"].includes(k));
    const match = r => filters.every(([k, v]) => {
      const [op, ...rest] = v.split("."); const arg = rest.join(".");
      const val = r[k];
      if (op === "eq") return String(val) === decodeURIComponent(arg);
      if (op === "in") return arg.replace(/[()]/g, "").split(",").map(decodeURIComponent).includes(String(val));
      if (op === "gte") return val != null && String(val) >= arg;
      if (op === "lte") return val != null && String(val) <= arg;
      if (op === "is") return arg === "null" ? val == null : true;
      return true;
    });
    if (method === "GET") {
      let out = rows.filter(match);
      const range = req.headers()["range"]; if (range) { const [a, b] = range.split("-").map(Number); out = out.slice(a, b + 1); }
      const lim = u.searchParams.get("limit"); if (lim) out = out.slice(0, +lim);
      return json(200, out);
    }
    if (method === "POST") {
      const prefer = req.headers()["prefer"] || ""; const list = Array.isArray(body) ? body : [body]; const out = [];
      const conflict = (u.searchParams.get("on_conflict") || "id").split(",");
      for (const r0 of list) {
        const r = Object.assign({}, r0);
        if (r.id == null) r.id = typeof rows[0]?.id === "number" ? Math.max(0, ...rows.map(x => +x.id || 0)) + 1 : randomUUID();
        if (me && r.user_id == null) r.user_id = me.id;
        if (NEW_TABLES.includes(table) && !r.created_at) r.created_at = new Date().toISOString();
        const ex = rows.find(x => conflict.every(c => String(x[c]) === String(r[c])));
        if (ex) { if (prefer.includes("merge-duplicates")) { Object.assign(ex, r); out.push(ex); } else if (prefer.includes("ignore-duplicates")) continue; else return json(409, { code: "23505", message: "duplicate key" }); }
        else { rows.push(r); out.push(r); }
      }
      return prefer.includes("return=minimal") ? json(201) : json(201, out);
    }
    if (method === "PATCH") { const hit = rows.filter(match); hit.forEach(r => Object.assign(r, body)); return (req.headers()["prefer"] || "").includes("return=minimal") ? json(204) : json(200, hit); }
    if (method === "DELETE") {
      const hit = rows.filter(match); this.db[table] = rows.filter(r => !hit.includes(r));
      // Kaskaden wie in der Migration
      if (table === "topics") { const ids = hit.map(h => h.id); const subs = this.db.subtopics.filter(s => ids.includes(s.topic_id)).map(s => s.id); this.db.subtopics = this.db.subtopics.filter(s => !ids.includes(s.topic_id)); this.db.exercises = this.db.exercises.filter(e => !subs.includes(e.subtopic_id)); }
      if (table === "subtopics") { const ids = hit.map(h => h.id); this.db.exercises = this.db.exercises.filter(e => !ids.includes(e.subtopic_id)); }
      if (table === "vocab_collections") { const ids = hit.map(h => h.id); this.db.vokabeln = this.db.vokabeln.filter(v => !ids.includes(v.collection_id)); }
      if (table === "klausuren") { const ids = hit.map(h => h.id); const tids = this.db.topics.filter(t => ids.includes(t.exam_id)).map(t => t.id); this.db.topics = this.db.topics.filter(t => !tids.includes(t.id)); this.db.subtopics = this.db.subtopics.filter(s => !tids.includes(s.topic_id)); }
      return json(204);
    }
    return json(405, {});
  }
  session(email) { const usr = this.users[email]; return { access_token: "tok-" + usr.id, refresh_token: "ref-" + usr.id, expires_in: 3600, user: { id: usr.id, email, user_metadata: { name: usr.name } } }; }
  aiReply(b) {
    this.lastAi = b;
    switch (b.mode) {
      case "ping": return { ok: true };
      case "explain": return { title: "Narrative Perspective", explanation: "Die Erzählperspektive legt fest, **wer** erzählt.\n\nIch-Erzähler vs. personaler Erzähler.", key_points: ["Ich-Erzähler: subjektiv", "Auktorial: allwissend"], check_question: "Woran erkennst du einen personalen Erzähler?" };
      case "practice": return { exercise: { type: "multiple_choice", question: "Welche Perspektive liegt vor: „I walked home, wondering why she had lied.“", options: ["Ich-Erzähler", "Auktorialer Erzähler", "Personaler Erzähler"], correct_index: 0, solution: "„I“ + Innensicht → Ich-Erzähler.", difficulty: 2 } };
      case "quiz": return (b.history || []).length ? { verdict: "wrong", feedback: "Nicht ganz: Der Erzähler kennt nur die Gedanken einer Figur.", mistake: "Personal vs. auktorial verwechselt", next_question: "Nenne ein Signalwort für auktoriales Erzählen." } : { verdict: "none", feedback: "", mistake: "", next_question: "Was unterscheidet personales von auktorialem Erzählen?" };
      case "correct": return { summary: "Solide Grundlage.", criteria: [{ name: "Inhalt", score: 78, comment: "" }, { name: "Struktur", score: 85, comment: "" }, { name: "Sprache", score: 72, comment: "" }, { name: "Grammatik", score: 81, comment: "" }, { name: "Aufgabenbezug", score: 90, comment: "" }], strengths: ["Klare Einleitung"], missing: ["Wendepunkt fehlt"], next_steps: ["Perspektive konsequent halten"], mistakes: ["Perspektivwechsel"] };
      case "hint": return { hint: "Stufe " + b.level + ": Achte auf das Pronomen." };
      case "simulate": return { title: "Short Story: The Letter", instructions: "Write a short story (350 words) from a first-person perspective.", material: "Prompt: A letter arrives 20 years too late.", time_minutes: 20, expectations: ["Konsequente Ich-Perspektive", "Wendepunkt"] };
      case "socratic": return { message: "Gute Frage.", question: "Wer erzählt in deinem Text – und was weiß diese Person?" };
      default: return { error: "unknown mode" };
    }
  }
}
