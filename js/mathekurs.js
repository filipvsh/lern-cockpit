/* =====================================================================
   LERN-COCKPIT · MATHE-KURS (Potenzfunktionen) – Aufgaben-Generatoren
   Jede Aufgabe wird zufällig erzeugt; Antworten sind Zahlen, Zahlenpaare,
   Lösungsmengen oder Begriffe zum Antippen – kein Formel-Tippen.
   lvl 0/1/2 = Leicht/Normal/Schwer (Zahlen werden größer, negativer,
   gemischter). Lernstand je Aufgabentyp wie im Grammatik-Drill (Box).
   Getestet in tests/engine.test.js.
   ===================================================================== */
(function (root, factory) {
  const M = factory();
  if (typeof module === "object" && module.exports) module.exports = M;
  else root.MK = M;
})(typeof self !== "undefined" ? self : this, function () {
  const SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  const sup = n => String(n).split("").map(c => SUP[c] || c).join("");
  const xp = n => n === 1 ? "x" : "x" + sup(n);                        // x³, x⁻²
  /** Zahl deutsch: Komma, echtes Minus, höchstens 4 Nachkommastellen */
  const fmt = x => { if (!isFinite(x)) return "–"; const s = Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : String(+x.toFixed(4)); return s.replace("-", "−").replace(".", ","); };
  const coef = a => a === 1 ? "" : a === -1 ? "−" : fmt(a) + "·";        // Faktor vor x
  const fx = (a, n) => "f(x) = " + coef(a) + xp(n);
  const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
  const int = (lo, hi, r) => lo + Math.floor(r() * (hi - lo + 1));
  const pw = (b, n) => Math.pow(b, n);

  /** Eingabe → Zahl („0,5“, „−3“, „1/8“, „-1/2“) oder NaN */
  function parseNum(s) {
    let t = String(s == null ? "" : s).trim().replace(/[−–]/g, "-").replace(/\s+/g, "").replace(/^[a-z]\d?=/i, "");
    if (!t) return NaN;
    t = t.replace(/,/g, ".");
    const fr = t.match(/^([+-]?\d+(?:\.\d+)?)\/([+-]?\d+(?:\.\d+)?)$/);
    if (fr) return +fr[1] / +fr[2];
    return /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(t) ? +t : NaN;
  }
  const near = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
  /** Eingabe passt zur Zahl v – gerundete Dezimalzahl (ab 2 Stellen, z. B. 0,33 für 1/3) zählt auch */
  function fits(str, v) {
    const g = parseNum(str); if (isNaN(g)) return false; if (near(g, v)) return true;
    const m = String(str).replace(",", ".").match(/\.(\d+)$/); const d = m ? m[1].length : 0;
    return d >= 2 && Math.abs(+v.toFixed(d) - g) < 1e-9;
  }
  /** Antwort prüfen: true/false */
  /** GeoGebra-Eingabe vergleichbar machen: Leerzeichen, „f(x)=“, Malpunkte, Komma, Hochzahlen */
  const normIn = s => String(s || "").toLowerCase().replace(/\s+/g, "").replace(/^(f\(x\)|y)=/, "").replace(/[*·]/g, "").replace(/,/g, ".").replace(/[−–]/g, "-").replace(/²/g, "^2").replace(/³/g, "^3").replace(/wurzel\(/g, "sqrt(");
  function check(task, given) {
    if (task.kind === "chip" || task.kind === "graph") return +given === task.answer;
    if (task.kind === "text") return task.answer.some(a => normIn(a) === normIn(given));
    if (task.kind === "num") return fits(given, task.answer);
    if (task.kind === "pair") return Array.isArray(given) && task.answer.every((v, i) => fits(given[i], v));
    if (task.kind === "nums") {
      if (given === "none") return task.answer.length === 0;
      const vals = (given || []).filter(x => String(x).trim());
      if (vals.some(x => isNaN(parseNum(x))) || vals.length !== task.answer.length) return false;
      const a = task.answer.slice().sort((p, q) => p - q), g = vals.slice().sort((p, q) => parseNum(p) - parseNum(q));
      return a.every((v, i) => fits(g[i], v));
    }
    return false;
  }
  /** Lösung als Text */
  function answerText(t) {
    if (t.kind === "chip" || t.kind === "graph") return t.opts[t.answer];
    if (t.kind === "text") return t.answer[0];
    if (t.kind === "num") return t.frac && !Number.isInteger(t.answer) ? t.frac + " = " + fmt(t.answer) : fmt(t.answer);
    if (t.kind === "pair") return t.labels ? t.labels.map((l, i) => l + " " + fmt(t.answer[i])).join(", ") : "(" + fmt(t.answer[0]) + " | " + fmt(t.answer[1]) + ")";
    if (t.kind === "nums") return t.answer.length ? "L = {" + t.answer.slice().sort((p, q) => p - q).map(fmt).join("; ") + "}" : "keine Lösung (L = { })";
    return "";
  }

  /* ---------- Generatoren je Thema: (r, lvl) → Aufgabe ---------- */
  const T = (o) => Object.assign({ kind: "num", steps: [] }, o);
  const GEN = {
    /* 1 · Potenzgesetze */
    "gesetze:mul": (r, l) => { const a = int(2, 6, r) * (l === 2 && r() < .4 ? -1 : 1), b = int(2, 6, r); return T({ prompt: xp(a) + " · " + xp(b) + " = x^?", ask: "Exponent", answer: a + b, rule: "Gleiche Basis malnehmen → Exponenten addieren: xᵃ · xᵇ = xᵃ⁺ᵇ", steps: [fmt(a) + " + " + fmt(b) + " = " + fmt(a + b), "→ " + xp(a + b)] }); },
    "gesetze:div": (r, l) => { const a = int(5, 9, r), b = int(2, l ? 8 : 4, r); return T({ prompt: xp(a) + " : " + xp(b) + " = x^?", ask: "Exponent", answer: a - b, rule: "Gleiche Basis teilen → Exponenten subtrahieren: xᵃ : xᵇ = xᵃ⁻ᵇ", steps: [fmt(a) + " − " + fmt(b) + " = " + fmt(a - b), "→ " + xp(a - b)] }); },
    "gesetze:pow": (r, l) => { const a = int(2, 5, r) * (l === 2 && r() < .3 ? -1 : 1), b = int(2, 4, r); return T({ prompt: "(" + xp(a) + ")" + sup(b) + " = x^?", ask: "Exponent", answer: a * b, rule: "Potenz hoch Zahl → Exponenten malnehmen: (xᵃ)ᵇ = xᵃ·ᵇ", steps: [fmt(a) + " · " + fmt(b) + " = " + fmt(a * b), "→ " + xp(a * b)] }); },
    "gesetze:coef": (r, l) => { const c = int(2, l ? 4 : 3, r), a = int(2, 4, r), b = l ? int(2, 3, r) : 2; return T({ kind: "pair", prompt: "(" + c + xp(a) + ")" + sup(b) + " = ? · x^?", labels: ["Zahl", "Exponent"], answer: [pw(c, b), a * b], rule: "Jeder Faktor bekommt den Exponenten: (c·xᵃ)ᵇ = cᵇ · xᵃ·ᵇ", steps: [c + sup(b) + " = " + pw(c, b), "(" + xp(a) + ")" + sup(b) + " = " + xp(a * b), "→ " + pw(c, b) + xp(a * b)] }); },
    "gesetze:zero": (r) => { const b = pick([5, 17, 2.5, -3, 100], r); return T({ prompt: (b < 0 ? "(" + fmt(b) + ")" : fmt(b)) + "⁰ = ?", ask: "Ergebnis", answer: 1, rule: "Jede Zahl (außer 0) hoch 0 ist 1.", steps: ["x⁰ = 1, z. B. weil x³ : x³ = x⁰ = 1"] }); },
    /* 2 · Negative Exponenten */
    "negativ:val": (r, l) => { const b = pick(l ? [2, 3, 4, 5, 10] : [2, 10], r), n = -int(1, l === 2 ? 3 : 2, r); return T({ prompt: b + sup(n) + " = ?", ask: "als Zahl oder Bruch (z. B. 0,25 oder 1/4)", answer: pw(b, n), frac: "1/" + pw(b, -n), rule: "Minus im Exponenten = Kehrwert: a⁻ⁿ = 1/aⁿ", steps: [b + sup(n) + " = 1/" + b + sup(-n), "= 1/" + pw(b, -n) + (Number.isInteger(pw(b, -n) / 10) || [2, 4, 5, 8, 10, 16, 25].includes(pw(b, -n)) ? " = " + fmt(pw(b, n)) : " ≈ " + fmt(pw(b, n)))] }); },
    "negativ:frac": (r) => { const n = int(2, 6, r); return T({ prompt: xp(-n) + " = 1 / x^?", ask: "Exponent", answer: n, rule: "x⁻ⁿ = 1/xⁿ – das Minus wandert in den Nenner", steps: [xp(-n) + " = 1/" + xp(n)] }); },
    "negativ:pow": (r) => { const n = int(1, 5, r); return T({ prompt: "1 / " + xp(n) + " = x^?", ask: "Exponent (mit Vorzeichen)", answer: -n, rule: "1/xⁿ = x⁻ⁿ", steps: ["1/" + xp(n) + " = " + xp(-n)] }); },
    "negativ:mix": (r, l) => { const a = -int(1, 4, r), b = int(2, 7, r); return T({ prompt: xp(a) + " · " + xp(b) + " = x^?", ask: "Exponent", answer: a + b, rule: "Auch mit negativen Exponenten: addieren. (−3) + 5 = 2", steps: ["(" + fmt(a) + ") + " + b + " = " + fmt(a + b), "→ " + xp(a + b)] }); },
    "negativ:half": (r) => { const d = pick([2, 3, 4, 5], r); return T({ prompt: "(1/" + d + ")⁻¹ = ?", ask: "Ergebnis", answer: d, rule: "Hoch −1 heißt Kehrwert: (1/a)⁻¹ = a", steps: ["Kehrwert von 1/" + d + " ist " + d] }); },
    /* 3 · Eigenschaften: Symmetrie, Verhalten, D und W */
    "eigen:sym": (r, l) => { const n = pick(l ? [2, 3, 4, 5, -1, -2, -3] : [2, 3, 4, 5], r), a = pick(l === 2 ? [1, -1, 2, -0.5] : [1, 2], r); const even = n % 2 === 0;
      return T({ kind: "chip", prompt: "Welche Symmetrie hat " + fx(a, n) + "?", opts: ["achsensymmetrisch zur y-Achse", "punktsymmetrisch zum Ursprung"], answer: even ? 0 : 1, rule: "Gerader Exponent → achsensymmetrisch · ungerader Exponent → punktsymmetrisch (auch bei negativem Exponenten)", steps: ["Exponent " + fmt(n) + " ist " + (even ? "gerade" : "ungerade"), even ? "f(−x) = f(x) → achsensymmetrisch zur y-Achse" : "f(−x) = −f(x) → punktsymmetrisch zum Ursprung"] }); },
    "eigen:inf": (r, l) => { const n = pick(l ? [2, 3, 4, 5, -1, -2] : [2, 3, 4], r), a = pick(l ? [1, -1, 2, -3] : [1, -1], r), side = pick(["+∞", "−∞"], r);
      const s = side === "+∞" ? 1 : -1; const res = n < 0 ? 2 : Math.sign(a) * (n % 2 === 0 ? 1 : s) > 0 ? 0 : 1;
      return T({ kind: "chip", prompt: fx(a, n) + ":  Für x → " + side + " geht f(x) gegen …", opts: ["+∞", "−∞", "0"], answer: res, rule: "Positiver Exponent: gerade → beide Seiten gleich, ungerade → Seiten verschieden; Minus davor spiegelt. Negativer Exponent → gegen 0.", steps: n < 0 ? ["Negativer Exponent: 1/x" + sup(-n) + " – Nenner wird riesig → f(x) → 0"] : ["Exponent " + n + " ist " + (n % 2 ? "ungerade" : "gerade") + ", Faktor " + fmt(a) + " ist " + (a > 0 ? "positiv" : "negativ"), "→ f(x) → " + ["+∞", "−∞"][res]] }); },
    "eigen:d": (r) => { const n = pick([2, 3, 4, -1, -2, -3], r), a = pick([1, 2, -1], r);
      return T({ kind: "chip", prompt: "Definitionsmenge von " + fx(a, n) + "?", opts: ["D = ℝ (alle Zahlen)", "D = ℝ \\ {0} (alle außer 0)"], answer: n < 0 ? 1 : 0, rule: "Negativer Exponent = Bruch 1/xⁿ → durch 0 teilen geht nicht → 0 raus", steps: n < 0 ? [xp(n) + " = 1/" + xp(-n) + " → x = 0 verboten"] : ["Positiver Exponent: jede Zahl darf eingesetzt werden"] }); },
    "eigen:w": (r, l) => { const n = pick(l ? [2, 3, 4, -1, -2] : [2, 3, -2], r), a = pick(l === 2 ? [1, -1, 2] : [1, -1], r);
      const opts = ["W = ℝ (alle Zahlen)", "W = ℝ \\ {0}", "W: y ≥ 0", "W: y > 0", "W: y ≤ 0", "W: y < 0"];
      const ans = n > 0 ? (n % 2 ? 0 : a > 0 ? 2 : 4) : (n % 2 ? 1 : a > 0 ? 3 : 5);
      return T({ kind: "chip", prompt: "Wertemenge von " + fx(a, n) + "?", opts, answer: ans, rule: "Gerader Exponent: nur eine Seite (oben bei a > 0); ungerader: alle Werte. Negativer Exponent: 0 wird nie erreicht.", steps: [n % 2 ? "Ungerader Exponent → nimmt positive und negative Werte an" : "Gerader Exponent → " + (a > 0 ? "nur ≥ 0 (Minus davor dreht um)" : "a < 0 → nur ≤ 0"), n < 0 ? "Negativer Exponent → 0 wird nie erreicht" : "", "→ " + opts[ans]].filter(Boolean) }); },
    /* 4 · Graphen erkennen (Funktionsliste aus mathe.js über opts) */
    "graph:pick": (r) => T({ kind: "graph" }),
    /* 5 · Funktionswerte, Punktprobe, Parameter a */
    "werte:f": (r, l) => { const n = pick(l ? [2, 3, 4, -1, -2] : [2, 3], r), a = pick(l ? [1, 2, 3, -1, 0.5] : [1, 2], r), x = pick(n < 0 ? [-2, -1, 2, 0.5] : l ? [-2, -1, 2, 3] : [1, 2, 3], r); const v = a * pw(x, n);
      return T({ prompt: fx(a, n) + "    f(" + fmt(x) + ") = ?", ask: "Ergebnis", answer: v, rule: "x einsetzen, Klammern bei negativen Zahlen! (−2)² = 4, (−2)³ = −8", steps: ["f(" + fmt(x) + ") = " + coef(a).replace("·", " · ") + "(" + fmt(x) + ")" + sup(n), "= " + coef(a).replace("·", " · ") + fmt(pw(x, n)) + (a !== 1 ? " = " + fmt(v) : "")] }); },
    "werte:probe": (r, l) => { const n = pick([2, 3, 4, -1], r), x = pick(n < 0 ? [2, 4, -2] : [-2, -1, 2, 3], r), real = pw(x, n), on = r() < 0.5, y = on ? real : (n % 2 === 0 ? -real : real * 2 || 1);
      return T({ kind: "chip", prompt: "Liegt P(" + fmt(x) + " | " + fmt(y) + ") auf dem Graphen von f(x) = " + xp(n) + "?", opts: ["Ja", "Nein"], answer: near(y, real) ? 0 : 1, rule: "Punktprobe: x einsetzen und mit y vergleichen", steps: ["f(" + fmt(x) + ") = " + fmt(real), near(y, real) ? "= y → liegt drauf" : fmt(real) + " ≠ " + fmt(y) + " → liegt nicht drauf"] }); },
    "werte:a": (r, l) => { const n = pick(l ? [2, 3, 4] : [2, 3], r), a = pick(l === 2 ? [2, 3, -1, -0.5, 0.5, -2] : l ? [2, 3, -1, 0.5] : [2, 3], r), x = pick(l ? [1, 2, -1, -2] : [1, 2], r), y = a * pw(x, n);
      return T({ prompt: "f(x) = a · " + xp(n) + " geht durch P(" + fmt(x) + " | " + fmt(y) + ").  a = ?", ask: "a", answer: a, rule: "Punkt einsetzen und nach a auflösen: y = a · xⁿ → a = y : xⁿ", steps: [fmt(y) + " = a · (" + fmt(x) + ")" + sup(n) + " = a · " + fmt(pw(x, n)), "a = " + fmt(y) + " : " + fmt(pw(x, n)) + " = " + fmt(a)] }); },
    /* 6 · Gleichungen xⁿ = c */
    "gleich:even": (r, l) => { const n = pick(l ? [2, 4] : [2], r), s = pick(n === 2 ? [3, 4, 5, 6, 7, 9] : [2, 3], r), neg = l && r() < 0.25; const c = neg ? -pw(s, n) : pw(s, n);
      return T({ kind: "nums", prompt: "Löse  " + xp(n) + " = " + fmt(c), answer: neg ? [] : [s, -s], rule: "Gerader Exponent: zwei Lösungen ±, bei negativer Zahl rechts keine", steps: neg ? [xp(n) + " ist nie negativ → keine Lösung"] : ["x = ± " + (n === 2 ? "√" : "⁴√") + fmt(c) + " = ± " + s, "L = {−" + s + "; " + s + "}"] }); },
    "gleich:odd": (r, l) => { const n = pick(l ? [3, 5] : [3], r), s = pick(n === 3 ? [2, 3, 4, 5] : [2], r) * (l && r() < 0.5 ? -1 : 1), c = pw(s, n);
      return T({ kind: "nums", prompt: "Löse  " + xp(n) + " = " + fmt(c), answer: [s], rule: "Ungerader Exponent: genau eine Lösung – auch bei negativer Zahl", steps: ["x = " + (n === 3 ? "³√" : "⁵√") + "(" + fmt(c) + ") = " + fmt(s), "L = {" + fmt(s) + "}"] }); },
    "gleich:coef": (r, l) => { const k = pick([2, 3, 4], r), n = pick([2, 3], r), s = pick([2, 3], r), c = k * pw(s, n);
      return T({ kind: "nums", prompt: "Löse  " + k + xp(n) + " = " + fmt(c), answer: n === 2 ? [s, -s] : [s], rule: "Erst durch die Zahl vor x teilen, dann Wurzel ziehen", steps: [": " + k + " → " + xp(n) + " = " + fmt(pw(s, n)), n === 2 ? "x = ± " + s : "x = " + s] }); },
    "gleich:neg": (r) => { const c = pick([4, 9, 25], r), sq = Math.sqrt(c); const one = r() < 0.4;
      return one ? T({ kind: "nums", prompt: "Löse  " + xp(-1) + " = " + c, answer: [1 / c], rule: "x⁻¹ = 1/x → Kehrwert", steps: ["1/x = " + c + " → x = 1/" + c + " = " + fmt(1 / c)] })
        : T({ kind: "nums", prompt: "Löse  " + xp(-2) + " = " + c, answer: [1 / sq, -1 / sq], rule: "x⁻² = 1/x² → erst Kehrwert, dann ± Wurzel", steps: ["1/x² = " + c + " → x² = 1/" + c, "x = ± 1/" + sq + (sq === 3 ? " ≈ ± 0,33" : " = ± " + fmt(1 / sq))] }); },
    /* 7 · Verschieben, Strecken, Spiegeln */
    "trafo:point": (r, l) => { const n = pick([2, 3, 4], r), d = int(-4, 4, r) || 2, e = int(-3, 4, r), a = l === 2 ? pick([1, -1, 2], r) : 1;
      const f = "f(x) = " + coef(a) + "(x " + (d < 0 ? "+ " + -d : "− " + d) + ")" + sup(n) + (e ? (e > 0 ? " + " + e : " − " + -e) : "");
      return T({ kind: "pair", prompt: (n % 2 ? "Wendepunkt (Symmetriezentrum)" : "Scheitelpunkt") + " von " + f + "?", answer: [d, e], rule: "f(x) = a(x − d)ⁿ + e: d nach rechts (Vorzeichen dreht sich in der Klammer!), e nach oben → Punkt (d | e)", steps: ["In der Klammer: x " + (d < 0 ? "+ " + -d : "− " + d) + " → d = " + fmt(d) + " (" + (d < 0 ? "nach links" : "nach rechts") + ")", "Hinten: e = " + fmt(e), "→ (" + fmt(d) + " | " + fmt(e) + ")"] }); },
    "trafo:effect": (r) => { const k = int(1, 4, r); const c = pick(["up", "down", "left", "right", "mirror", "stretch", "squeeze"], r);
      const f = { up: "x² + " + k, down: "x² − " + k, left: "(x + " + k + ")²", right: "(x − " + k + ")²", mirror: "−x²", stretch: (k + 1) + "x²", squeeze: "0,5x²" }[c];
      const opts = [k + " nach oben", k + " nach unten", k + " nach links", k + " nach rechts", "an der x-Achse gespiegelt", "gestreckt (schmaler)", "gestaucht (breiter)"];
      const ans = { up: 0, down: 1, left: 2, right: 3, mirror: 4, stretch: 5, squeeze: 6 }[c];
      const chosen = [ans, ...[0, 1, 2, 3, 4, 5, 6].filter(i => i !== ans).sort(() => r() - 0.5).slice(0, 3)].sort(() => r() - 0.5);
      return T({ kind: "chip", prompt: "Wie entsteht f(x) = " + f + " aus x²?", opts: chosen.map(i => opts[i]), answer: chosen.indexOf(ans), rule: "+ hinten → hoch · (x + k) → nach LINKS · (x − k) → nach RECHTS · Minus vorn → spiegeln · Faktor > 1 → schmaler", steps: [{ up: "+ " + k + " hinten → nach oben", down: "− " + k + " hinten → nach unten", left: "(x + " + k + ") → " + k + " nach links (umgekehrt!)", right: "(x − " + k + ") → " + k + " nach rechts", mirror: "Minus vor x² → an der x-Achse gespiegelt", stretch: "Faktor " + (k + 1) + " > 1 → gestreckt", squeeze: "Faktor 0,5 < 1 → gestaucht" }[c]] }); },
    "trafo:build": (r, l) => { const n = pick([2, 3], r), dx = int(1, 4, r) * pick([1, -1], r), dy = int(1, 3, r) * pick([1, -1], r);
      return T({ kind: "pair", prompt: xp(n) + " wird um " + Math.abs(dx) + " nach " + (dx > 0 ? "rechts" : "links") + " und um " + Math.abs(dy) + " nach " + (dy > 0 ? "oben" : "unten") + " verschoben.  Form f(x) = (x − d)" + sup(n) + " + e", labels: ["d =", "e ="], answer: [dx, dy], rule: "Nach rechts → d positiv, nach links → d negativ; hoch → e positiv", steps: ["d = " + fmt(dx) + " → f(x) = (x " + (dx > 0 ? "− " + dx : "+ " + -dx) + ")" + sup(n) + (dy > 0 ? " + " + dy : " − " + -dy)] }); }
  };

  const TOPICS = [
    { id: "gesetze", title: "Potenzgesetze", ico: "✖️", types: ["mul", "div", "pow", "coef", "zero"], card: [["xᵃ · xᵇ", "= xᵃ⁺ᵇ", "Exponenten addieren"], ["xᵃ : xᵇ", "= xᵃ⁻ᵇ", "Exponenten subtrahieren"], ["(xᵃ)ᵇ", "= xᵃ·ᵇ", "Exponenten malnehmen"], ["(c·xᵃ)ᵇ", "= cᵇ·xᵃ·ᵇ", "jeder Faktor hoch b"], ["x⁰", "= 1", "immer (x ≠ 0)"]], video: "K9GV9OLIaX0" },
    { id: "negativ", title: "Negative Exponenten", ico: "➖", types: ["val", "frac", "pow", "mix", "half"], card: [["x⁻ⁿ", "= 1/xⁿ", "Minus = Kehrwert"], ["2⁻³", "= 1/2³ = 1/8", "= 0,125"], ["1/x⁴", "= x⁻⁴", "rückwärts"], ["(1/2)⁻¹", "= 2", "Kehrwert"]], video: "0mZzbYLarGQ" },
    { id: "eigen", title: "Symmetrie, Verhalten, D und W", ico: "🪞", types: ["sym", "inf", "d", "w"], card: [["gerader Exponent", "achsensymmetrisch", "x², x⁴, x⁻²"], ["ungerader Exponent", "punktsymmetrisch", "x³, x⁵, x⁻¹"], ["x → ±∞, n > 0", "gerade: beide gleich", "ungerade: verschieden"], ["negativer Exponent", "D = ℝ \\ {0}", "f(x) → 0 für x → ±∞"]], video: "nqYb7y3N3wQ" },
    { id: "graph", title: "Graphen erkennen", ico: "📈", types: ["pick"], card: [["U-Form", "x², x⁴", "gerade, positiv"], ["S-Form", "x³, x⁵", "ungerade"], ["Hyperbel 1./3. Quadrant", "1/x", "ungerade, negativ"], ["beide Äste oben", "1/x²", "gerade, negativ"]], video: "HYXhkAV0yQw" },
    { id: "werte", title: "Funktionswerte & Punktprobe", ico: "🎯", types: ["f", "probe", "a"], card: [["f(2) bei x³", "= 2³ = 8", "einsetzen"], ["(−2)²", "= 4", "Klammer!"], ["(−2)³", "= −8", "ungerade bleibt −"], ["a bestimmen", "a = y : xⁿ", "Punkt einsetzen"]], video: "Skzjv2yp2a0" },
    { id: "gleich", title: "Gleichungen xⁿ = c", ico: "⚖️", types: ["even", "odd", "coef", "neg"], card: [["x² = 9", "x = ±3", "gerade → 2 Lösungen"], ["x³ = −8", "x = −2", "ungerade → 1 Lösung"], ["x² = −4", "keine Lösung", "gerade, rechts negativ"], ["2x³ = 54", ": 2 → x³ = 27", "erst teilen"]], video: "iDoPrgyGeCQ" },
    { id: "trafo", title: "Verschieben, Strecken, Spiegeln", ico: "↔️", types: ["point", "effect", "build"], card: [["x² + 3", "3 nach oben", ""], ["(x − 2)²", "2 nach RECHTS", "Vorzeichen dreht sich!"], ["(x + 1)²", "1 nach LINKS", ""], ["−x²", "gespiegelt", "an der x-Achse"], ["2x² / 0,5x²", "schmaler / breiter", ""]], video: "qdxI7cl49Ps" }
  ];
  const types = topic => TOPICS.find(t => t.id === topic).types.map(x => topic + ":" + x);

  /** Graph-Aufgabe: braucht die Funktionsliste (aus mathe.js) – hier eingespeist */
  function graphTask(funcs, r) {
    const t = funcs[Math.floor(r() * funcs.length)];
    const others = funcs.filter(f => f.id !== t.id).sort(() => r() - 0.5).slice(0, 3);
    const opts = [t, ...others].sort(() => r() - 0.5);
    return { kind: "graph", fid: t.id, prompt: "Welche Funktion gehört zu diesem Graphen?", opts: opts.map(f => f.label), fids: opts.map(f => f.id), answer: opts.indexOf(t), rule: "Gerade/ungerade? Positiver/negativer Exponent? Verschoben? Prüfe Punkte wie (1|1).", steps: [t.why] };
  }
  /** Eine Aufgabe erzeugen */
  function make(key, lvl, r, funcs) {
    const rr = r || Math.random; const [topic] = key.split(":");
    const t = key === "graph:pick" ? graphTask(funcs || [], rr) : GEN[key](rr, lvl || 0);
    return Object.assign({ key, topic, kind: "num" }, t);
  }
  /** Runde: n Aufgaben eines Themas, schwächste Typen öfter */
  function round(topic, stats, lvl, n, r, funcs) {
    const rr = r || Math.random; const st = stats || {}; const ks = types(topic); const out = [];
    for (let i = 0; i < (n || 10); i++) {
      const w = ks.map(k => 6 - Math.min(5, (st[k] || {}).b || 0)); let x = rr() * w.reduce((a, b) => a + b, 0), j = 0;
      while (x >= w[j] && j < ks.length - 1) { x -= w[j]; j++; }
      if (i < ks.length && ks.length <= n) j = i;          // jeder Typ mindestens einmal
      out.push(make(ks[j], lvl, rr, funcs));
    }
    return out.map(t => [rr(), t]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  /** Runde aus beliebigen Aufgabentypen (z. B. ein Punkt der Checkliste) */
  function roundKeys(ks, stats, lvl, n, r, funcs) {
    const rr = r || Math.random; const st = stats || {}; const out = [];
    for (let i = 0; i < (n || 10); i++) {
      const w = ks.map(k => 6 - Math.min(5, (st[k] || {}).b || 0)); let x = rr() * w.reduce((a, b) => a + b, 0), j = 0;
      while (x >= w[j] && j < ks.length - 1) { x -= w[j]; j++; }
      if (i < ks.length && ks.length <= (n || 10)) j = i;
      out.push(make(ks[j], lvl, rr, funcs));
    }
    return out.map(t => [rr(), t]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  const progressKeys = (ks, stats) => ks.length ? Math.round(ks.reduce((a, k) => a + Math.min(3, ((stats || {})[k] || {}).b || 0), 0) / (ks.length * 3) * 100) : 0;
  /** Probe-Klausur: aus jedem Thema, schwer, gemischt */
  const EXAM_MIX = [["gesetze:coef", "gesetze:mul"], ["negativ:val", "negativ:mix"], ["eigen:sym", "eigen:inf", "eigen:w"], ["graph:pick"], ["werte:f", "werte:a"], ["gleich:even", "gleich:odd", "gleich:neg"], ["trafo:point", "trafo:build"]];
  function exam(r, funcs, mix) {
    const rr = r || Math.random; const out = [];
    (mix || EXAM_MIX).forEach(g => { const pool = g.slice().sort(() => rr() - 0.5); pool.slice(0, g.length >= 3 ? 2 : g.length === 2 ? 2 : 1).forEach(k => out.push(make(k, 2, rr, funcs))); });
    return out.slice(0, mix ? 16 : 14);
  }
  /** Lernstand wie im Drill */
  function learn(stats, key, ok) {
    const s = Object.assign({}, stats); const x = Object.assign({ b: 0, r: 0, w: 0 }, s[key]);
    if (ok) { x.r++; x.b = Math.min(5, x.b + 1); } else { x.w++; x.b = Math.max(0, x.b - 2); }
    s[key] = x; return s;
  }
  /** Fortschritt eines Themas 0–100 (Box 3 je Typ = sitzt) */
  const progress = (topic, stats) => { const ks = types(topic); const p = ks.reduce((a, k) => a + Math.min(3, ((stats || {})[k] || {}).b || 0), 0) / (ks.length * 3); return Math.round(p * 100); };
  const grade = pct => pct >= 92 ? 1 : pct >= 81 ? 2 : pct >= 67 ? 3 : pct >= 50 ? 4 : pct >= 30 ? 5 : 6;
  return { TOPICS, GEN, types, make, round, roundKeys, progressKeys, normIn, exam, learn, progress, grade, check, parseNum, answerText, fmt, sup, xp };
});
