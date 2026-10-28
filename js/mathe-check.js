/* =====================================================================
   LERN-COCKPIT · CHECKLISTE 1. KLAUSUR MATHE EF (GK, STIE)
   Die 14 Punkte der Checkliste + Material. Je Punkt: Erklärung mit
   Beispielen, „Auf Papier / iPad“ (inkl. Buchaufgaben), Übungs-Typen.
   Ergänzt die Aufgaben-Generatoren in MK.GEN um „ck:*“ (lineare,
   quadratische Funktionen, Nullstellen, Schnittpunkte, GeoGebra …).
   Getestet in tests/engine.test.js.
   ===================================================================== */
(function (root, factory) {
  const C = factory(typeof module === "object" && module.exports ? require("./mathekurs.js") : root.MK);
  if (typeof module === "object" && module.exports) module.exports = C;
  else root.MC = C;
})(typeof self !== "undefined" ? self : this, function (MK) {
  const fmt = MK.fmt;
  const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
  const int = (lo, hi, r) => lo + Math.floor(r() * (hi - lo + 1));
  const intNZ = (lo, hi, r) => { let x = 0; while (!x) x = int(lo, hi, r); return x; };
  const T = o => Object.assign({ kind: "num", steps: [] }, o);
  const par = x => x < 0 ? "(" + fmt(x) + ")" : fmt(x);              // (−2) in Rechnungen
  /** Polynom als Text: [[Koeffizient, "x²"], [Koeffizient, "x"], [Zahl, ""]] */
  function poly(cs) {
    let s = "";
    cs.forEach(([c, v]) => { if (!c) return; const a = Math.abs(c); const t = (v && a === 1 ? "" : fmt(a)) + v; s += s ? (c < 0 ? " − " : " + ") + t : (c < 0 ? "−" : "") + t; });
    return s || "0";
  }
  const lin = (m, b) => poly([[m, "x"], [b, ""]]);
  const quad = (a, b, c) => poly([[a, "x²"], [b, "x"], [c, ""]]);
  const cf = a => a === 1 ? "" : a === -1 ? "−" : fmt(a);
  const br = d => d === 0 ? "x" : "(x " + (d < 0 ? "+ " + fmt(-d) : "− " + fmt(d)) + ")";
  const vertex = (a, d, e) => cf(a) + (d === 0 ? "x" : br(d)) + "²" + (e ? (e > 0 ? " + " : " − ") + fmt(Math.abs(e)) : "");
  const factored = (a, x1, x2) => cf(a) + [x1, x2].sort((p, q) => Math.abs(p) - Math.abs(q)).map(br).join("");
  /** Graph-Daten: Kurven als Punktlisten, für die Anzeige (views-mathe.js) */
  const R5 = [-5, 5, -5, 5];
  function sample(f, x0, x1) {
    const out = []; let cur = [];
    for (let i = 0; i <= 240; i++) { const x = x0 + (x1 - x0) * i / 240, y = f(x); if (!isFinite(y) || Math.abs(y) > 30) { if (cur.length > 1) out.push(cur); cur = []; continue; } cur.push([x, y]); }
    if (cur.length > 1) out.push(cur); return out;
  }
  const param = (fx, fy, t0, t1) => { const c = []; for (let i = 0; i <= 240; i++) { const t = t0 + (t1 - t0) * i / 240; c.push([fx(t), fy(t)]); } return [c]; };

  /* ---------- Fachbegriffe & Operatoren ---------- */
  const TERMS = [
    ["Funktion", "Zuordnung, die jedem x-Wert genau einen y-Wert zuordnet"],
    ["Definitionsmenge D", "alle x-Werte, die man einsetzen darf"],
    ["Wertemenge W", "alle y-Werte, die herauskommen können"],
    ["Funktionswert", "der y-Wert f(x), der zu einem bestimmten x gehört"],
    ["Nullstelle", "x-Wert, an dem der Graph die x-Achse schneidet: f(x) = 0"],
    ["y-Achsenabschnitt", "y-Wert, an dem der Graph die y-Achse schneidet: f(0)"],
    ["Steigung m", "um wie viel f(x) wächst, wenn x um 1 größer wird"],
    ["Scheitelpunkt", "höchster oder tiefster Punkt einer Parabel"],
    ["Graph", "alle Punkte (x | f(x)), im Koordinatensystem eingezeichnet"],
    ["Wertetabelle", "Tabelle mit x-Werten und den zugehörigen Funktionswerten"],
    ["Funktionsgleichung", "Rechenvorschrift, z. B. f(x) = 2x + 1"],
    ["Argument", "der x-Wert, den man in die Funktion einsetzt"],
    ["monoton steigend", "wenn x größer wird, wird f(x) nicht kleiner"],
    ["achsensymmetrisch", "an der y-Achse gespiegelt gleich: f(−x) = f(x)"]
  ];
  const OPS = [
    ["nennen / angeben", "Ergebnis hinschreiben – ohne Begründung, ohne Rechnung"],
    ["beschreiben", "in ganzen Sätzen darstellen, was man sieht – ohne Begründung"],
    ["berechnen", "vom Ansatz aus mit Rechenschritten zum Ergebnis – Rechenweg aufschreiben"],
    ["bestimmen / ermitteln", "Lösungsweg zeigen und Ergebnis angeben – Hilfsmittel wie GeoGebra oft erlaubt, der Weg muss erkennbar sein"],
    ["skizzieren", "grob von Hand darstellen – wichtige Merkmale (Nullstellen, Scheitel …) erkennbar"],
    ["zeichnen", "genau darstellen – mit Geodreieck, Achsen beschriftet, Maßstab"],
    ["zeigen / nachweisen", "eine Aussage durch korrekte Rechen- oder Argumentationsschritte bestätigen"],
    ["begründen", "eine Aussage mit Regeln, Rechnungen oder Argumenten stützen"],
    ["untersuchen", "bestimmte Eigenschaften gezielt herausfinden (z. B. Nullstellen, Symmetrie)"],
    ["interpretieren", "ein Ergebnis im Sachzusammenhang deuten – mit Antwortsatz"],
    ["vergleichen", "Gemeinsamkeiten und Unterschiede herausarbeiten"],
    ["entscheiden", "sich festlegen – meist mit kurzer Begründung"]
  ];
  const pickPair = (list, r, rev) => {
    const i = Math.floor(r() * list.length) % list.length; const others = list.filter((_, k) => k !== i).sort(() => r() - 0.5).slice(0, 3);
    const opts = [list[i], ...others].sort(() => r() - 0.5);
    return rev ? { q: list[i][0], opts: opts.map(o => o[1]), answer: opts.indexOf(list[i]), right: list[i] } : { q: list[i][1], opts: opts.map(o => o[0]), answer: opts.indexOf(list[i]), right: list[i] };
  };

  /* ---------- GeoGebra ---------- */
  const GG_IN = [
    ["f(x) = x³ − 2x", ["x^3-2x", "x^3-2*x"], "Hochzahl mit ^ – x³ wird x^3"],
    ["f(x) = √x", ["sqrt(x)", "x^(1/2)", "x^0.5"], "Wurzel: sqrt(x)"],
    ["f(x) = √(x + 3)", ["sqrt(x+3)", "(x+3)^(1/2)", "(x+3)^0.5"], "Alles unter der Wurzel in die Klammer: sqrt(x+3)"],
    ["f(x) = 1 / (x + 1)", ["1/(x+1)", "(x+1)^(-1)"], "Nenner in Klammern! 1/x+1 wäre (1/x) + 1"],
    ["f(x) = (x − 2)² + 1", ["(x-2)^2+1"], "Klammer zuerst, dann ^2"],
    ["f(x) = −x² + 4", ["-x^2+4", "4-x^2"], "Minus vorne einfach davor schreiben"],
    ["f(x) = 0,5x² − 3", ["0.5x^2-3", "1/2x^2-3", "x^2/2-3", "(1/2)x^2-3"], "Dezimalpunkt statt Komma: 0.5 (GeoGebra nimmt auch 0,5)"],
    ["f(x) = x⁻²", ["x^(-2)", "x^-2", "1/x^2"], "Negative Hochzahl in Klammern: x^(-2)"],
    ["f(x) = 2(x + 1)(x − 3)", ["2(x+1)(x-3)", "2*(x+1)*(x-3)"], "Malzeichen kann man weglassen oder * schreiben"],
    ["f(x) = (2x + 1) / (x − 3)", ["(2x+1)/(x-3)"], "Zähler UND Nenner in Klammern"]
  ];
  const GG_CMD_POOL = ["Nullstelle(f)", "Schneide(f, g)", "Extremum(f)", "f(3)", "f(0)", "Tabellen-Ansicht öffnen (Wertetabelle)", "Grafik-Einstellungen: x- und y-Bereich anpassen", "Wendepunkt(f)"];
  const GG_CMD = [
    ["die Nullstellen von f", "Nullstelle(f)"], ["die Schnittpunkte von f und g", "Schneide(f, g)"], ["den Scheitelpunkt (Hoch- oder Tiefpunkt) von f", "Extremum(f)"],
    ["den Funktionswert an der Stelle x = 3", "f(3)"], ["den y-Achsenabschnitt", "f(0)"], ["eine Wertetabelle von f", "Tabellen-Ansicht öffnen (Wertetabelle)"],
    ["den Graphen sehen – er ist abgeschnitten oder winzig", "Grafik-Einstellungen: x- und y-Bereich anpassen"]
  ];

  /* ---------- Generatoren ---------- */
  const G = {
    "ck:begriff": (r) => { const rev = r() < 0.4; const p = pickPair(TERMS, r, rev);
      return T({ kind: "chip", prompt: rev ? "Was bedeutet „" + p.q + "“?" : "Welcher Fachbegriff passt? – " + p.q, opts: p.opts, answer: p.answer, rule: "Lerne die Begriffe mit Beispiel: Nullstelle → f(x) = 0, y-Achsenabschnitt → f(0)", steps: [p.right[0] + ": " + p.right[1]] }); },
    "ck:isfn": (r, l) => {
      const shapes = [
        ["Gerade", true, sample(x => 0.5 * x + 1, -5, 5)], ["Parabel", true, sample(x => x * x - 2, -5, 5)], ["S-Kurve", true, sample(x => 0.2 * x ** 3 - x, -5, 5)], ["Hyperbel", true, sample(x => 1 / x, -5, 5)],
        ["Kreis", false, param(t => 3 * Math.cos(t), t => 3 * Math.sin(t), 0, 2 * Math.PI)], ["liegende Parabel", false, param(t => t * t - 2, t => t, -2.6, 2.6)],
        ["senkrechte Gerade", false, [[[2, -5], [2, 5]]]], ["liegende S-Kurve", false, param(t => 0.2 * t ** 3 - 1.5 * t, t => t, -3.6, 3.6)]
      ];
      if (r() < (l ? 0.3 : 0.15)) { // Wertetabelle
        const yes = r() < 0.5; const xs = yes ? [1, 2, 3, 4] : [1, 2, 2, 3]; const ys = yes ? [4, 5, 5, 7] : [4, 5, 6, 7];
        return T({ kind: "chip", table: { x: xs, y: ys }, prompt: "Stellt diese Wertetabelle eine Funktion dar?", opts: ["Ja – das ist eine Funktion", "Nein – keine Funktion"], answer: yes ? 0 : 1, rule: "Funktion: jedes x kommt nur EINMAL vor (gleiche y-Werte sind erlaubt)", steps: yes ? ["Jedes x kommt nur einmal vor → Funktion", "Dass y = 5 zweimal vorkommt, ist erlaubt"] : ["x = 2 hat zwei verschiedene y-Werte (5 und 6) → keine Funktion"] });
      }
      const [name, ok, curves] = pick(shapes, r);
      return T({ kind: "chip", plot: { range: R5, curves }, prompt: "Ist dieser Graph der Graph einer Funktion?", opts: ["Ja – das ist eine Funktion", "Nein – keine Funktion"], answer: ok ? 0 : 1, rule: "Senkrechte-Linien-Test: Schneidet IRGENDEINE senkrechte Linie den Graphen mehr als einmal → keine Funktion",
        steps: ok ? [name + ": Jede senkrechte Linie trifft den Graphen höchstens einmal", "→ zu jedem x genau ein y → Funktion"] : [name + ": Eine senkrechte Linie trifft den Graphen zweimal", "→ zu einem x gehören zwei y-Werte → keine Funktion"] }); },
    "ck:dwquad": (r, l) => { const a = pick(l ? [1, -1, 2, -0.5] : [1, -1], r), d = int(-3, 3, r), e = int(-4, 4, r);
      return T({ kind: "chip", prompt: "Wertemenge von f(x) = " + vertex(a, d, e) + "?", opts: ["W = ℝ (alle Zahlen)", "W: y ≥ " + fmt(e), "W: y ≤ " + fmt(e), "W: y > " + fmt(e)], answer: a > 0 ? 1 : 2, rule: "Scheitelpunktform a(x − d)² + e: Scheitel S(d | e). a > 0 → nach oben offen → y ≥ e, a < 0 → y ≤ e",
        steps: ["Scheitelpunkt S(" + fmt(d) + " | " + fmt(e) + ")", "a = " + fmt(a) + (a > 0 ? " > 0 → nach oben offen → e ist der tiefste Wert" : " < 0 → nach unten offen → e ist der höchste Wert"), "→ W: y " + (a > 0 ? "≥ " : "≤ ") + fmt(e)] }); },
    "ck:dwlin": (r) => { const m = r() < 0.25 ? 0 : pick([2, -1, 0.5, -3, 1], r), b = int(-4, 5, r);
      return T({ kind: "chip", prompt: "Wertemenge von f(x) = " + lin(m, b) + "?", opts: ["W = ℝ (alle Zahlen)", "W = {" + fmt(b) + "}", "W: y ≥ " + fmt(b), "W: y ≤ " + fmt(b)], answer: m ? 0 : 1, rule: "Gerade mit Steigung ≠ 0 trifft jeden y-Wert → W = ℝ. Waagerechte Gerade (m = 0) nur den Wert b.",
        steps: m ? ["Steigung m = " + fmt(m) + " ≠ 0 → die Gerade geht ganz nach oben und unten", "→ W = ℝ"] : ["m = 0 → waagerechte Gerade y = " + fmt(b), "→ W = {" + fmt(b) + "}"] }); },
    "ck:dwsqrt": (r) => { const k = int(-3, 3, r);
      return T({ kind: "chip", prompt: "Definitionsmenge von f(x) = √" + (k ? "(" + lin(1, -k) + ")" : "x") + "?", opts: ["D = ℝ (alle Zahlen)", "D: x ≥ " + fmt(k), "D: x > " + fmt(k), "D: x ≤ " + fmt(k)], answer: 1, rule: "Unter der Wurzel darf keine negative Zahl stehen: Term unter der Wurzel ≥ 0",
        steps: [(k ? lin(1, -k) : "x") + " ≥ 0", "→ x ≥ " + fmt(k)] }); },
    "ck:table": (r, l) => { const q = l && r() < 0.5; const m = intNZ(-3, 3, r), b = int(-3, 3, r), a = pick([1, -1, 2], r), c = int(-3, 3, r);
      const f = q ? x => a * x * x + c : x => m * x + b; const term = q ? quad(a, 0, c) : lin(m, b); const x0 = int(-2, 0, r); const xs = [x0, x0 + 1, x0 + 2, x0 + 3];
      return T({ kind: "pair", prompt: "Fülle die Wertetabelle aus: f(x) = " + term, labels: xs.map(x => "f(" + fmt(x) + ") ="), answer: xs.map(f), rule: "Jeden x-Wert einsetzen – negative Zahlen in Klammern: (−2)² = 4",
        steps: xs.map(x => "f(" + fmt(x) + ") = " + (q ? cf(a) + par(x) + "²" + (c ? (c > 0 ? " + " : " − ") + fmt(Math.abs(c)) : "") : (m === 1 ? "" : m === -1 ? "−" : fmt(m) + " · ") + par(x) + (b ? (b > 0 ? " + " : " − ") + fmt(Math.abs(b)) : "")) + " = " + fmt(f(x))) }); },
    "ck:tab2eq": (r, l) => { const m = l === 2 && r() < 0.3 ? pick([0.5, -0.5], r) : intNZ(-3, 3, r), b = int(-4, 4, r); const xs = l === 2 ? [1, 2, 3, 4] : [0, 1, 2, 3]; const ys = xs.map(x => m * x + b);
      return T({ kind: "pair", table: { x: xs, y: ys }, prompt: "Die Tabelle gehört zu einer linearen Funktion f(x) = mx + b. Bestimme m und b.", labels: ["m =", "b ="], answer: [m, b], rule: "m = Δy : Δx (wie viel y pro 1 Schritt x), b = f(0)",
        steps: ["m = (" + fmt(ys[1]) + " − " + par(ys[0]) + ") : (" + fmt(xs[1]) + " − " + par(xs[0]) + ") = " + fmt(m), xs[0] === 0 ? "b = f(0) = " + fmt(b) + " (steht in der Tabelle bei x = 0)" : "b = y − m·x = " + fmt(ys[0]) + " − " + par(m) + " · " + fmt(xs[0]) + " = " + fmt(b), "→ f(x) = " + lin(m, b)] }); },
    "ck:readlin": (r, l) => { const m = pick(l ? [-2, -1, -0.5, 0.5, 1, 2, 3] : [1, 2, -1], r), b = int(-3, 3, r); const dx = Math.abs(m) === 0.5 ? 2 : 1;
      return T({ kind: "pair", plot: { range: R5, curves: sample(x => m * x + b, -5, 5), dots: [[0, b], [dx, b + m * dx]] }, prompt: "Lies m und b ab: f(x) = mx + b", labels: ["m =", "b ="], answer: [m, b], rule: "b: wo die Gerade die y-Achse schneidet. m: Steigungsdreieck – 1 nach rechts, dann m nach oben (negativ: nach unten)",
        steps: ["Schnitt mit der y-Achse bei " + fmt(b) + " → b = " + fmt(b), "Steigungsdreieck: " + dx + " nach rechts, " + fmt(Math.abs(m * dx)) + (m > 0 ? " nach oben" : " nach unten") + " → m = " + fmt(m * dx) + " : " + dx + " = " + fmt(m), "→ f(x) = " + lin(m, b)] }); },
    "ck:readpar": (r) => { const a = pick([1, -1], r), d = int(-3, 3, r), e = a > 0 ? int(-4, 1, r) : int(-1, 4, r);
      return T({ kind: "pair", plot: { range: R5, curves: sample(x => a * (x - d) ** 2 + e, -5, 5), dots: [[d, e]] }, prompt: "Lies den Scheitelpunkt S ab.", answer: [d, e], rule: "Scheitel = tiefster (oder höchster) Punkt. Danach: f(x) = a(x − d)² + e",
        steps: [(a > 0 ? "Tiefster" : "Höchster") + " Punkt bei x = " + fmt(d) + ", y = " + fmt(e), "S(" + fmt(d) + " | " + fmt(e) + ")", "Gleichung: f(x) = " + vertex(a, d, e)] }); },
    "ck:matchfn": (r) => {
      if (r() < 0.5) { const m = pick([2, -1, 0.5, -2, 1], r), b = intNZ(-3, 3, r);
        const opts = [lin(m, b), lin(-m, b), lin(m, -b), lin(b, m)].filter((x, i, a) => a.indexOf(x) === i); const sh = opts.map(o => [r(), o]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
        return T({ kind: "chip", plot: { range: R5, curves: sample(x => m * x + b, -5, 5) }, prompt: "Welche Funktionsgleichung gehört zum Graphen?", opts: sh.map(o => "f(x) = " + o), answer: sh.indexOf(lin(m, b)), rule: "Erst b am y-Achsenabschnitt prüfen, dann Steigung: steigt oder fällt die Gerade?", steps: ["y-Achsenabschnitt " + fmt(b) + ", Gerade " + (m > 0 ? "steigt" : "fällt") + " (m = " + fmt(m) + ")", "→ f(x) = " + lin(m, b)] }); }
      const a = pick([1, -1], r), d = intNZ(-3, 3, r), e = intNZ(-3, 3, r);
      const opts = [vertex(a, d, e), vertex(a, -d, e), vertex(a, d, -e), vertex(-a, d, e)]; const sh = opts.map(o => [r(), o]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
      return T({ kind: "chip", plot: { range: R5, curves: sample(x => a * (x - d) ** 2 + e, -5, 5) }, prompt: "Welche Funktionsgleichung gehört zum Graphen?", opts: sh.map(o => "f(x) = " + o), answer: sh.indexOf(vertex(a, d, e)), rule: "Scheitel S(d | e) ablesen → a(x − d)² + e. Achtung: S(2 | …) gibt (x − 2), S(−2 | …) gibt (x + 2)!",
        steps: ["Scheitel S(" + fmt(d) + " | " + fmt(e) + "), Parabel nach " + (a > 0 ? "oben" : "unten") + " offen", "→ f(x) = " + vertex(a, d, e)] }); },
    "ck:lin2pts": (r, l) => { const m = l === 2 && r() < 0.3 ? 0.5 : intNZ(-3, 3, r), b = int(-4, 4, r); let x1 = int(-3, 1, r), x2 = x1 + (m === 0.5 ? 2 : int(1, 3, r)); const y1 = m * x1 + b, y2 = m * x2 + b;
      return T({ kind: "pair", prompt: "Gerade durch A(" + fmt(x1) + " | " + fmt(y1) + ") und B(" + fmt(x2) + " | " + fmt(y2) + "). Bestimme f(x) = mx + b.", labels: ["m =", "b ="], answer: [m, b], rule: "m = (y₂ − y₁) : (x₂ − x₁), dann einen Punkt einsetzen: y = m·x + b → b ausrechnen",
        steps: ["m = (" + fmt(y2) + " − " + par(y1) + ") : (" + fmt(x2) + " − " + par(x1) + ") = " + fmt(y2 - y1) + " : " + fmt(x2 - x1) + " = " + fmt(m), "A einsetzen: " + fmt(y1) + " = " + fmt(m) + " · " + par(x1) + " + b → b = " + fmt(b), "→ f(x) = " + lin(m, b)] }); },
    "ck:probe2": (r, l) => { const q = l && r() < 0.6; const m = intNZ(-3, 3, r), b = int(-4, 4, r), a = pick([1, -1, 2], r), c = int(-4, 4, r), bb = int(-3, 3, r);
      const f = q ? x => a * x * x + bb * x + c : x => m * x + b; const term = q ? quad(a, bb, c) : lin(m, b); const x = int(-3, 3, r), real = f(x), on = r() < 0.5, y = on ? real : real + intNZ(-3, 3, r);
      return T({ kind: "chip", prompt: "Liegt P(" + fmt(x) + " | " + fmt(y) + ") auf dem Graphen von f(x) = " + term + "?", opts: ["Ja", "Nein"], answer: on ? 0 : 1, rule: "Punktprobe: x-Wert einsetzen, ausrechnen, mit dem y-Wert vergleichen",
        steps: ["f(" + fmt(x) + ") = " + fmt(real), on ? fmt(real) + " = " + fmt(y) + " → wahre Aussage → P liegt auf dem Graphen" : fmt(real) + " ≠ " + fmt(y) + " → P liegt nicht auf dem Graphen"] }); },
    "ck:fval2": (r, l) => { const q = l && r() < 0.6; const m = intNZ(-3, 4, r), b = int(-5, 5, r), a = pick([1, -1, 2, 0.5], r), bb = int(-3, 3, r), c = int(-4, 4, r); const x = l ? int(-3, 4, r) : int(1, 4, r);
      const v = q ? a * x * x + bb * x + c : m * x + b; const term = q ? quad(a, bb, c) : lin(m, b);
      return T({ prompt: "f(x) = " + term + "     f(" + fmt(x) + ") = ?", ask: "Funktionswert", answer: v, rule: "x überall durch die Zahl ersetzen – negative Zahlen in Klammern, Punkt vor Strich",
        steps: [q ? "f(" + fmt(x) + ") = " + cf(a) + par(x) + "²" + (bb ? (bb > 0 ? " + " : " − ") + fmt(Math.abs(bb)) + " · " + par(x) : "") + (c ? (c > 0 ? " + " : " − ") + fmt(Math.abs(c)) : "") : "f(" + fmt(x) + ") = " + (m === 1 ? "" : m === -1 ? "−" : fmt(m) + " · ") + par(x) + (b ? (b > 0 ? " + " : " − ") + fmt(Math.abs(b)) : ""), "= " + fmt(v)] }); },
    "ck:xlin": (r) => { const m = intNZ(-4, 4, r), b = int(-6, 6, r), x = int(-4, 6, r), y = m * x + b;
      return T({ prompt: "f(x) = " + lin(m, b) + ". Für welches x ist f(x) = " + fmt(y) + "?", ask: "x", answer: x, rule: "Umgekehrt: f(x) = Zahl setzen und nach x auflösen",
        steps: [lin(m, b) + " = " + fmt(y), (b ? (b > 0 ? "− " + b : "+ " + -b) + " → " : "") + poly([[m, "x"]]) + " = " + fmt(y - b), ": " + par(m) + " → x = " + fmt(x)] }); },
    "ck:xquad": (r, l) => { const a = l === 2 ? pick([1, 2], r) : 1, c = int(-5, 5, r), x0 = int(1, 5, r), y = a * x0 * x0 + c;
      return T({ kind: "nums", prompt: "f(x) = " + quad(a, 0, c) + ". Für welche x ist f(x) = " + fmt(y) + "?", answer: [x0, -x0], rule: "f(x) = Zahl setzen, nach x² auflösen, Wurzel ziehen: ± nicht vergessen!",
        steps: [quad(a, 0, c) + " = " + fmt(y), (c ? (c > 0 ? "− " + c : "+ " + -c) + " → " : "") + quad(a, 0, 0) + " = " + fmt(y - c) + (a !== 1 ? " → x² = " + fmt((y - c) / a) : ""), "x = ±√" + fmt(x0 * x0) + " = ±" + x0, "L = {−" + x0 + "; " + x0 + "}"] }); },
    "ck:yint": (r) => { const kind = pick(["lin", "std", "ver", "fac"], r); let term, v, step;
      if (kind === "lin") { const m = intNZ(-3, 3, r), b = int(-5, 5, r); term = lin(m, b); v = b; step = "f(0) = " + (m === 1 ? "" : m === -1 ? "−" : fmt(m) + " · ") + "0" + (b ? (b > 0 ? " + " : " − ") + Math.abs(b) : "") + " = " + fmt(b) + "  (bei mx + b ist es einfach b)"; }
      else if (kind === "std") { const a = pick([1, -1, 2], r), b = int(-4, 4, r), c = int(-6, 6, r); term = quad(a, b, c); v = c; step = "f(0) = " + fmt(c) + "  (bei ax² + bx + c ist es c)"; }
      else if (kind === "ver") { const a = pick([1, 2, -1], r), d = intNZ(-3, 3, r), e = int(-4, 4, r); term = vertex(a, d, e); v = a * d * d + e; step = "f(0) = " + cf(a) + "(0 " + (d < 0 ? "+ " + -d : "− " + d) + ")²" + (e ? (e > 0 ? " + " : " − ") + Math.abs(e) : "") + " = " + (a === 1 ? "" : fmt(a) + " · ") + fmt(d * d) + (e ? (e > 0 ? " + " : " − ") + Math.abs(e) : "") + " = " + fmt(v) + "  (NICHT einfach e!)"; }
      else { const a = pick([1, 2, -1], r), x1 = intNZ(-4, 4, r); let x2 = intNZ(-4, 4, r); if (x2 === x1) x2 = -x1 || 2; term = factored(a, x1, x2); v = a * x1 * x2; step = "f(0) = " + cf(a) + "(0 " + (x1 < 0 ? "+ " + -x1 : "− " + x1) + ")(0 " + (x2 < 0 ? "+ " + -x2 : "− " + x2) + ") = " + fmt(v); }
      return T({ prompt: "Berechne den y-Achsenabschnitt von f(x) = " + term, ask: "y-Wert von Sᵧ(0 | ?)", answer: v, rule: "y-Achse heißt x = 0 → f(0) ausrechnen", steps: ["x = 0 einsetzen:", step, "Sᵧ(0 | " + fmt(v) + ")"] }); },
    /* Nullstellen */
    "ck:nlin": (r) => { const m = intNZ(-4, 4, r), x0 = int(-5, 5, r), b = -m * x0;
      return T({ kind: "nums", prompt: "Berechne die Nullstelle von f(x) = " + lin(m, b), answer: [x0], rule: "f(x) = 0 setzen und nach x auflösen", steps: [lin(m, b) + " = 0", b ? (b > 0 ? "− " + b : "+ " + -b) + " → " + poly([[m, "x"]]) + " = " + fmt(-b) : "", ": " + par(m) + " → x = " + fmt(x0), "N(" + fmt(x0) + " | 0)"].filter(Boolean) }); },
    "ck:nfactor": (r, l) => { const a = pick(l ? [1, 2, -1, 0.5, 3] : [1, 2], r), x1 = int(-5, 5, r); let x2 = int(-5, 5, r); if (x2 === x1) x2 = x1 === 0 ? 3 : 0;
      return T({ kind: "nums", prompt: "Nullstellen von f(x) = " + factored(a, x1, x2) + "?", answer: [x1, x2], rule: "Linearfaktorform ablesen: Ein Produkt ist 0, wenn ein Faktor 0 ist (Satz vom Nullprodukt)",
        steps: ["Satz vom Nullprodukt: " + [x1, x2].map(x => (x === 0 ? "x" : "x " + (x < 0 ? "+ " + -x : "− " + x)) + " = 0 → x = " + fmt(x)).join("  oder  "), "L = {" + [x1, x2].sort((p, q) => p - q).map(fmt).join("; ") + "}"] }); },
    "ck:nsq": (r, l) => { const a = pick(l ? [1, 2, 3] : [1], r), s = int(1, 6, r), none = l === 2 && r() < 0.25;
      if (none) { const k = int(1, 9, r); return T({ kind: "nums", prompt: "Nullstellen von f(x) = " + quad(1, 0, k) + "?", answer: [], rule: "x² ist nie negativ", steps: ["x² + " + k + " = 0 → x² = −" + k, "Ein Quadrat kann nicht negativ sein → keine Nullstelle"] }); }
      return T({ kind: "nums", prompt: "Nullstellen von f(x) = " + quad(a, 0, -a * s * s) + "?", answer: [s, -s], rule: "Äquivalenzumformung: nach x² auflösen, dann ±Wurzel",
        steps: [quad(a, 0, -a * s * s) + " = 0", "+ " + fmt(a * s * s) + (a !== 1 ? " und : " + a : "") + " → x² = " + fmt(s * s), "x = ±√" + fmt(s * s) + " = ±" + s, "L = {−" + s + "; " + s + "}"] }); },
    "ck:nausk": (r, l) => { const a = pick(l ? [1, 2, -1, 3] : [1], r), x0 = intNZ(-5, 5, r), b = -a * x0;
      return T({ kind: "nums", prompt: "Nullstellen von f(x) = " + quad(a, b, 0) + "?", answer: [0, x0], rule: "Kein Zahlglied (c = 0)? → x ausklammern, dann Satz vom Nullprodukt",
        steps: ["x ausklammern: x · (" + lin(a, b) + ") = 0", "x = 0  oder  " + lin(a, b) + " = 0 → x = " + fmt(x0), "L = {" + [0, x0].sort((p, q) => p - q).map(fmt).join("; ") + "}"] }); },
    "ck:npq": (r, l) => {
      if (l === 2 && r() < 0.2) { const p = pick([2, 4, -2], r), q = (p / 2) ** 2 + int(1, 4, r);
        return T({ kind: "nums", prompt: "Nullstellen von f(x) = " + quad(1, p, q) + "?", answer: [], rule: "p-q-Formel: x = −p/2 ± √((p/2)² − q). Ist der Wert unter der Wurzel negativ → keine Lösung",
          steps: ["p = " + fmt(p) + ", q = " + fmt(q), "(p/2)² − q = " + fmt((p / 2) ** 2) + " − " + fmt(q) + " = " + fmt((p / 2) ** 2 - q) + " < 0", "→ keine Nullstelle"] }); }
      const x1 = int(-6, 6, r); let x2 = int(-6, 6, r); if (x2 === x1) x2 = x1 + 2; const k = l && r() < 0.35 ? pick([2, -1, 3], r) : 1;
      const p = -(x1 + x2), q = x1 * x2, D = (p / 2) ** 2 - q, h = -p / 2;
      return T({ kind: "nums", prompt: "Nullstellen von f(x) = " + quad(k, k * p, k * q) + "?", answer: [x1, x2], rule: "Form x² + px + q = 0 (vorher durch die Zahl vor x² teilen!), dann x = −p/2 ± √((p/2)² − q)",
        steps: [(k !== 1 ? ": " + par(k) + " → " : "") + quad(1, p, q) + " = 0", "p = " + fmt(p) + ", q = " + fmt(q), "x = " + fmt(h) + " ± √(" + fmt((p / 2) ** 2) + " − " + par(q) + ") = " + fmt(h) + " ± √" + fmt(D) + " = " + fmt(h) + " ± " + fmt(Math.sqrt(D)), "x₁ = " + fmt(Math.min(x1, x2)) + ", x₂ = " + fmt(Math.max(x1, x2))] }); },
    /* Schnittpunkte */
    "ck:splin": (r) => { const m1 = int(-3, 3, r); let m2 = int(-3, 3, r); if (m2 === m1) m2 = m1 + 2; const xs = int(-3, 3, r), ys = int(-4, 5, r), b1 = ys - m1 * xs, b2 = ys - m2 * xs;
      return T({ kind: "pair", prompt: "Schnittpunkt von f(x) = " + lin(m1, b1) + " und g(x) = " + lin(m2, b2) + "?", answer: [xs, ys], rule: "Gleichsetzen f(x) = g(x), nach x auflösen, dann x in f einsetzen für y",
        steps: [lin(m1, b1) + " = " + lin(m2, b2), poly([[m1 - m2, "x"]]) + " = " + fmt(b2 - b1) + " → x = " + fmt(xs), "y = f(" + fmt(xs) + ") = " + fmt(ys), "S(" + fmt(xs) + " | " + fmt(ys) + ")"] }); },
    "ck:splq": (r) => { const x1 = int(-3, 3, r); let x2 = int(-3, 3, r); if (x2 === x1) x2 = x1 + 1; const k = int(-2, 2, r), m = x1 + x2, b = -x1 * x2 + k;
      return T({ kind: "nums", prompt: "x-Koordinaten der Schnittpunkte von f(x) = " + quad(1, 0, k) + " und g(x) = " + lin(m, b) + "?", answer: [x1, x2], rule: "Gleichsetzen, alles auf eine Seite (= 0), dann p-q-Formel oder Faktorisieren",
        steps: [quad(1, 0, k) + " = " + lin(m, b), quad(1, -m, k - b) + " = 0", "p-q-Formel → x₁ = " + fmt(Math.min(x1, x2)) + ", x₂ = " + fmt(Math.max(x1, x2)), "Punkte: (" + fmt(x1) + " | " + fmt(x1 * x1 + k) + ") und (" + fmt(x2) + " | " + fmt(x2 * x2 + k) + ")"] }); },
    /* Sachaufgaben */
    "ck:sach": (r, l) => { const t = pick(["tarif", "vergleich", "kerze", "wurf", "wurfmax", "prozent"], r);
      if (t === "tarif") { const G0 = pick([5, 8, 10, 12], r), p = pick([2, 3, 4], r), n = int(3, 10, r);
        return T({ prompt: "Ein Handytarif kostet " + G0 + " € Grundgebühr im Monat und " + p + " € pro GB. Was kostet ein Monat mit " + n + " GB?", ask: "Kosten in €", answer: G0 + p * n, rule: "Lineare Funktion: K(x) = Preis pro Einheit · x + Grundgebühr", steps: ["K(x) = " + p + "x + " + G0, "K(" + n + ") = " + p + " · " + n + " + " + G0 + " = " + (G0 + p * n), "Antwort: Der Monat kostet " + (G0 + p * n) + " €."] }); }
      if (t === "vergleich") { const x0 = int(4, 10, r), p1 = pick([3, 4, 5], r), p2 = p1 - pick([1, 2], r), G1 = pick([0, 2, 5], r), G2 = G1 + (p1 - p2) * x0;
        return T({ prompt: "Tarif A: " + G1 + " € Grundgebühr + " + p1 + " € pro GB. Tarif B: " + G2 + " € Grundgebühr + " + p2 + " € pro GB. Bei wie vielen GB kosten beide gleich viel?", ask: "GB", answer: x0, rule: "Beide Kosten-Funktionen aufstellen und gleichsetzen", steps: ["A(x) = " + lin(p1, G1) + ",  B(x) = " + lin(p2, G2), lin(p1, G1) + " = " + lin(p2, G2), (p1 - p2) + "x = " + (G2 - G1) + " → x = " + x0, "Antwort: Bei " + x0 + " GB kosten beide gleich viel, darüber ist B günstiger."] }); }
      if (t === "kerze") { const k = pick([2, 3, 4, 5, 6], r), h = k * pick([4, 5, 6, 8], r);
        return T({ prompt: "Eine Kerze ist " + h + " cm hoch und brennt pro Stunde " + k + " cm ab. Nach wie vielen Stunden ist sie abgebrannt?", ask: "Stunden", answer: h / k, rule: "h(t) = Starthöhe − Abbrand · t, Nullstelle berechnen", steps: ["h(t) = " + h + " − " + k + "t", h + " − " + k + "t = 0 → t = " + h + " : " + k + " = " + fmt(h / k), "Antwort: Nach " + fmt(h / k) + " Stunden ist die Kerze abgebrannt."] }); }
      if (t === "wurf" || t === "wurfmax") { const v = pick([10, 20, 30], r);
        if (t === "wurf") return T({ prompt: "Ein Ball wird hochgeworfen. Seine Höhe (in m) nach t Sekunden ist h(t) = −5t² + " + v + "t. Nach wie vielen Sekunden landet er wieder?", ask: "Sekunden", answer: v / 5, rule: "Landen heißt Höhe 0 → Nullstellen, t ausklammern", steps: ["−5t² + " + v + "t = 0 → t(−5t + " + v + ") = 0", "t = 0 (Abwurf) oder −5t + " + v + " = 0 → t = " + fmt(v / 5), "Antwort: Nach " + fmt(v / 5) + " s landet der Ball."] });
        return T({ prompt: "Ein Ball wird hochgeworfen: h(t) = −5t² + " + v + "t (h in m, t in s). Wie hoch fliegt er maximal?", ask: "maximale Höhe in m", answer: v * v / 20, rule: "Höchster Punkt = Scheitelpunkt. Er liegt genau in der Mitte zwischen den Nullstellen", steps: ["Nullstellen: t = 0 und t = " + fmt(v / 5), "Mitte: t = " + fmt(v / 10), "h(" + fmt(v / 10) + ") = −5 · " + fmt((v / 10) ** 2) + " + " + v + " · " + fmt(v / 10) + " = " + fmt(v * v / 20), "Antwort: maximal " + fmt(v * v / 20) + " m hoch."] }); }
      const P = pick([40, 60, 80, 120], r), q = pick([10, 20, 25, 30], r), up = l && r() < 0.4; const v = P * (1 + (up ? q : -q) / 100);
      return T({ prompt: "Ein Pulli kostet " + P + " €. Der Preis wird um " + q + " % " + (up ? "erhöht" : "reduziert") + ". Wie viel kostet er jetzt?", ask: "Preis in €", answer: v, rule: "Neuer Preis = alter Preis · (1 ± p/100)", steps: [P + " · " + fmt(1 + (up ? q : -q) / 100) + " = " + fmt(v), "Antwort: Er kostet jetzt " + fmt(v) + " €."] }); },
    /* GeoGebra & Operatoren */
    "ck:gg": (r) => { const [f, ans, tip] = pick(GG_IN, r);
      return T({ kind: "text", prompt: "Wie tippst du " + f + " in GeoGebra ein?", ask: "GeoGebra-Eingabe (z. B. x^2+1)", answer: ans, rule: "Hochzahl ^ · Wurzel sqrt( ) · Brüche: Zähler und Nenner in Klammern · Dezimalpunkt", steps: [tip, "Eingabe: " + ans[0]] }); },
    "ck:ggcmd": (r) => { const [what, cmd] = pick(GG_CMD, r); const opts = [cmd, ...GG_CMD_POOL.filter(c => c !== cmd).sort(() => r() - 0.5).slice(0, 3)].sort(() => r() - 0.5);
      return T({ kind: "chip", prompt: "Du willst in GeoGebra " + what + ". Was gibst du ein / was machst du?", opts, answer: opts.indexOf(cmd), rule: "Befehle: Nullstelle(f), Schneide(f, g), Extremum(f), f(Zahl)", steps: [cmd + " – " + what] }); },
    "ck:op": (r) => { const rev = r() < 0.5; const p = pickPair(OPS, r, rev);
      return T({ kind: "chip", prompt: rev ? "Operator „" + p.q + "“ – was wird von dir verlangt?" : "Welcher Operator passt? – " + p.q, opts: p.opts, answer: p.answer, rule: "Operator = Arbeitsauftrag. „Berechne“ → Rechenweg, „Skizziere“ → grob, „Zeichne“ → genau", steps: [p.right[0] + ": " + p.right[1]] }); }
  };
  Object.assign(MK.GEN, G);

  /* ---------- Checkliste ---------- */
  // learn: Erklär-Blöcke {h, t, f (Merkkasten), ex (Beispiel-Schritte)} · **fett** erlaubt
  const ITEMS = [
    { nr: 1, area: "Funktionen allgemein", title: "Ich kenne wichtige Fachbegriffe rund ums Thema Funktionen.", short: "Fachbegriffe", book: ["S. 32, Nr. 1", "S. 11, Nr. 10"], keys: ["ck:begriff"],
      learn: [
        { h: "Was ist eine Funktion?", t: "Eine **Funktion** ordnet jedem x-Wert **genau einen** y-Wert zu. Man schreibt f(x) = … (sprich „f von x“).", f: "f(x) = 2x + 1   →   f(3) = 2 · 3 + 1 = 7" },
        { h: "Die wichtigsten Begriffe", t: "**Argument** = eingesetzter x-Wert · **Funktionswert** = y-Wert f(x) · **Definitionsmenge D** = alle erlaubten x · **Wertemenge W** = alle möglichen y · **Graph** = alle Punkte (x | f(x)) · **Nullstelle** = x mit f(x) = 0 · **y-Achsenabschnitt** = f(0) · **Steigung m** = Zuwachs pro 1 Schritt nach rechts · **Scheitelpunkt** = höchster/tiefster Punkt einer Parabel." },
        { h: "Beispiel", ex: ["f(x) = x² − 4", "Funktionswert an x = 3: f(3) = 9 − 4 = 5 → Punkt (3 | 5)", "Nullstellen: x² − 4 = 0 → x = 2 oder x = −2", "y-Achsenabschnitt: f(0) = −4", "Scheitelpunkt: S(0 | −4)"] }
      ],
      paper: ["Leg dir ein **Begriffs-Glossar** an (Heft oder GoodNotes): Begriff – Erklärung in eigenen Worten – ein Beispiel.", "Nimm f(x) = x² − 4 und markiere im Graphen (skizzieren!): Nullstellen, y-Achsenabschnitt, Scheitelpunkt."] },
    { nr: 2, area: "Funktionen allgemein", title: "Ich kann entscheiden, ob ein Graph eine Funktion darstellt oder nicht.", short: "Funktion oder nicht?", book: ["S. 32, Nr. 2"], keys: ["ck:isfn"],
      learn: [
        { h: "Der Senkrechte-Linien-Test", t: "Fahre gedanklich mit einer **senkrechten Linie** (wie ein Lineal, hochkant) von links nach rechts über den Graphen. Trifft sie den Graphen **irgendwo zweimal oder öfter** → **keine Funktion**, weil zu einem x dann zwei y-Werte gehören.", f: "höchstens 1 Schnittpunkt überall → Funktion" },
        { h: "Typische Beispiele", t: "**Funktion:** Gerade (nicht senkrecht), Parabel, x³-Kurve, Hyperbel 1/x. **Keine Funktion:** Kreis, liegende Parabel (x = y²), senkrechte Gerade (x = 2)." },
        { h: "Bei Wertetabellen", t: "Kommt ein **x-Wert doppelt** mit verschiedenen y-Werten vor → keine Funktion. Gleiche **y-Werte** dürfen mehrfach vorkommen!", ex: ["x: 1, 2, 2, 3 | y: 4, 5, 6, 7 → x = 2 hat zwei y-Werte → keine Funktion", "x: 1, 2, 3, 4 | y: 4, 5, 5, 7 → okay, y = 5 doppelt ist erlaubt → Funktion"] }
      ],
      paper: ["Skizziere **zwei Graphen, die keine Funktion** sind, und zeichne die senkrechte Linie ein, die den Graphen zweimal schneidet.", "Schreibe den Merksatz in eigenen Worten auf: „Eine Funktion ist …“"] },
    { nr: 3, area: "Funktionen allgemein", title: "Ich kann zu einer gegebenen Funktionsgleichung den Definitions- und Wertebereich angeben.", short: "Definitions- und Wertebereich", book: ["S. 22, Nr. 4a", "S. 32, Nr. 16c"], keys: ["ck:dwlin", "ck:dwquad", "ck:dwsqrt", "eigen:d", "eigen:w"],
      learn: [
        { h: "Definitionsbereich D – was darf ich einsetzen?", t: "Meist **alle Zahlen: D = ℝ**. Ausnahmen: **Bruch** mit x im Nenner → Nenner ≠ 0 (z. B. 1/x: D = ℝ \\ {0}). **Wurzel** → unter der Wurzel ≥ 0 (z. B. √(x − 2): D: x ≥ 2)." },
        { h: "Wertebereich W – was kann herauskommen?", t: "**Gerade** mit m ≠ 0: W = ℝ. **Parabel** f(x) = a(x − d)² + e: Scheitel S(d | e). Nach oben offen (a > 0): **W: y ≥ e**. Nach unten offen (a < 0): **W: y ≤ e**.", f: "f(x) = 2(x − 1)² + 3 → S(1 | 3), a > 0 → W: y ≥ 3" },
        { h: "Potenzfunktionen", t: "x² , x⁴: W: y ≥ 0 · x³: W = ℝ · 1/x: D = W = ℝ \\ {0} · 1/x²: D = ℝ \\ {0}, W: y > 0" }
      ],
      paper: ["Skizziere f(x) = −(x + 2)² + 1 und färbe den Wertebereich an der y-Achse ein.", "Schreibe eine Tabelle: Funktionstyp | D | W (Gerade, Parabel, x³, 1/x, √x)."] },
    { nr: 4, area: "Funktionen allgemein", title: "Ich kann eine Funktion als Funktionsgleichung, Wertetabelle und Graph darstellen und diese Darstellungsformen ineinander überführen.", short: "Gleichung ↔ Tabelle ↔ Graph", book: ["S. 32, Nr. 7a", "S. 34, Nr. 16a, b", "S. 35, Nr. 20b"], keys: ["ck:table", "ck:tab2eq", "ck:readlin", "ck:readpar"],
      learn: [
        { h: "Gleichung → Tabelle → Graph", t: "Wähle x-Werte (z. B. −2 bis 2), setze sie ein, schreibe die y-Werte in die Tabelle, trage die Punkte ein und verbinde sie (Gerade mit Lineal, Parabel als glatte Kurve).", ex: ["f(x) = 2x − 1", "x: −1 | 0 | 1 | 2", "y: −3 | −1 | 1 | 3", "Punkte eintragen → Gerade durchziehen"] },
        { h: "Tabelle → Gleichung (linear)", t: "**m = Δy : Δx** (um wie viel wächst y, wenn x um 1 wächst). **b = f(0)** = der y-Wert bei x = 0.", f: "x: 0 | 1 | 2   y: 1 | 4 | 7  →  m = 3, b = 1  →  f(x) = 3x + 1" },
        { h: "Graph → Gleichung", t: "**Gerade:** b am Schnitt mit der y-Achse ablesen, m mit dem Steigungsdreieck (1 nach rechts, m nach oben). **Parabel:** Scheitel S(d | e) ablesen → f(x) = a(x − d)² + e (a = ±1, wenn sie wie die Normalparabel aussieht)." }
      ],
      paper: ["Zeichne zu f(x) = 0,5x² − 2 eine **Wertetabelle (x von −3 bis 3)** und den **Graphen** auf Karopapier (1 Kästchen = 0,5) – Achsen beschriften!", "Zeichne bei einer Geraden das **Steigungsdreieck** farbig ein."] },
    { nr: 5, area: "Funktionen allgemein", title: "Ich kann rechnerisch prüfen, ob ein Punkt auf dem Funktionsgraphen liegt (Punktprobe).", short: "Punktprobe", book: ["S. 22, Nr. 4c", "S. 32, Nr. 9"], keys: ["ck:probe2", "werte:probe"],
      learn: [
        { h: "So geht die Punktprobe", t: "Setze den **x-Wert** des Punktes in f ein und rechne aus. Kommt **genau der y-Wert** heraus → der Punkt liegt auf dem Graphen. Sonst nicht.", f: "P(2 | 5), f(x) = x² + 1:  f(2) = 4 + 1 = 5 = 5 ✓ → P liegt auf dem Graphen" },
        { h: "So schreibst du es in der Klausur auf", ex: ["P(−1 | 3), f(x) = 2x + 4", "f(−1) = 2 · (−1) + 4 = 2", "2 ≠ 3 → P liegt nicht auf dem Graphen von f."] }
      ],
      paper: ["Rechne die Punktprobe **immer schriftlich mit Antwortsatz** – das gibt in der Klausur die Punkte."] },
    { nr: 6, area: "Lineare, quadratische und Potenzfunktionen", title: "Ich kann anhand einer Funktionsgleichung für gegebene x-Werte die dazugehörigen Funktionswerte berechnen und umgekehrt.", short: "Funktionswerte (und umgekehrt)", book: ["S. 14, Nr. 8b", "S. 19, Nr. 13b", "S. 22, Nr. 8b", "S. 32, Nr. 7b", "S. 33, Nr. 10", "S. 35, Nr. 20a"], keys: ["ck:fval2", "ck:xlin", "ck:xquad", "werte:f"],
      learn: [
        { h: "x gegeben → y ausrechnen", t: "x einsetzen. **Negative Zahlen in Klammern**, Potenz vor Punkt vor Strich.", f: "f(x) = x² − 3x  →  f(−2) = (−2)² − 3 · (−2) = 4 + 6 = 10" },
        { h: "y gegeben → x ausrechnen (umgekehrt)", t: "Setze f(x) = Zahl und löse nach x auf. **Linear:** eine Lösung. **Quadratisch:** oft zwei Lösungen (± beim Wurzelziehen!).", ex: ["f(x) = 3x − 2, gesucht x mit f(x) = 10", "3x − 2 = 10 | + 2", "3x = 12 | : 3", "x = 4"] },
        { h: "Quadratisch", ex: ["f(x) = x² − 3, gesucht x mit f(x) = 6", "x² − 3 = 6 | + 3", "x² = 9", "x = 3 oder x = −3"] }
      ],
      paper: ["Rechne die Beispiele im Heft nach – mit den Umformungen | + 2, | : 3 am Rand."] },
    { nr: 7, area: "Lineare, quadratische und Potenzfunktionen", title: "Ich kann den Schnittpunkt mit der y-Achse (y-Achsenabschnitt) berechnen.", short: "y-Achsenabschnitt", book: [], keys: ["ck:yint"],
      learn: [
        { h: "Immer: x = 0 einsetzen", t: "Auf der y-Achse ist x = 0. Also: **Sᵧ(0 | f(0))**.", f: "f(x) = 2x² − 3x + 5 → f(0) = 5 → Sᵧ(0 | 5)" },
        { h: "Abkürzungen", t: "**mx + b:** b · **ax² + bx + c:** c · **Achtung Scheitelform:** f(x) = 2(x − 1)² + 3 → f(0) = 2 · 1 + 3 = 5 – also NICHT einfach 3! · **Linearfaktoren:** f(x) = (x + 2)(x − 3) → f(0) = 2 · (−3) = −6" }
      ],
      paper: ["Schreibe dir die Abkürzungen als Merkkasten auf – und den Fehler-Hinweis zur Scheitelform."] },
    { nr: 8, area: "Lineare, quadratische und Potenzfunktionen", title: "Ich kann die Schnittpunkte mit der x-Achse (Nullstellen) mithilfe passender Verfahren berechnen (Ablesen aus Linearfaktorzerlegung, Äquivalenzumformung, Faktorisieren, p/q-Formel).", short: "Nullstellen (4 Verfahren)", book: ["S. 14, Nr. 9", "S. 32, Nr. 6a"], keys: ["ck:nlin", "ck:nfactor", "ck:nsq", "ck:nausk", "ck:npq"],
      learn: [
        { h: "Welches Verfahren wann?", t: "Immer: **f(x) = 0** setzen. Dann schauen, wie die Gleichung aussieht:", f: "(x − 2)(x + 5) → ABLESEN · x² − 9 → UMFORMEN · x² − 4x → AUSKLAMMERN · x² + 2x − 8 → p-q-FORMEL" },
        { h: "1 · Ablesen aus Linearfaktoren", t: "Ein Produkt ist 0, wenn **ein Faktor** 0 ist (Satz vom Nullprodukt).", ex: ["f(x) = 2(x − 3)(x + 1)", "x − 3 = 0 → x = 3   oder   x + 1 = 0 → x = −1"] },
        { h: "2 · Äquivalenzumformung (kein x-Glied)", ex: ["2x² − 18 = 0 | + 18", "2x² = 18 | : 2", "x² = 9 → x = ±3"] },
        { h: "3 · Faktorisieren / Ausklammern (keine Zahl ohne x)", ex: ["x² − 4x = 0", "x(x − 4) = 0", "x = 0 oder x = 4"] },
        { h: "4 · p-q-Formel (alles andere)", t: "Erst auf die Form **x² + px + q = 0** bringen (durch die Zahl vor x² teilen!).", f: "x = −p/2 ± √((p/2)² − q)", ex: ["x² + 2x − 8 = 0 → p = 2, q = −8", "x = −1 ± √(1 + 8) = −1 ± 3", "x₁ = −4, x₂ = 2", "Unter der Wurzel negativ → keine Nullstelle"] }
      ],
      paper: ["Schreibe die **p-q-Formel** groß auf deinen Merkzettel (die Formelsammlung wird gestellt – aber du musst sie anwenden können).", "Mach dir eine **Entscheidungs-Tabelle**: Gleichungsform → Verfahren (siehe oben) und rechne zu jedem Verfahren ein Beispiel im Heft."] },
    { nr: 9, area: "Lineare, quadratische und Potenzfunktionen", title: "Ich kann Schnittpunkte zweier linearer und/oder quadratischer Funktionsgraphen berechnen.", short: "Schnittpunkte zweier Graphen", book: ["S. 32, Nr. 6b"], keys: ["ck:splin", "ck:splq"],
      learn: [
        { h: "Gleichsetzen!", t: "Am Schnittpunkt haben beide Funktionen **denselben y-Wert**. Also **f(x) = g(x)** setzen, nach x auflösen, dann x in f (oder g) einsetzen → y.", ex: ["f(x) = 2x + 1, g(x) = −x + 7", "2x + 1 = −x + 7 | + x − 1", "3x = 6 → x = 2", "y = f(2) = 5 → S(2 | 5)"] },
        { h: "Gerade und Parabel", t: "Nach dem Gleichsetzen alles auf eine Seite bringen (= 0) → dann wie bei den Nullstellen (p-q-Formel). Es kann 0, 1 oder 2 Schnittpunkte geben.", ex: ["f(x) = x², g(x) = x + 2", "x² = x + 2 → x² − x − 2 = 0", "p-q: x = 0,5 ± √(0,25 + 2) = 0,5 ± 1,5", "x₁ = −1, x₂ = 2 → S₁(−1 | 1), S₂(2 | 4)"] }
      ],
      paper: ["Rechne beide Beispiele im Heft und **prüfe sie in GeoGebra** mit Schneide(f, g)."] },
    { nr: 10, area: "Lineare, quadratische und Potenzfunktionen", title: "Ich kann anhand des Graphen einer Funktion, gegebener Eigenschaften oder Punkte Rückschlüsse auf ihre Funktionsgleichung ziehen und andersherum.", short: "Graph ↔ Gleichung", book: ["S. 14, Nr. 8a", "S. 18, Nr. 6, 7", "S. 19, Nr. 13a", "S. 22, Nr. 4b, 8a", "S. 32, Nr. 3, 4, 5, 8", "S. 33, Nr. 11"], keys: ["ck:readlin", "ck:readpar", "ck:matchfn", "ck:lin2pts", "graph:pick", "trafo:point", "eigen:sym"],
      learn: [
        { h: "Gerade durch zwei Punkte", t: "**m = (y₂ − y₁) : (x₂ − x₁)**, dann einen Punkt einsetzen und b ausrechnen.", ex: ["A(1 | 3), B(3 | 7)", "m = (7 − 3) : (3 − 1) = 2", "3 = 2 · 1 + b → b = 1", "f(x) = 2x + 1"] },
        { h: "Parabel aus dem Graphen", t: "Scheitel S(d | e) ablesen → **f(x) = a(x − d)² + e**. Achtung beim Vorzeichen: S(2 | 1) → (x **−** 2)², S(−2 | 1) → (x **+** 2)². Nach unten offen → a negativ.", f: "a > 1: schmaler · 0 < a < 1: breiter · a < 0: nach unten offen" },
        { h: "Potenzfunktionen", t: "Gerader Exponent → achsensymmetrisch (U-Form), ungerader → punktsymmetrisch (S-Form). Negativer Exponent → Hyperbel mit Lücke bei x = 0." }
      ],
      paper: ["Zeichne 3 Parabeln mit verschiedenen Scheitelpunkten auf Karopapier und schreibe jeweils die Gleichung dazu.", "Arbeite die Probeklausur im Buch **S. 37** durch (ohne Nr. 2d und Nr. 5) – Lösungen auf **S. 231 f.**"] },
    { nr: 11, area: "GeoGebra", title: "Ich kann Funktionen und mathematische Ausdrücke in Geogebra eingeben (z. B. Potenzen, Wurzeln, Klammern, negative Vorzeichen, Brüche, …).", short: "GeoGebra: Eingabe", book: [], keys: ["ck:gg"], gg: true,
      learn: [
        { h: "Die wichtigsten Eingaben", f: "x² → x^2 · x³ → x^3 · √x → sqrt(x) · x⁻² → x^(-2) · 1/(x+1) → 1/(x+1) · 0,5 → 0.5" },
        { h: "Die 3 häufigsten Fehler", t: "**1. Bruch ohne Klammern:** 1/x+1 ist (1/x) + 1 – richtig: 1/(x+1). **2. Wurzel ohne Klammer:** sqrt(x)+3 ist √x + 3 – für √(x + 3) schreibe sqrt(x+3). **3. Negative Hochzahl ohne Klammer:** x^(-2) statt x^-2 ist sicherer." },
        { h: "Funktion benennen", t: "Schreibe **f(x) = …** – dann kannst du später f(3), Nullstelle(f) usw. benutzen. Eine zweite Funktion heißt g(x) = …" }
      ],
      paper: ["Öffne **GeoGebra auf dem iPad** (geogebra.org/graphing) und gib diese Funktionen ein: f(x) = x³ − 2x · g(x) = sqrt(x+3) · h(x) = 1/(x+1) · k(x) = −(x−2)^2+1. Vergleiche mit deiner Skizze."] },
    { nr: 12, area: "GeoGebra", title: "Ich kann mithilfe von GeoGebra Funktionsgraphen zeichnen und untersuchen (inkl. Fenstergröße, Achsenschnittpunkte, Nullstellen, Schnittpunkte, Scheitelpunkte, …).", short: "GeoGebra: Untersuchen", book: [], keys: ["ck:ggcmd"], gg: true,
      learn: [
        { h: "Befehle (in die Eingabezeile tippen)", f: "Nullstelle(f) · Schneide(f, g) · Extremum(f) · f(3) · Schneide(f, y-Achse)", t: "Englisch heißen sie Root(f), Intersect(f, g), Extremum(f). Das Ergebnis erscheint als Punkt – tippe ihn an, um die Koordinaten zu sehen." },
        { h: "Fenstergröße einstellen", t: "Zahnrad / Grafik-Einstellungen → **x min, x max, y min, y max** eintragen. Oder mit zwei Fingern zoomen. In der Klausur: das Fenster so wählen, dass alle wichtigen Punkte sichtbar sind." },
        { h: "Wertetabelle", t: "Im Menü **Tabelle** öffnen → Funktion auswählen → Start, Ende und Schrittweite eingeben." },
        { h: "In der Klausur aufschreiben", t: "Bei „bestimme mit GeoGebra“: **Befehl + Ergebnis** notieren, z. B. „Nullstelle(f) liefert N₁(−1 | 0) und N₂(3 | 0).“" }
      ],
      paper: ["Probiere in GeoGebra aus und prüfe die Ergebnisse: f(x) = x² − 4x + 3 → Nullstelle(f) gibt (1 | 0) und (3 | 0) · Extremum(f) gibt (2 | −1) · mit g(x) = x − 1: Schneide(f, g) gibt (1 | 0) und (4 | 3).", "Stell das Fenster auf x von −2 bis 6 und y von −2 bis 5 und mach einen Screenshot fürs Heft."] },
    { nr: 13, area: "Allgemeines", title: "Ich kann in Sachaufgaben die Kompetenzen 1 bis 12 angemessen anwenden und auch mit Basiskompetenzen aus der Sekundarstufe I (z. B. Prozentrechnung) verknüpfen.", short: "Sachaufgaben", book: ["S. 15, Nr. 15", "S. 34, Nr. 18", "S. 36, Nr. 21, 22"], keys: ["ck:sach"],
      learn: [
        { h: "Das 5-Schritte-Schema", t: "**1. Gegeben** (Zahlen mit Einheit) · **2. Gesucht** · **3. Ansatz** (Funktion aufstellen) · **4. Rechnung** · **5. Antwortsatz** (mit Einheit!)" },
        { h: "Welche Funktion?", t: "**Fester Betrag + Betrag pro Einheit** → linear: K(x) = m·x + b (Grundgebühr = b). **Wurf, Brücke, Bogen** → Parabel: höchster Punkt = Scheitel, Boden = Nullstellen. **Prozent:** neuer Wert = alter Wert · (1 ± p/100)." },
        { h: "Was bedeutet …?", t: "Nullstelle = „wann ist es 0 / leer / am Boden?“ · y-Achsenabschnitt = „Startwert bei t = 0“ · Schnittpunkt = „wann sind beide gleich?“ · Scheitel = „wann am höchsten?“" }
      ],
      paper: ["Löse eine Sachaufgabe aus dem Buch **komplett nach dem 5-Schritte-Schema** – mit Antwortsatz. Genau das wird in der Klausur bewertet."] },
    { nr: 14, area: "Allgemeines", title: "Ich kenne die wichtigsten Operatoren und verstehe, was von mir jeweils gefordert wird.", short: "Operatoren", book: ["Operatorenliste"], keys: ["ck:op"],
      learn: [
        { h: "Die wichtigsten Operatoren", t: OPS.map(o => "**" + o[0] + "**: " + o[1]).join(" · ") },
        { h: "Der Unterschied, der Punkte kostet", t: "**Skizzieren** = grob, aber wichtige Punkte stimmen. **Zeichnen** = genau, mit Geodreieck. **Berechnen** = Rechenweg muss da stehen. **Angeben** = nur das Ergebnis." }
      ],
      paper: ["Markiere in der Probeklausur (S. 37) jeden Operator farbig und schreibe daneben, was du tun musst."] },
    { nr: "X", area: "Mitbringen", title: "Ich besitze Klausurbögen, ein geladenes iPad, Geodreieck, Bleistift und Radiergummi und bringe das alles auch zur Klausur mit. (Formelsammlung wird gestellt.)", short: "Material", book: [], keys: [], pack: ["Klausurbögen", "iPad – geladen!", "Geodreieck", "Bleistift", "Radiergummi"],
      learn: [{ h: "Am Abend vorher", t: "iPad laden, GeoGebra einmal öffnen (funktioniert es?), Federmappe packen. Die Formelsammlung bekommst du in der Klausur." }], paper: [] }
  ];
  const EXAM_CK = [["ck:isfn", "ck:dwquad"], ["ck:table", "ck:readlin", "ck:tab2eq"], ["ck:probe2"], ["ck:fval2", "ck:xquad", "ck:xlin"], ["ck:yint"], ["ck:npq", "ck:nfactor", "ck:nausk", "ck:nsq"], ["ck:splin", "ck:splq"], ["ck:readpar", "ck:lin2pts", "ck:matchfn"], ["ck:sach"], ["eigen:sym", "eigen:w"]];
  const item = nr => ITEMS.find(i => String(i.nr) === String(nr));
  return { ITEMS, EXAM_CK, TERMS, OPS, GG_IN, item, poly, lin, quad, vertex, factored };
});
