// deno test --node-modules-dir=auto supabase/functions/ai-tutor/handler.test.ts
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { createHandler, SCHEMAS, buildRequest, MODEL } from "./handler.ts";

const USER = { id: "u1" };
function deps(o: { key?: string; reply?: unknown; stop?: string; throws?: unknown } = {}) {
  const calls: { url: string; auth: string }[] = [];
  const created: Record<string, unknown>[] = [];
  const db: Record<string, unknown[]> = {
    subtopics: [{ id: "s1", title: "Narrative Perspective", description: "", difficulty: 2, mastery_score: 54, topic_id: "t1" }],
    topics: [{ id: "t1", title: "Short Story Writing", description: "", priority: 3, exam_id: 7 }],
    klausuren: [{ fach: "Englisch", thema: "Short Story Writing", datum: "2026-10-10", description: "" }],
    learning_events: [{ type: "exercise_wrong", result: 0, detail: { mistake: "First person vs third person" } }, { type: "exercise_correct", result: 1, detail: {} }],
    exercises: [{ type: "free_text", question: "Bestimme die Perspektive." }],
  };
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); const auth = new Headers(init?.headers).get("Authorization") ?? "";
    calls.push({ url, auth });
    if (url.endsWith("/auth/v1/user")) return auth === "Bearer good" ? Response.json(USER) : new Response("{}", { status: 401 });
    const table = url.split("/rest/v1/")[1].split("?")[0];
    return Response.json(db[table] ?? []);
  }) as typeof fetch;
  return {
    calls, created,
    deps: {
      env: (k: string) => ({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", ANTHROPIC_API_KEY: o.key ?? "sk-test" } as Record<string, string>)[k],
      fetch: fakeFetch,
      anthropic: () => ({ beta: { messages: { create: async (p: Record<string, unknown>) => { created.push(p); if (o.throws) throw o.throws; return { stop_reason: o.stop ?? "end_turn", content: [{ type: "text", text: JSON.stringify(o.reply ?? { hint: "Schau auf das Pronomen." }) }] }; } } } }) as never,
    },
  };
}
const post = (body: unknown, auth = "Bearer good") => new Request("https://f/ai-tutor", { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });

Deno.test("ohne gültige Sitzung: 401, keine KI-Anfrage", async () => {
  const t = deps(); const res = await createHandler(t.deps)(post({ mode: "explain" }, "Bearer bad"));
  assertEquals(res.status, 401); assertEquals(t.created.length, 0);
});
Deno.test("ohne API-Schlüssel: klarer Fehlercode not_configured", async () => {
  const t = deps({ key: "" }); const res = await createHandler(t.deps)(post({ mode: "ping" }));
  assertEquals(res.status, 503); assertEquals((await res.json()).code, "not_configured");
});
Deno.test("Kontext wird mit dem Token des Nutzers geladen und mitgeschickt", async () => {
  const t = deps({ reply: { title: "x", explanation: "y", key_points: [], check_question: "z" } });
  const res = await createHandler(t.deps)(post({ mode: "explain", subtopic_id: "s1" }));
  assertEquals(res.status, 200);
  const rest = t.calls.filter(c => c.url.includes("/rest/v1/"));
  assert(rest.length >= 4); assert(rest.every(c => c.auth === "Bearer good"), "RLS: Nutzer-Token, nie service_role");
  const p = t.created[0] as { model: string; system: string; messages: { content: string }[]; output_config: { format: { schema: unknown } } };
  assertEquals(p.model, MODEL);
  const last = p.messages[p.messages.length - 1].content;
  assertStringIncludes(last, "Unterthema: Narrative Perspective");
  assertStringIncludes(last, "Lernstand: 54 %");
  assertStringIncludes(last, "First person vs third person");
  assertStringIncludes(last, "Fach: Englisch");
  assertEquals(p.output_config.format.schema, SCHEMAS.explain);
});
Deno.test("Hinweisstufe landet im Auftrag, Musterlösung nur als Grundlage", () => {
  const r = buildRequest("hint", { level: 2, exercise: { question: "Q", solution: "S" }, answer: "A" }, { text: "", found: false });
  assertStringIncludes(r.system, "Hilfe der Stufe 2");
  assertStringIncludes(String(r.messages[0].content), "Musterlösung (nur als Grundlage, Stufe beachten): S");
});
Deno.test("Verlauf: abwechselnde Rollen, aktuelle Anfrage zuletzt", () => {
  const r = buildRequest("quiz", { input: "Meine Antwort", history: [{ role: "assistant", content: "{\"next_question\":\"F1\"}" }, { role: "user", content: "Meine Antwort" }] }, { text: "ctx", found: true });
  assertEquals(r.messages.map(m => m.role), ["user", "assistant", "user"]);
  assertStringIncludes(String(r.messages[2].content), "Meine Antwort");
});
Deno.test("Ablehnung und unlesbare Antworten werden sauber gemeldet", async () => {
  const t = deps({ stop: "refusal" }); const res = await createHandler(t.deps)(post({ mode: "hint", level: 1 }));
  assertEquals(res.status, 422); assertEquals((await res.json()).code, "refused");
});
Deno.test("unbekannter Modus: 400", async () => {
  const t = deps(); const res = await createHandler(t.deps)(post({ mode: "chat" }));
  assertEquals(res.status, 400);
});
Deno.test("Schemas: alle Felder Pflicht, keine Zusatzfelder", () => {
  for (const [mode, s] of Object.entries(SCHEMAS)) {
    const sc = s as { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean };
    assertEquals(sc.additionalProperties, false, mode);
    assertEquals(sc.required.sort(), Object.keys(sc.properties).sort(), mode);
  }
});

/* ---------- Checkliste aus Foto/PDF · Rechenweg-Check ---------- */
const IMG = { media_type: "image/jpeg", data: "QUJD" };
Deno.test("Checkliste: Foto wird als Bild-Block vor dem Text geschickt, Schema checklist", async () => {
  const t = deps({ reply: { fach: "Mathe", title: "Checkliste", items: [] } });
  const res = await createHandler(t.deps)(post({ mode: "checklist", fach: "Mathe", thema: "1. Klausur", files: [IMG, { media_type: "application/pdf", data: "UERG" }] }));
  assertEquals(res.status, 200);
  const p = t.created[0] as { max_tokens: number; messages: { content: { type: string; text?: string }[] }[]; output_config: { format: { schema: unknown } } };
  const c = p.messages[p.messages.length - 1].content;
  assertEquals(c.map(b => b.type), ["image", "document", "text"]);
  assertStringIncludes(c[2].text ?? "", "KLAUSUR\nMathe – 1. Klausur");
  assertEquals(p.output_config.format.schema, SCHEMAS.checklist); assert(p.max_tokens >= 12000);
});
Deno.test("Checkliste/Rechenweg: ohne Inhalt oder mit falschen Dateien → 400, keine KI-Anfrage", async () => {
  const t = deps(); const h = createHandler(t.deps);
  assertEquals((await h(post({ mode: "workcheck", exercise: { question: "Q" } }))).status, 400);
  assertEquals((await h(post({ mode: "checklist" }))).status, 400);
  assertEquals((await h(post({ mode: "checklist", files: [{ media_type: "text/html", data: "x" }] }))).status, 400);
  assertEquals((await h(post({ mode: "checklist", files: [IMG, IMG, IMG, IMG, IMG] }))).status, 400);
  assertEquals(t.created.length, 0);
});
Deno.test("Rechenweg-Check: Aufgabe + erwartete Lösung + Foto", async () => {
  const t = deps({ reply: { verdict: "partial", summary: "s", steps: [], first_error: "", tip: "" } });
  const res = await createHandler(t.deps)(post({ mode: "workcheck", exercise: { question: "Löse x² − 9 = 0", expected_answer: "L = {−3; 3}" }, files: [IMG] }));
  assertEquals(res.status, 200); assertEquals((await res.json()).verdict, "partial");
  const p = t.created[0] as { messages: { content: { type: string; text?: string }[] }[] };
  const c = p.messages[p.messages.length - 1].content; assertEquals(c[0].type, "image"); assertStringIncludes(c[1].text ?? "", "Erwartete Lösung (nur für dich): L = {−3; 3}");
});
Deno.test("CORS: alte Netlify-Adresse gesetzt – GitHub Pages wird trotzdem erlaubt", async () => {
  const t = deps(); const d = { ...t.deps, env: (k: string) => k === "ALLOWED_ORIGIN" ? "https://precious-tarsier-d3ff5d.netlify.app" : t.deps.env(k) };
  const pre = new Request("https://f/ai-tutor", { method: "OPTIONS", headers: { Origin: "https://filipvsh.github.io" } });
  assertEquals((await createHandler(d)(pre)).headers.get("Access-Control-Allow-Origin"), "https://filipvsh.github.io");
  const other = new Request("https://f/ai-tutor", { method: "OPTIONS", headers: { Origin: "https://boese.example" } });
  assertEquals((await createHandler(d)(other)).headers.get("Access-Control-Allow-Origin"), "https://precious-tarsier-d3ff5d.netlify.app");
});
