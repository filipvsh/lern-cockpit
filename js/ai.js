/* =====================================================================
   LERN-COCKPIT · KI-CLIENT
   Spricht die Edge Function „ai-tutor“ an. Der API-Schlüssel liegt nur
   dort (Supabase Secret). Die Funktion lädt den Lernkontext selbst aus der
   Datenbank – mit den Rechten des angemeldeten Nutzers (RLS).
   ===================================================================== */
const AI = {
  state: "unknown",                    // unknown · ok · unavailable (Funktion nicht eingerichtet)
  reason: "",
  ctxOf(item) {
    if (!item) return {};
    const st = item.subtopic_id ? subById(item.subtopic_id) : null;
    const ex = st ? examOfSub(st) : null;
    return { subtopic_id: st ? st.id : null, topic_id: st ? st.topic_id : (item.topic_id || null), exam_id: ex ? ex.id : null };
  },
  async call(payload, o) {
    try {
      const r = await Api.invoke("ai-tutor", payload, o);
      AI.state = "ok"; return r;
    } catch (e) {
      if (e.code === "not_deployed" || e.code === "not_configured" || e.code === "unreachable") { AI.state = "unavailable"; AI.reason = e.code; }
      throw e;
    }
  },
  errorText(e) {
    if (!e) return "Die KI konnte gerade nicht antworten.";
    if (e.code === "not_deployed") return "Die KI-Funktion ist noch nicht eingerichtet.";
    if (e.code === "not_configured") return "Der KI-Zugang ist auf dem Server noch nicht hinterlegt.";
    if (e.code === "unreachable") return "Die KI-Funktion ist nicht erreichbar – meist ist sie bei Supabase noch nicht eingerichtet (Edge Function „ai-tutor“).";
    if (e.code === "offline") return "Keine Internetverbindung – die KI ist gerade nicht erreichbar.";
    if (e.code === "timeout") return "Die KI hat zu lange gebraucht.";
    if (e.code === "rate_limited") return "Gerade zu viele KI-Anfragen. Versuch es in einer Minute erneut.";
    if (e.code === "refused") return "Die KI hat diese Anfrage abgelehnt.";
    if (e.code === "bad_request" && e.message) return e.message.indexOf("Unbekannter Modus") >= 0 ? "Die KI-Funktion ist noch die alte Version – bitte einmal neu einrichten (Anleitung: docs/KI-UPDATE.md)." : e.message;
    return "Die KI konnte gerade nicht antworten.";
  },
  exerciseOf(item) { const x = item.exercise || {}; return { type: x.type, question: x.question, expected_answer: x.expected_answer || null, solution: x.solution || null }; },
  /** Strukturierte Korrektur → {criteria[{name,score,comment}], strengths, missing, next_steps, mistakes, overall} */
  async correct({ item, answer, examMode }) {
    const r = await AI.call(Object.assign({ mode: "correct", exercise: AI.exerciseOf(item), answer, exam_mode: !!examMode }, AI.ctxOf(item)));
    return AI.normRubric(r);
  },
  normRubric(r) {
    const crit = (r.criteria || []).map(c => ({ name: String(c.name || ""), score: Math.max(0, Math.min(100, Math.round(+c.score || 0))), comment: String(c.comment || "") }));
    const overall = crit.length ? Math.round(crit.reduce((a, c) => a + c.score, 0) / crit.length) : 0;
    return { criteria: crit, strengths: r.strengths || [], missing: r.missing || [], next_steps: r.next_steps || [], mistakes: (r.mistakes || []).slice(0, 5), summary: r.summary || "", overall };
  },
  /** Datei → {media_type, data}: Fotos verkleinert (max. 1600 px, JPEG), PDFs bis 6 MB */
  async toPart(file) {
    const b64 = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(blob); });
    if (file.type === "application/pdf") { if (file.size > 6e6) throw Object.assign(new Error("Das PDF ist zu groß (max. 6 MB)."), { code: "bad_request" }); return { media_type: "application/pdf", data: await b64(file) }; }
    if (!/^image\//.test(file.type)) throw Object.assign(new Error("Bitte ein Foto oder ein PDF wählen."), { code: "bad_request" });
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)); const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src);
    const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.85));
    return { media_type: "image/jpeg", data: await b64(blob) };
  },
  /** Themenzettel (Fotos/PDF oder Text) → Checkliste {fach, title, items[]} */
  async checklist({ fach, thema, files, text }) {
    const parts = []; for (const f of files || []) parts.push(await AI.toPart(f));
    return AI.call({ mode: "checklist", fach, thema, files: parts, input: text || "" }, { timeoutMs: 180000 });
  },
  /** Foto vom Rechenweg prüfen → {verdict, summary, steps[{line, ok, comment}], first_error, tip} */
  async workcheck({ task, expected, solution, file }) {
    return AI.call({ mode: "workcheck", exercise: { question: task, expected_answer: expected || null, solution: solution || null }, files: [await AI.toPart(file)] }, { timeoutMs: 120000 });
  },
  async hint({ item, level, answer }) {
    const r = await AI.call(Object.assign({ mode: "hint", level, exercise: AI.exerciseOf(item), answer }, AI.ctxOf(item)));
    return r.hint || "";
  }
};
