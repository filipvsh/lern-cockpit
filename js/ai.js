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
  async call(payload) {
    try {
      const r = await Api.invoke("ai-tutor", payload);
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
  async hint({ item, level, answer }) {
    const r = await AI.call(Object.assign({ mode: "hint", level, exercise: AI.exerciseOf(item), answer }, AI.ctxOf(item)));
    return r.hint || "";
  }
};
