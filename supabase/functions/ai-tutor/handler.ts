// Lern-Cockpit · KI-Tutor (Supabase Edge Function, Deno)
//
// Ablauf je Anfrage:
//   1. Nutzer über sein Supabase-Token prüfen (kein Token → 401).
//   2. Lernkontext MIT DEN RECHTEN DES NUTZERS laden (RLS): Unterthema, Thema,
//      Prüfung, Lernstand, letzte Ergebnisse und Fehler.
//   3. Claude mit modusabhängigem Auftrag und festem JSON-Schema aufrufen.
//   4. Strukturiertes JSON an die App zurückgeben.
// Der Anthropic-Schlüssel liegt nur als Secret auf dem Server.
import Anthropic from "npm:@anthropic-ai/sdk@^0.131.0";

export const MODEL = "claude-opus-5-5";
export const MODES = ["ping", "explain", "practice", "quiz", "correct", "hint", "simulate", "socratic"] as const;
type Mode = typeof MODES[number];

export interface Deps {
  env: (k: string) => string | undefined;
  fetch: typeof fetch;
  anthropic: () => Pick<Anthropic, "beta">;
  now?: () => number;
}

/* ---------------- Antwortschemata (strukturierte Ausgabe) ---------------- */
const str = { type: "string" } as const;
const strArr = { type: "array", items: { type: "string" } } as const;
const obj = (props: Record<string, unknown>) => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });
export const SCHEMAS: Record<Exclude<Mode, "ping">, Record<string, unknown>> = {
  explain: obj({ title: str, explanation: str, key_points: strArr, check_question: str }),
  practice: obj({ exercise: obj({ type: { type: "string", enum: ["multiple_choice", "free_text", "translation", "short_writing"] }, question: str, options: strArr, correct_index: { type: "integer" }, expected_answer: str, solution: str, difficulty: { type: "integer" } }) }),
  quiz: obj({ verdict: { type: "string", enum: ["none", "correct", "partial", "wrong"] }, feedback: str, mistake: str, next_question: str }),
  correct: obj({ summary: str, criteria: { type: "array", items: obj({ name: str, score: { type: "integer" }, comment: str }) }, strengths: strArr, missing: strArr, next_steps: strArr, mistakes: strArr }),
  hint: obj({ hint: str }),
  simulate: obj({ title: str, instructions: str, material: str, time_minutes: { type: "integer" }, expectations: strArr }),
  socratic: obj({ message: str, question: str }),
};

/* ---------------- Aufträge je Modus ---------------- */
const BASE = `Du bist ein geduldiger Lerncoach für Filip, einen Schüler der Einführungsphase (EF, Klasse 11) an einer Gesamtschule in NRW.
Du arbeitest innerhalb seiner Lernplattform. Der Abschnitt LERNKONTEXT beschreibt, woran er gerade arbeitet, wie sicher er ist und welche Fehler zuletzt auftraten – nutze ihn, um genau auf seinem Niveau zu helfen und gezielt an seinen Fehlern anzusetzen.
Sprache: Antworte auf Deutsch. Bei Fremdsprachenfächern dürfen Aufgaben, Beispiele und Texte in der Zielsprache sein, Erklärungen bleiben auf Deutsch.
Stil: klar, freundlich, knapp. Kein Lob ohne Grund. Keine Emojis. Fachbegriffe kurz erklären.
Ehrlichkeit: Wenn der Lernkontext zu dünn ist, sag das, statt Wissen über Filip zu erfinden.
Antworte ausschließlich im vorgegebenen JSON-Format.`;

const TASKS: Record<Exclude<Mode, "ping">, string> = {
  explain: `MODUS: ERKLÄREN. Erkläre das Unterthema verständlich, aufbauend auf seinem Lernstand. Wenn es typische Fehler im Kontext gibt, geh gezielt darauf ein. „explanation“: 2–4 kurze Absätze (Absätze mit Leerzeile trennen, **fett** sparsam). „key_points“: 3–5 Merksätze. „check_question“: eine Kontrollfrage, die er selbst beantworten soll (keine Lösung verraten).`,
  practice: `MODUS: ÜBEN. Erstelle GENAU EINE neue Übung zum Unterthema, passend zu Lernstand und letzten Fehlern (schwach → leichter und gezielt auf den Fehler; sicher → anspruchsvoller). Wähle den passenden Typ:
- multiple_choice: 3–4 Optionen in „options“, „correct_index“ ist der Index der richtigen (0-basiert); genau eine ist richtig.
- free_text / short_writing: „options“ leer, „correct_index“ = -1, „expected_answer“ = knappe Musterlösung.
- translation: Satz zum Übersetzen in „question“, „expected_answer“ = Übersetzung.
„solution“ erklärt kurz, warum die Lösung stimmt. „difficulty“: 1 leicht, 2 mittel, 3 schwer. Wiederhole keine der zuletzt gestellten Übungen aus dem Kontext.`,
  quiz: `MODUS: PRÜFEN. Du fragst Wissen zum Unterthema ab – eine Frage pro Runde.
- Gibt es noch keine Frage im Verlauf: verdict = "none", feedback leer, mistake leer, stelle die erste Frage in „next_question“.
- Sonst bewerte die LETZTE Antwort des Schülers auf deine LETZTE Frage: verdict correct / partial / wrong. „feedback“: 1–3 Sätze, was stimmt und was fehlt. Wenn falsch oder teilweise: „mistake“ = kurze Bezeichnung des Fehlers (max. 6 Wörter, z. B. „Ich- und personaler Erzähler verwechselt“), sonst leer. Dann die nächste Frage in „next_question“ – bei Fehlern gezielt dazu.`,
  correct: `MODUS: KORRIGIEREN. Analysiere die Antwort/den Text des Schülers zur angegebenen Aufgabe.
„criteria“: genau diese fünf in dieser Reihenfolge, jeweils score 0–100 und ein kurzer Kommentar: Inhalt, Struktur, Sprache, Grammatik, Aufgabenbezug. Bewerte realistisch für die EF – nicht großzügig, nicht streng. Die Werte sind eine Lernhilfe, keine Note; nenne keine Schulnote.
„strengths“: 1–3 konkrete Stärken. „missing“: was fehlt oder falsch ist. „next_steps“: 2–3 konkrete Verbesserungen für den nächsten Versuch. „mistakes“: 0–3 kurze Fehlerbezeichnungen (max. 6 Wörter) für die Fehlerdatenbank. „summary“: ein Satz Gesamteindruck.
Schreibe keine vollständige Musterlösung.`,
  hint: `MODUS: HINWEIS. Der Schüler arbeitet an einer Aufgabe und bittet um Hilfe der Stufe {LEVEL}. Halte dich strikt an die Stufe:
1 = kleiner Hinweis: lenke die Aufmerksamkeit, nenne nichts von der Lösung.
2 = konkreter Hinweis: nenne den entscheidenden Begriff oder Ansatz, aber nicht das Ergebnis.
3 = Lösungsweg: beschreibe die Schritte, lass das Endergebnis offen.
4 = vollständige Erklärung: zeige Lösung und Begründung.
Berücksichtige seine bisherige Antwort, falls vorhanden. 1–4 Sätze (Stufe 4 darf länger sein).`,
  simulate: `MODUS: PRÜFUNGSSIMULATION. Erstelle eine realistische Klausuraufgabe zum Thema (Niveau EF, NRW), wie sie in dieser Prüfung gestellt werden könnte, mit Schwerpunkt auf dem Unterthema. „instructions“: Aufgabenstellung mit Operatoren. „material“: ggf. kurzer Ausgangstext/Material (sonst leer). „time_minutes“: realistische Bearbeitungszeit (10–90). „expectations“: 3–5 Bewertungsschwerpunkte.`,
  socratic: `MODUS: SOKRATISCH. Gib NIEMALS die Lösung oder fertige Antworten. Führe den Schüler mit genau EINER gezielten Frage pro Runde zum eigenen Verständnis. „message“: kurze Reaktion auf seine letzte Antwort (bestätigen, was stimmt; ohne die Lösung vorwegzunehmen), „question“: die nächste Denkfrage. Wenn er erkennbar selbst zur richtigen Erkenntnis gekommen ist, sag das in „message“ und stelle eine Transferfrage.`,
};
const EFFORT: Record<string, "low" | "medium" | "high"> = { explain: "medium", practice: "medium", quiz: "low", correct: "high", hint: "low", simulate: "medium", socratic: "low" };

/* ---------------- Hilfen ---------------- */
const json = (status: number, body: unknown, cors: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);
const RATE = new Map<string, number[]>();
const RATE_LIMIT = 40, RATE_WINDOW = 10 * 60 * 1000;   // 40 Anfragen je 10 Minuten und Nutzer

export interface Ctx { text: string; found: boolean }
/** Lernkontext mit dem Token des Nutzers laden – RLS stellt sicher, dass nur eigene Daten gelesen werden */
export async function loadContext(d: Deps, auth: string, ids: { subtopic_id?: string; topic_id?: string; exam_id?: string | number }): Promise<Ctx> {
  const base = d.env("SUPABASE_URL") + "/rest/v1/";
  const key = d.env("SUPABASE_ANON_KEY") ?? "";
  const get = async (path: string) => {
    const r = await d.fetch(base + path, { headers: { apikey: key, Authorization: auth } });
    if (!r.ok) return [];
    return await r.json() as Record<string, unknown>[];
  };
  const enc = encodeURIComponent;
  const lines: string[] = [];
  let st: Record<string, unknown> | undefined, tp: Record<string, unknown> | undefined, ex: Record<string, unknown> | undefined;
  if (ids.subtopic_id) st = (await get(`subtopics?id=eq.${enc(ids.subtopic_id)}&select=id,title,description,difficulty,mastery_score,topic_id`))[0];
  const topicId = (st?.topic_id as string) || ids.topic_id;
  if (topicId) tp = (await get(`topics?id=eq.${enc(topicId)}&select=id,title,description,priority,exam_id`))[0];
  const examId = (tp?.exam_id as string | number | undefined) ?? ids.exam_id;
  if (examId != null && examId !== "") ex = (await get(`klausuren?id=eq.${enc(String(examId))}&select=fach,thema,datum,description`))[0];
  if (ex) {
    const days = Math.round((new Date(ex.datum + "T00:00:00").getTime() - (d.now?.() ?? Date.now())) / 864e5);
    lines.push(`Fach: ${ex.fach}`, `Prüfung: ${ex.thema}${ex.description ? " – " + ex.description : ""} (am ${ex.datum}, ${days >= 0 ? "in " + days + " Tagen" : "vorbei"})`);
  }
  if (tp) lines.push(`Thema: ${tp.title}${tp.description ? " – " + tp.description : ""} (Priorität ${tp.priority}/3)`);
  if (st) {
    lines.push(`Unterthema: ${st.title}${st.description ? " – " + st.description : ""} (Schwierigkeit ${st.difficulty}/3)`);
    lines.push(`Lernstand: ${st.mastery_score == null ? "noch keine Übung" : st.mastery_score + " %"}`);
    const ev = await get(`learning_events?subtopic_id=eq.${enc(String(st.id))}&select=type,result,detail,created_at&order=created_at.desc&limit=20`);
    if (ev.length) {
      const ok = ev.filter(e => Number(e.result) >= 0.5).length;
      lines.push(`Letzte Übungen: ${ok} richtig, ${ev.length - ok} falsch oder unsicher`);
      const mistakes = [...new Set(ev.flatMap(e => { const dt = (e.detail ?? {}) as Record<string, unknown>; return [...((dt.mistakes as string[]) ?? []), ...(dt.mistake ? [dt.mistake as string] : [])]; }))].slice(0, 6);
      if (mistakes.length) lines.push(`Zuletzt aufgetretene Fehler: ${mistakes.join("; ")}`);
    }
    const exs = await get(`exercises?subtopic_id=eq.${enc(String(st.id))}&select=type,question&order=created_at.desc&limit=5`);
    if (exs.length) lines.push(`Zuletzt gestellte Übungen: ${exs.map(e => "„" + clip(e.question, 120) + "“").join(" | ")}`);
  }
  return { text: lines.join("\n"), found: lines.length > 0 };
}

export function buildRequest(mode: Exclude<Mode, "ping">, body: Record<string, unknown>, ctx: Ctx) {
  const parts: string[] = [];
  parts.push("LERNKONTEXT\n" + (ctx.found ? ctx.text : "Kein Thema ausgewählt – allgemeine Hilfe."));
  const ex = (body.exercise ?? null) as Record<string, unknown> | null;
  if (ex && ex.question) parts.push("AUFGABE\n" + clip(ex.question, 6000) + (ex.expected_answer && mode !== "hint" ? "\nErwartete Lösung (nur für dich): " + clip(ex.expected_answer, 2000) : "") + (ex.solution && mode !== "hint" ? "\nLösungshinweis (nur für dich): " + clip(ex.solution, 2000) : "") + (ex.solution && mode === "hint" ? "\nMusterlösung (nur als Grundlage, Stufe beachten): " + clip(ex.solution, 2000) : ""));
  if (body.answer) parts.push("ANTWORT DES SCHÜLERS\n" + clip(body.answer, 12000));
  if (body.exam_mode) parts.push("Hinweis: Die Antwort entstand im Prüfungsmodus unter Zeitdruck.");
  if (body.input) parts.push("NACHRICHT DES SCHÜLERS\n" + clip(body.input, 4000));
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  history.forEach((h: { role?: string; content?: string }) => {
    const role = h.role === "assistant" ? "assistant" : "user";
    const content = clip(h.content, 4000); if (!content) return;
    if (messages.length && messages[messages.length - 1].role === role) messages[messages.length - 1].content += "\n\n" + content;
    else messages.push({ role, content });
  });
  // Die aktuelle Anfrage ist immer die letzte Nutzer-Nachricht
  const current = parts.join("\n\n");
  if (messages.length && messages[messages.length - 1].role === "user") messages.pop();   // letzte Nutzer-Eingabe steckt bereits in „current“
  if (messages.length && messages[0].role === "assistant") messages.unshift({ role: "user", content: "(Beginn der Übung)" });
  messages.push({ role: "user", content: current });
  const system = BASE + "\n\n" + TASKS[mode].replace("{LEVEL}", String(Math.min(4, Math.max(1, Number(body.level) || 1))));
  return { system, messages };
}

export function createHandler(d: Deps) {
  return async (req: Request): Promise<Response> => {
    const origin = d.env("ALLOWED_ORIGIN") || "*";
    const cors = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json(405, { error: "Nur POST", code: "bad_request" }, cors);

    // 1. Nutzer prüfen
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json(401, { error: "Nicht angemeldet", code: "unauthorized" }, cors);
    const ur = await d.fetch(d.env("SUPABASE_URL") + "/auth/v1/user", { headers: { apikey: d.env("SUPABASE_ANON_KEY") ?? "", Authorization: auth } });
    if (!ur.ok) return json(401, { error: "Sitzung ungültig", code: "unauthorized" }, cors);
    const user = await ur.json() as { id: string };

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json(400, { error: "Ungültige Anfrage", code: "bad_request" }, cors); }
    const mode = body.mode as Mode;
    if (!MODES.includes(mode)) return json(400, { error: "Unbekannter Modus", code: "bad_request" }, cors);
    if (!d.env("ANTHROPIC_API_KEY")) return json(503, { error: "ANTHROPIC_API_KEY ist nicht gesetzt", code: "not_configured" }, cors);
    if (mode === "ping") return json(200, { ok: true, model: MODEL }, cors);

    // Begrenzung pro Nutzer (pro Funktionsinstanz)
    const now = d.now?.() ?? Date.now();
    const hits = (RATE.get(user.id) ?? []).filter(t => now - t < RATE_WINDOW);
    if (hits.length >= RATE_LIMIT) return json(429, { error: "Zu viele Anfragen", code: "rate_limited" }, cors);
    hits.push(now); RATE.set(user.id, hits);

    // 2. Kontext laden (RLS!)
    const ctx = await loadContext(d, auth, { subtopic_id: body.subtopic_id as string, topic_id: body.topic_id as string, exam_id: body.exam_id as string });
    const { system, messages } = buildRequest(mode, body, ctx);

    // 3. Claude aufrufen
    try {
      const params = {
        model: MODEL,
        max_tokens: mode === "correct" || mode === "simulate" ? 8000 : 4000,
        system,
        messages,
        output_config: { effort: EFFORT[mode], format: { type: "json_schema", schema: SCHEMAS[mode] } },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      };
      // deno-lint-ignore no-explicit-any
      const res = await d.anthropic().beta.messages.create(params as any) as any;
      if (res.stop_reason === "refusal") return json(422, { error: "Die KI hat diese Anfrage abgelehnt.", code: "refused" }, cors);
      if (res.stop_reason === "max_tokens") return json(502, { error: "Antwort zu lang", code: "unavailable" }, cors);
      const text = (res.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
      let out: unknown;
      try { out = JSON.parse(text); } catch { return json(502, { error: "Antwort nicht lesbar", code: "unavailable" }, cors); }
      return json(200, out, cors);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return json(429, { error: "KI-Kontingent erschöpft", code: "rate_limited" }, cors);
      if (e instanceof Anthropic.AuthenticationError) return json(503, { error: "ANTHROPIC_API_KEY ungültig", code: "not_configured" }, cors);
      if (e instanceof Anthropic.BadRequestError) { console.error("bad request", e.message); return json(502, { error: "Anfrage an die KI fehlerhaft", code: "unavailable" }, cors); }
      if (e instanceof Anthropic.APIError) return json(503, { error: "KI gerade nicht erreichbar", code: "unavailable" }, cors);
      console.error(e);
      return json(500, { error: "Interner Fehler", code: "unavailable" }, cors);
    }
  };
}
