/* =====================================================================
   LERN-COCKPIT · PHYSIK EF · KINEMATIK (Klausur Nr. 1, HUBA, 26/27)
   Aufgaben-Generatoren „ph:*“ (Zahl eintippen, Rechenweg auf Papier) für
   den Mathe-Kurs-Motor (MK) + Checkliste der Lehrkraft (TaskCards-Board
   „beschleunigte Bewegung“) mit Erklärungen, Heft-Aufgaben, Lernplan bis
   zur Klausur und Lösungen der Probeklausur.
   Getestet in tests/engine.test.js.
   ===================================================================== */
(function (root, factory) {
  const P = factory(typeof module === "object" && module.exports ? require("./mathekurs.js") : root.MK);
  if (typeof module === "object" && module.exports) module.exports = P;
  else root.PHYS = P;
})(typeof self !== "undefined" ? self : this, function (MK) {
  const fmt = MK.fmt;
  const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
  const int = (lo, hi, r) => lo + Math.floor(r() * (hi - lo + 1));
  const T = o => Object.assign({ kind: "num", steps: [] }, o);
  const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
  const ms = kmh => kmh / 3.6;

  const G = {
    /* 1 · Grundlagen */
    "ph:kmh2ms": (r, l) => { const v = pick(l ? [18, 30, 36, 50, 54, 72, 90, 100, 120] : [18, 36, 54, 72, 90], r);
      return T({ prompt: v + " km/h = ? m/s", ask: "m/s (auf 2 Stellen runden, wenn nötig)", answer: r2(ms(v)), rule: "km/h → m/s: durch 3,6 teilen (1 m/s = 3,6 km/h)", steps: [v + " km/h : 3,6 = " + fmt(r2(ms(v))) + " m/s"] }); },
    "ph:ms2kmh": (r, l) => { const v = pick(l ? [5, 8, 10, 12.5, 15, 20, 25, 30] : [5, 10, 15, 20], r);
      return T({ prompt: fmt(v) + " m/s = ? km/h", ask: "km/h", answer: r1(v * 3.6), rule: "m/s → km/h: mal 3,6", steps: [fmt(v) + " m/s · 3,6 = " + fmt(r1(v * 3.6)) + " km/h"] }); },
    "ph:groessen": (r) => { const L = [["Geschwindigkeit", "v", "m/s"], ["Beschleunigung", "a", "m/s²"], ["Zeit", "t", "s"], ["Ort (Weg)", "s", "m"]]; const i = int(0, 3, r);
      const opts = ["m/s", "m/s²", "s", "m"]; return T({ kind: "chip", prompt: "Welche Einheit hat die " + L[i][0] + " (" + L[i][1] + ")?", opts, answer: opts.indexOf(L[i][2]), rule: "v in m/s · a in m/s² („pro Sekunde schneller“) · t in s · s in m", steps: [L[i][0] + ": " + L[i][1] + " in " + L[i][2]] }); },
    "ph:durch": (r, l) => { const a = pick([1, 2, 2.5, 3, 4], r), t = int(2, 6, r), s = 0.5 * a * t * t; const mom = r() < 0.5;
      return mom ? T({ prompt: "Ein Auto fährt aus dem Stand los mit a = " + fmt(a) + " m/s². Momentangeschwindigkeit nach " + t + " s?", ask: "m/s", answer: a * t, rule: "Momentan: v(t) = a · t (+ v₀) – der Tachowert in diesem Moment", steps: ["v = a · t = " + fmt(a) + " · " + t + " = " + fmt(a * t) + " m/s"] })
        : T({ prompt: "Ein Auto fährt aus dem Stand in " + t + " s eine Strecke von " + fmt(s) + " m. Durchschnittsgeschwindigkeit?", ask: "m/s", answer: r2(s / t), rule: "Durchschnitt: v̄ = Δs : Δt (ganze Strecke durch ganze Zeit)", steps: ["v̄ = " + fmt(s) + " m : " + t + " s = " + fmt(r2(s / t)) + " m/s", "Momentan am Ende wäre es doppelt so viel: " + fmt(a * t) + " m/s (aus dem Stand: v̄ = v_Ende / 2)"] }); },
    /* 2 · Gleichförmige Bewegung */
    "ph:gf_s": (r, l) => { const v = pick([2, 5, 8, 10, 15, 20], r), t = int(3, 20, r), s0 = l ? pick([0, 10, 25, 50], r) : 0;
      return T({ prompt: "Gleichförmige Bewegung: v = " + v + " m/s, s₀ = " + s0 + " m. Wo ist der Körper nach t = " + t + " s?", ask: "s in m", answer: v * t + s0, rule: "s(t) = v · t + s₀", steps: ["s = " + v + " · " + t + " + " + s0 + " = " + fmt(v * t + s0) + " m"] }); },
    "ph:gf_t": (r) => { const vk = pick([36, 54, 72, 90, 108], r), d = pick([300, 600, 900, 1200, 1500], r), v = ms(vk), t = d / v;
      return T({ prompt: "Ein Zug fährt gleichförmig mit " + vk + " km/h. Wie lange braucht er für " + d + " m?", ask: "t in s", answer: r1(t), rule: "Erst in m/s umrechnen, dann t = s : v", steps: [vk + " km/h = " + fmt(r2(v)) + " m/s", "t = " + d + " m : " + fmt(r2(v)) + " m/s = " + fmt(r1(t)) + " s"] }); },
    "ph:gf_v": (r) => { const t1 = int(1, 3, r), dt = int(2, 5, r), v = pick([2, 3, 4, 5, 6], r), s1 = int(0, 10, r) + v * t1, s2 = s1 + v * dt;
      return T({ kind: "num", table: { x: [t1, t1 + dt], y: [s1, s2] }, prompt: "Zwei Punkte eines s-t-Diagramms (x = t in s, y = s in m). Wie groß ist v (Steigung)?", ask: "v in m/s", answer: v, rule: "Steigung im s-t-Diagramm = Geschwindigkeit: v = Δs : Δt", steps: ["v = (" + s2 + " − " + s1 + ") m : (" + (t1 + dt) + " − " + t1 + ") s = " + fmt(v) + " m/s"] }); },
    /* 3 · Gleichmäßig beschleunigte Bewegung */
    "ph:bes_v": (r, l) => { const a = pick([1.5, 2, 2.5, 3, 4], r), t = int(2, 8, r), v0 = l ? pick([0, 2, 5, 10], r) : 0;
      return T({ prompt: "a = " + fmt(a) + " m/s², v₀ = " + v0 + " m/s. Geschwindigkeit nach " + t + " s?", ask: "v in m/s", answer: a * t + v0, rule: "v(t) = a · t + v₀", steps: ["v = " + fmt(a) + " · " + t + " + " + v0 + " = " + fmt(a * t + v0) + " m/s"] }); },
    "ph:bes_s": (r, l) => { const a = pick([1, 2, 2.5, 3, 4], r), t = int(2, 8, r), v0 = l ? pick([0, 2, 5], r) : 0, s = 0.5 * a * t * t + v0 * t;
      return T({ prompt: "a = " + fmt(a) + " m/s², v₀ = " + v0 + " m/s, s₀ = 0. Strecke nach " + t + " s?", ask: "s in m", answer: s, rule: "s(t) = ½ · a · t² + v₀ · t + s₀", steps: ["s = ½ · " + fmt(a) + " · " + t + "² + " + v0 + " · " + t, "= " + fmt(0.5 * a * t * t) + " + " + fmt(v0 * t) + " = " + fmt(s) + " m"] }); },
    "ph:bes_a": (r) => { const v0 = pick([0, 0, 5, 10], r), a = pick([1.5, 2, 2.5, 3, 4, 5], r), t = int(2, 8, r), v = v0 + a * t;
      return T({ prompt: "Im v-t-Diagramm steigt v gleichmäßig von " + v0 + " m/s auf " + fmt(v) + " m/s in " + t + " s. Beschleunigung?", ask: "a in m/s²", answer: a, rule: "Steigung im v-t-Diagramm = Beschleunigung: a = Δv : Δt", steps: ["a = (" + fmt(v) + " − " + v0 + ") m/s : " + t + " s = " + fmt(a) + " m/s²"] }); },
    "ph:umst_t": (r) => { const a = pick([2, 2.5, 4, 5, 8], r), t = int(2, 8, r), s = 0.5 * a * t * t;
      return T({ prompt: "Ein Körper startet aus der Ruhe mit a = " + fmt(a) + " m/s². Nach welcher Zeit hat er " + fmt(s) + " m zurückgelegt?", ask: "t in s", answer: t, rule: "s = ½ a t² nach t umstellen: t = √(2s : a)", steps: ["s = ½ a t² → t² = 2s : a = " + fmt(2 * s) + " : " + fmt(a) + " = " + fmt(t * t), "t = √" + fmt(t * t) + " = " + t + " s"] }); },
    "ph:umst_a": (r) => { const a = pick([1, 2, 2.5, 3, 4, 5], r), t = int(2, 6, r), s = 0.5 * a * t * t;
      return T({ prompt: "Aus der Ruhe: in " + t + " s werden " + fmt(s) + " m zurückgelegt. Beschleunigung?", ask: "a in m/s²", answer: a, rule: "s = ½ a t² → a = 2s : t²", steps: ["a = 2 · " + fmt(s) + " : " + t + "² = " + fmt(2 * s) + " : " + (t * t) + " = " + fmt(a) + " m/s²"] }); },
    "ph:flaeche": (r) => { const v = pick([4, 6, 8, 10, 12], r), t1 = int(2, 5, r), t2 = int(2, 6, r), s = 0.5 * v * t1 + v * t2;
      return T({ prompt: "v-t-Diagramm: aus dem Stand in " + t1 + " s gleichmäßig auf " + v + " m/s, danach " + t2 + " s konstant. Gesamtstrecke?", ask: "s in m", answer: s, rule: "Strecke = Fläche unter dem v-t-Graphen: Dreieck ½·v·t + Rechteck v·t", steps: ["Dreieck: ½ · " + v + " · " + t1 + " = " + fmt(0.5 * v * t1) + " m", "Rechteck: " + v + " · " + t2 + " = " + (v * t2) + " m", "Summe: " + fmt(s) + " m"] }); },
    "ph:diagramm": (r) => { const Q = [
        ["Gleichförmige Bewegung (v > 0): Wie sieht der s-t-Graph aus?", ["steigende Gerade", "waagerechte Gerade", "nach oben geöffnete Parabel (Ast)", "fallende Gerade"], 0, "s wächst in gleichen Zeiten um gleich viel → Gerade, Steigung = v"],
        ["Gleichförmige Bewegung: Wie sieht der v-t-Graph aus?", ["waagerechte Gerade", "steigende Gerade", "Parabel", "Ursprungsgerade nach unten"], 0, "v ist konstant → waagerechte Linie"],
        ["Gleichmäßig beschleunigt aus dem Stand: s-t-Graph?", ["Parabelast (immer steiler)", "steigende Gerade", "waagerechte Gerade", "fallende Gerade"], 0, "s = ½ a t² → quadratisch → Parabelast"],
        ["Gleichmäßig beschleunigt: v-t-Graph?", ["steigende Gerade", "waagerechte Gerade", "Parabel", "Hyperbel"], 0, "v = a t + v₀ → Gerade mit Steigung a"],
        ["Gleichmäßig beschleunigt: a-t-Graph?", ["waagerechte Gerade (a konstant)", "steigende Gerade", "Parabel", "fallende Gerade"], 0, "a ist konstant → waagerecht"],
        ["Was ist die Steigung im v-t-Diagramm?", ["die Beschleunigung a", "der Ort s", "die Zeit t", "die Geschwindigkeit v"], 0, "a = Δv : Δt"],
        ["Was ist die Fläche unter dem v-t-Graphen?", ["die zurückgelegte Strecke s", "die Beschleunigung", "die Endgeschwindigkeit", "die Zeit"], 0, "Fläche = v · t = Strecke"],
        ["Wodurch unterscheidet sich die gleichmäßig beschleunigte von der gleichförmigen Bewegung?", ["v ändert sich gleichmäßig, a ist konstant und ≠ 0", "v ist konstant, a = 0", "s ist konstant", "a wächst mit der Zeit"], 0, "gleichförmig: v konstant (a = 0) · beschleunigt: a konstant, v wächst linear"]];
      const [q, o, a, why] = pick(Q, r); const sh = o.map((x, i) => [r(), x, i]).sort((p, q2) => p[0] - q2[0]);
      return T({ kind: "chip", prompt: q, opts: sh.map(x => x[1]), answer: sh.findIndex(x => x[2] === a), rule: "s-t: gleichförmig Gerade, beschleunigt Parabel · v-t: Steigung = a, Fläche = s", steps: [why] }); },
    /* 4 · Anwendungen */
    "ph:anhalt": (r, l) => { const vk = pick([30, 50, 70, 100], r), tr = pick(l ? [0.8, 1, 1.5, 2] : [1], r), a = pick(l ? [4, 5, 6, 8] : [6, 8], r), v = ms(vk), sr = v * tr, sb = v * v / (2 * a), s = sr + sb;
      const what = pick(["R", "B", "A"], r);
      const ans = { R: r1(sr), B: r1(sb), A: r1(s) }[what];
      return T({ prompt: vk + " km/h, Reaktionszeit " + fmt(tr) + " s, Bremsverzögerung " + a + " m/s². " + { R: "Reaktionsweg?", B: "Bremsweg?", A: "Anhalteweg?" }[what], ask: "in m (1 Stelle)", answer: ans, rule: "Reaktionsweg s_R = v · t_R · Bremsweg s_B = v² : (2a) · Anhalteweg = s_R + s_B (v in m/s!)", steps: [vk + " km/h = " + fmt(r2(v)) + " m/s", "s_R = " + fmt(r2(v)) + " · " + fmt(tr) + " = " + fmt(r1(sr)) + " m", "s_B = " + fmt(r2(v)) + "² : (2 · " + a + ") = " + fmt(r1(sb)) + " m", "Anhalteweg = " + fmt(r1(s)) + " m"] }); },
    "ph:begegnung": (r) => { const va = pick([36, 54, 72], r), vb = pick([18, 36, 54], r), d = pick([1000, 2000, 3000, 5000], r), t = d / (ms(va) + ms(vb));
      return T({ prompt: "A und B starten gleichzeitig " + fmt(d / 1000) + " km voneinander entfernt und fahren aufeinander zu: A mit " + va + " km/h, B mit " + vb + " km/h. Nach welcher Zeit treffen sie sich?", ask: "t in s", answer: r1(t), rule: "s_A = v_A · t, s_B = d − v_B · t, gleichsetzen → t = d : (v_A + v_B)", steps: ["v_A = " + fmt(r2(ms(va))) + " m/s, v_B = " + fmt(r2(ms(vb))) + " m/s", "v_A · t = " + d + " − v_B · t → t = " + d + " : " + fmt(r2(ms(va) + ms(vb))) + " = " + fmt(r1(t)) + " s", "Ort: s = v_A · t = " + fmt(r1(ms(va) * t)) + " m von A"] }); },
    "ph:einholen": (r) => { const v1 = pick([10, 15, 18, 20], r), v2 = v1 + pick([5, 9, 10], r), dt = pick([60, 120, 30], r), t = v2 * dt / (v2 - v1);
      return T({ prompt: "Franz fährt mit " + v1 + " km/h los, Theo folgt " + dt + " s später mit " + v2 + " km/h auf demselben Weg. Wie viele Sekunden nach Franz' Start holt Theo ihn ein?", ask: "t in s", answer: r1(t), rule: "s_F = v₁ · t, s_T = v₂ · (t − Δt), gleichsetzen", steps: ["v₁ · t = v₂ · (t − " + dt + ") → t = v₂ · " + dt + " : (v₂ − v₁)", "t = " + v2 + " · " + dt + " : " + (v2 - v1) + " = " + fmt(r1(t)) + " s (km/h kürzt sich hier heraus)", "Ort: s = " + fmt(r2(ms(v1))) + " m/s · " + fmt(r1(t)) + " s = " + fmt(r1(ms(v1) * t)) + " m"] }); },
    "ph:ampel": (r) => { const a = pick([2, 2.5, 3, 4], r), vk = pick([36, 54, 72], r), v = ms(vk), t = 2 * v / a;
      return T({ prompt: "Ein Auto fährt an der Ampel aus dem Stand mit a = " + fmt(a) + " m/s² los. Gleichzeitig fährt ein Moped mit konstant " + vk + " km/h vorbei. Wann holt das Auto das Moped ein?", ask: "t in s", answer: r1(t), rule: "Auto: s = ½ a t², Moped: s = v · t, gleichsetzen → t = 2v : a", steps: [vk + " km/h = " + fmt(r2(v)) + " m/s", "½ · " + fmt(a) + " · t² = " + fmt(r2(v)) + " · t → t = 2 · " + fmt(r2(v)) + " : " + fmt(a) + " = " + fmt(r1(t)) + " s", "Ort: s = " + fmt(r2(v)) + " · " + fmt(r1(t)) + " = " + fmt(r1(v * t)) + " m"] }); },
    "ph:rest": (r) => { const vk = pick([50, 60, 70], r), d = pick([25, 30, 35], r), a = pick([6, 7, 8], r), v = ms(vk), sr = v, rest = Math.max(0, v * v - 2 * a * (d - sr));
      return T({ prompt: vk + " km/h, Reaktionszeit 1 s, Bremsen mit " + a + " m/s². Ein Hindernis ist " + d + " m entfernt. Mit welcher Geschwindigkeit (km/h) erreicht das Auto das Hindernis? (0, wenn es vorher steht)", ask: "v in km/h (1 Stelle)", answer: r1(Math.sqrt(rest) * 3.6), rule: "Nach dem Reaktionsweg bleibt d − s_R zum Bremsen: v² = v₀² − 2·a·s", steps: ["s_R = " + fmt(r2(v)) + " m", "Bremsstrecke bis zum Hindernis: " + d + " − " + fmt(r2(v)) + " = " + fmt(r2(d - v)) + " m", "v² = " + fmt(r1(v * v)) + " − 2 · " + a + " · " + fmt(r2(d - v)) + (rest > 0 ? " = " + fmt(r1(rest)) : " < 0"), rest > 0 ? "v = " + fmt(r2(Math.sqrt(rest))) + " m/s = " + fmt(r1(Math.sqrt(rest) * 3.6)) + " km/h" : "→ negativ: das Auto steht vor dem Hindernis (Antwort 0)"] }); },
    /* 5 · Experimente auswerten */
    "ph:quot": (r) => { const a = pick([0.4, 0.5, 0.8, 1, 1.2, 2.5], r), ts = [1, 2, 3, 4], ss = ts.map(t => r2(0.5 * a * t * t * (1 + (r() - 0.5) * 0.04)));
      return T({ table: { x: ts, y: ss }, prompt: "Messwerte einer Kugel auf der geneigten Ebene (x = t in s, y = s in m). Zeige s ~ t² und bestimme a.", ask: "a in m/s² (1–2 Stellen)", answer: a, rule: "Quotient s : t² ist (fast) konstant → s ~ t². Dann a = 2 · (s : t²)", steps: ["s : t² = " + ts.map((t, i) => fmt(r2(ss[i] / (t * t)))).join(" · ") + " ≈ " + fmt(a / 2), "a = 2 · " + fmt(a / 2) + " = " + fmt(a) + " m/s²"], tol: 0.06 }); },
    "ph:fehler": (r) => { const Q = [
        ["Warum misst man beim Handstoppen mit einer Unsicherheit (z. B. ± 0,2 s)?", ["Reaktionszeit beim Starten und Stoppen", "Die Uhr geht falsch", "Die Strecke ändert sich", "Wegen der Schwerkraft"], 0],
        ["Wie weist man s ~ t² rechnerisch nach?", ["Quotient s : t² ist konstant", "Quotient s : t ist konstant", "Produkt s · t ist konstant", "s und t sind gleich groß"], 0],
        ["Wie weist man s ~ t² grafisch nach (Linearisierung)?", ["s über t² auftragen → Ursprungsgerade", "s über t auftragen → Gerade", "t über s auftragen → Parabel", "Fläche unter s-t bestimmen"], 0],
        ["Was zeichnet man durch Messpunkte, die etwas streuen?", ["eine Ausgleichsgerade/-kurve", "eine Zickzack-Linie durch alle Punkte", "nur den ersten und letzten Punkt", "gar nichts"], 0],
        ["Was ist eine typische systematische Fehlerquelle bei der Fahrbahn?", ["Reibung", "zufälliges Ablesen", "Tippfehler", "Die Einheit"], 0]];
      const [q, o, a] = pick(Q, r); const sh = o.map((x, i) => [r(), x, i]).sort((p, q2) => p[0] - q2[0]);
      return T({ kind: "chip", prompt: q, opts: sh.map(x => x[1]), answer: sh.findIndex(x => x[2] === a), rule: "Quotientengleichheit · Linearisierung · Ausgleichsgerade · Reaktionszeit/Reibung als Fehlerquellen", steps: [o[a]] }); },
    /* 6 · Operatoren Physik */
    "ph:op": (r) => { const O = [["nennen", "ohne Erklärung aufzählen"], ["beschreiben", "in eigenen Worten sagen, was passiert – ohne Begründung"], ["erklären", "mit physikalischen Gesetzen begründen, warum etwas so ist"], ["berechnen", "Gegeben – Gesucht – Formel – Rechnung mit Einheiten – Ergebnis"], ["begründen", "eine Aussage mit Argumenten/Rechnung stützen"], ["skizzieren", "grob zeichnen, wichtige Merkmale erkennbar (Achsen beschriftet)"]];
      const i = int(0, O.length - 1, r); const others = O.filter((_, k) => k !== i).sort(() => r() - 0.5).slice(0, 3); const opts = [O[i], ...others].sort(() => r() - 0.5);
      return T({ kind: "chip", prompt: "Operator „" + O[i][0] + "“ – was musst du tun?", opts: opts.map(x => x[1]), answer: opts.indexOf(O[i]), rule: "Berechnen = immer mit Gegeben/Gesucht/Lösung und Einheit", steps: [O[i][0] + ": " + O[i][1]] }); }
  };
  Object.assign(MK.GEN, G);
  // Toleranz für Messaufgaben (Streuung): eigene Prüfung über tol
  const baseCheck = MK.check;
  MK.check = (task, given) => task.tol && task.kind === "num" ? Math.abs(MK.parseNum(given) - task.answer) <= task.tol * Math.max(1, Math.abs(task.answer)) || baseCheck(task, given) : baseCheck(task, given);

  /* ---------- Checkliste der Lehrkraft (TaskCards, „Übung für die Klausur“) ---------- */
  const B = (h, t, f, ex) => ({ h, t: t || "", f: f || "", ex: ex || [] });
  const ITEMS = [
    { nr: "1", area: "1. Grundlagen", short: "Größen & Einheiten", title: "Ich kann Ort, Weg, Zeit, Geschwindigkeit und Beschleunigung mit Formelzeichen und Einheit angeben.", keys: ["ph:groessen"], book: [],
      learn: [B("Die 5 Größen", "Ort/Weg **s** in m · Zeit **t** in s · Geschwindigkeit **v** in m/s · Beschleunigung **a** in m/s² (pro Sekunde um so viel m/s schneller).", "v = Δs : Δt   ·   a = Δv : Δt")],
      paper: ["Leg einen **Formelzettel** an: Größe – Zeichen – Einheit – Formel. Den nimmst du bis Montag überallhin mit."] },
    { nr: "2", area: "1. Grundlagen", short: "km/h ↔ m/s", title: "Ich kann Einheiten umrechnen (z. B. km/h ↔ m/s).", keys: ["ph:kmh2ms", "ph:ms2kmh"], book: [],
      learn: [B("Faktor 3,6", "1 m/s = 3,6 km/h, weil 1 km = 1000 m und 1 h = 3600 s.", "km/h : 3,6 = m/s   ·   m/s · 3,6 = km/h", ["50 km/h : 3,6 = 13,9 m/s", "10 m/s · 3,6 = 36 km/h"]), B("Wichtig", "In alle Formeln **immer m/s** einsetzen – erst am Ende wieder in km/h umrechnen, wenn gefragt.")],
      paper: ["Merke dir: 36 km/h = 10 m/s, 72 km/h = 20 m/s, 50 km/h ≈ 13,9 m/s, 30 km/h ≈ 8,3 m/s."] },
    { nr: "3", area: "1. Grundlagen", short: "Durchschnitt vs. Momentan", title: "Ich kann Durchschnitts- und Momentangeschwindigkeit unterscheiden.", keys: ["ph:durch"], book: [],
      learn: [B("Unterschied", "**Durchschnitt** v̄ = ganze Strecke : ganze Zeit. **Momentan** = Tachowert in genau einem Moment (bei beschleunigter Bewegung v = a·t + v₀).", "Aus dem Stand gleichmäßig beschleunigt: v̄ = v_Ende : 2", ["Auto: 20,1 m in 4 s → v̄ = 5,0 m/s = 18 km/h", "a = 2,5 m/s² → nach 4 s: v = 10 m/s = 36 km/h", "Unterschied, weil das Auto immer schneller wird"])],
      paper: ["TaskCards „2 – Momentan vs. Durchschnitt“: **Übungsaufgaben** bearbeiten."] },
    { nr: "4", area: "2. Gleichförmige Bewegung", short: "s(t) = v·t + s₀", title: "Ich kann die Merkmale beschreiben und s(t) = v · t + s₀ anwenden.", keys: ["ph:gf_s", "ph:gf_t"], book: ["Metzler S. 5–6"],
      learn: [B("Merkmale", "Geschwindigkeit **konstant**, Beschleunigung a = 0, in gleichen Zeiten gleiche Wege.", "s(t) = v · t + s₀", ["v = 15 m/s, s₀ = 20 m, t = 4 s", "s = 15 · 4 + 20 = 80 m"])],
      paper: ["Rechne jede Aufgabe mit **Gegeben – Gesucht – Formel – Rechnung – Ergebnis mit Einheit**."] },
    { nr: "5", area: "2. Gleichförmige Bewegung", short: "s-t / v-t gleichförmig", title: "Ich kann s-t- und v-t-Diagramme zeichnen und deuten (Steigung im s-t-Diagramm = v).", keys: ["ph:gf_v", "ph:diagramm"], book: [],
      learn: [B("Diagramme", "s-t: **Gerade**, je steiler, desto schneller (Steigung = v). v-t: **waagerechte** Linie. Startet der Graph nicht bei 0, ist das s₀.", "v = Δs : Δt (Steigungsdreieck)")],
      paper: ["Zeichne für v = 5 m/s und v = 10 m/s die s-t-Graphen in **ein** Diagramm (Karopapier, Achsen beschriften!)."] },
    { nr: "6", area: "3. Gleichmäßig beschleunigte Bewegung", short: "Merkmale beschleunigt", title: "Ich kann die Merkmale beschreiben und von der gleichförmigen Bewegung abgrenzen.", keys: ["ph:diagramm"], book: [],
      learn: [B("Abgrenzung", "Gleichförmig: v konstant, a = 0. **Gleichmäßig beschleunigt: a konstant (≠ 0), v wächst gleichmäßig**, die Wege pro Sekunde werden immer größer.")],
      paper: ["Lege eine **Vergleichstabelle** an: Bewegungsart | a | v | s(t) | s-t | v-t | a-t (TaskCards: AB „Vergleich linearer Bewegungsarten“)."] },
    { nr: "7", area: "3. Gleichmäßig beschleunigte Bewegung", short: "Bewegungsgesetze", title: "Ich kann die Bewegungsgesetze s(t) = ½ a t² + v₀ t + s₀ und v(t) = a t + v₀ anwenden.", keys: ["ph:bes_v", "ph:bes_s"], book: [],
      learn: [B("Die zwei Gesetze", "", "s(t) = ½ · a · t² + v₀ · t + s₀   ·   v(t) = a · t + v₀", ["a = 2 m/s², aus dem Stand, t = 5 s", "v = 2 · 5 = 10 m/s", "s = ½ · 2 · 5² = 25 m"])],
      paper: ["TaskCards „5 – lineare Bewegungsarten“: AB **allgemeine Bewegungsgleichung**."] },
    { nr: "8", area: "3. Gleichmäßig beschleunigte Bewegung", short: "Formeln umstellen", title: "Ich kann Formeln nach der gesuchten Größe umstellen (z. B. nach t oder a).", keys: ["ph:umst_t", "ph:umst_a"], book: [],
      learn: [B("Die wichtigsten Umstellungen", "", "t = √(2s : a)   ·   a = 2s : t²   ·   t = v : a   ·   a = v : t", ["s = 50 m, a = 4 m/s² → t = √(100 : 4) = √25 = 5 s"])],
      paper: ["Schreib die Umstellungen auf deinen Formelzettel."] },
    { nr: "9", area: "3. Gleichmäßig beschleunigte Bewegung", short: "Steigung & Fläche im v-t", title: "Ich kann a aus der Steigung im v-t-Diagramm und s als Fläche unter dem v-t-Graphen bestimmen.", keys: ["ph:bes_a", "ph:flaeche"], book: [],
      learn: [B("Steigung und Fläche", "**Steigung** im v-t-Diagramm = a. **Fläche** unter dem v-t-Graphen = Strecke s (Dreieck ½·v·t, Rechteck v·t, Trapez).", "a = Δv : Δt   ·   s = Fläche", ["Bus: 0 → 10 m/s in 5 s → a = 2 m/s²", "dann 10 s konstant: Fläche = ½·10·5 + 10·10 = 125 m"])],
      paper: ["Probeklausur Aufgabe 1b üben: Bewegung in Abschnitte teilen, je Abschnitt a und Fläche bestimmen."] },
    { nr: "10", area: "3. Gleichmäßig beschleunigte Bewegung", short: "Diagramme zuordnen", title: "Ich kann s-t-, v-t- und a-t-Diagramme einander zuordnen und zeichnen.", keys: ["ph:diagramm"], book: [],
      learn: [B("Zuordnung", "Gleichförmig: s-t Gerade · v-t waagerecht · a-t auf der Achse (0). Beschleunigt: s-t **Parabelast** · v-t **steigende Gerade** · a-t **waagerecht über 0**.")],
      paper: ["TaskCards „4 – Diagramme“: **Aufgaben Diagramme** + Spiel „kinematics-lab“ (universeandmore.com)."] },
    { nr: "11", area: "4. Anwendungen", short: "Anhalteweg", title: "Ich kann Reaktions-, Brems- und Anhalteweg berechnen.", keys: ["ph:anhalt", "ph:rest"], book: [],
      learn: [B("Formeln", "Erst **v in m/s** umrechnen!", "s_R = v · t_R   ·   s_B = v² : (2a)   ·   s_A = s_R + s_B", ["50 km/h = 13,9 m/s, t_R = 1 s, a = 6 m/s²", "s_R = 13,9 m, s_B = 13,9² : 12 = 16,1 m", "Anhalteweg ≈ 30 m"]), B("Faustformeln der Fahrschule", "Reaktionsweg (v/10)·3, Bremsweg (v/10)², Gefahrbremsung (v/10)²/2 – v in km/h, Ergebnis in m.")],
      paper: ["TaskCards: **AB Anhalteweg** (mit Lösungen zum Vergleichen) + Karte **Faustformeln der Fahrschule** a)–c)."] },
    { nr: "12", area: "4. Anwendungen", short: "Überholen & Begegnen", title: "Ich kann Überhol- und Begegnungsaufgaben lösen (Gleichungen gleichsetzen oder Schnittpunkt im Diagramm).", keys: ["ph:begegnung", "ph:einholen", "ph:ampel"], book: [],
      learn: [B("Vorgehen", "Für jedes Fahrzeug ein **Zeit-Ort-Gesetz** aufstellen (gleicher Nullpunkt!), dann **gleichsetzen** und nach t auflösen, t einsetzen → Ort.", "Begegnen: v_A·t = d − v_B·t   ·   Einholen: v₁·t = v₂·(t − Δt)"), B("Beschleunigt gegen konstant", "", "½ a t² = v · t → t = 2v : a", ["Auto a = 2,5 m/s², Moped 10 m/s", "1,25 t² = 10 t → t = 8 s, Ort 80 m"])],
      paper: ["TaskCards „gleichförmige Bewegung“ → **Aufgaben a) Bauer A/B und b) Franz/Theo**: je Diagramm + Gleichungen."] },
    { nr: "13", area: "4. Anwendungen", short: "Geneigte Ebene", title: "Ich kann Bewegungen auf der geneigten Ebene auswerten (s ~ t²).", keys: ["ph:quot"], book: [],
      learn: [B("s ~ t²", "Auf der geneigten Ebene rollt eine Kugel gleichmäßig beschleunigt. Nachweis: **s : t² konstant**. Daraus a = 2 · (s : t²).")],
      paper: ["TaskCards „1 – Beziehung zwischen s und t“: **Arbeitsblatt** (+ Tippkasten 3a/3b)."] },
    { nr: "14", area: "5. Experimente auswerten", short: "Tabelle & Ausgleichsgerade", title: "Ich kann Messwerte in Tabelle und Diagramm darstellen und eine Ausgleichsgerade einzeichnen.", keys: ["ph:fehler"], book: [],
      learn: [B("Ausgleichsgerade", "Nicht von Punkt zu Punkt verbinden! Eine Gerade so legen, dass etwa gleich viele Punkte darüber und darunter liegen (bei Proportionalität durch den Ursprung).")],
      paper: ["Probeklausur 2a: Messwerte in ein **s-t²-Diagramm** eintragen und Ausgleichsgerade zeichnen."] },
    { nr: "15", area: "5. Experimente auswerten", short: "Proportionalität nachweisen", title: "Ich kann Proportionalität nachweisen (Quotientengleichheit, Linearisierung, z. B. s über t²).", keys: ["ph:quot", "ph:fehler"], book: [],
      learn: [B("Zwei Wege", "**Quotientengleichheit:** s : t² für alle Messwerte ausrechnen – ungefähr gleich → s ~ t². **Linearisierung:** s über t² auftragen – Ursprungsgerade → s ~ t².")],
      paper: [] },
    { nr: "16", area: "5. Experimente auswerten", short: "Messunsicherheiten", title: "Ich kann Messunsicherheiten und Fehlerquellen nennen und begründen.", keys: ["ph:fehler"], book: [],
      learn: [B("Typische Fehlerquellen", "Handstoppen (Reaktionszeit, z. B. ± 0,2 s) · Ablesen · Reibung · ungenaue Streckenmessung. Mit Unsicherheit rechnet man **beide Grenzen** aus.", "", ["40 m in 2,6 s ± 0,2 s", "langsamste Schätzung: 40 : 2,8 = 14,3 m/s = 51 km/h", "→ auch dann > 50 km/h: sicher zu schnell"])],
      paper: [] },
    { nr: "17", area: "6. Aufgaben bearbeiten", short: "Gegeben – Gesucht – Lösung", title: "Ich kann Rechnungen mit Gegeben, Gesucht und Lösung samt Einheiten aufschreiben und sinnvoll runden.", keys: ["ph:bes_s", "ph:anhalt"], book: [],
      learn: [B("Schema", "**Geg.:** alle Größen mit Einheit (in SI umgerechnet) · **Ges.:** Größe · **Lösung:** Formel → umgestellt → Zahlen mit Einheiten → Ergebnis sinnvoll gerundet (2–3 gültige Ziffern) · **Antwortsatz**.")],
      paper: ["Rechne jede Aufgabe im Heft genau so – das gibt in der Klausur Punkte, auch wenn das Ergebnis falsch ist."] },
    { nr: "18", area: "6. Aufgaben bearbeiten", short: "Operatoren", title: "Ich kann Operatoren unterscheiden (nennen, beschreiben, erklären, berechnen, begründen, skizzieren).", keys: ["ph:op"], book: [],
      learn: [B("Operatoren", "**nennen** = aufzählen · **beschreiben** = sagen, was passiert · **erklären** = mit Gesetzen begründen · **berechnen** = Rechenweg · **begründen** = mit Argumenten stützen · **skizzieren** = grob zeichnen, Achsen beschriften.")],
      paper: [] },
    { nr: "P", area: "Probeklausur", short: "Probeklausur + Lösungen", title: "Probeklausur Kinematik (TaskCards → „Übung für die Klausur“) unter Zeitdruck schreiben, dann mit den Lösungen vergleichen.", keys: [], spoiler: true, book: ["TaskCards: Probeklausur_Kinematik_EF.pdf"],
      learn: [
        B("1a) Zu schnell?", "", "v = 40 m : 2,6 s = 15,4 m/s = 55,4 km/h", ["Mit Unsicherheit: t zwischen 2,4 s und 2,8 s", "v zwischen 40 : 2,8 = 14,3 m/s (51 km/h) und 40 : 2,4 = 16,7 m/s (60 km/h)", "Auch der kleinste Wert liegt über 50 km/h → das Auto war sicher zu schnell"]),
        B("1b/c) Bus im v-t-Diagramm", "Abschnitte: I anfahren (v steigt), II konstant, III bremsen. a = Δv : Δt aus den abgelesenen Werten, Abstand = Fläche unter dem ganzen Graphen (Dreieck + Rechteck + Dreieck). Höchstgeschwindigkeit ablesen, in km/h umrechnen und mit 30 km/h vergleichen."),
        B("1d) Anhaltewege", "", "s_A = v · 1,0 s + v² : (2 · 6,0 m/s²)", ["50 km/h = 13,9 m/s: 13,9 + 16,1 = 30,0 m > 25 m → kommt NICHT rechtzeitig zum Stehen", "30 km/h = 8,33 m/s: 8,3 + 5,8 = 14,1 m < 25 m → hält rechtzeitig"]),
        B("1e) Aufprallgeschwindigkeit bei 50 km/h", "", "v² = v₀² − 2 · a · s", ["Nach dem Reaktionsweg (13,9 m) bleiben 25 − 13,9 = 11,1 m zum Bremsen", "v² = 13,9² − 2 · 6 · 11,1 = 192,9 − 133,3 = 59,6", "v = 7,7 m/s ≈ 28 km/h"]),
        B("1f) Stellungnahme", "Bei 30 km/h hält das Auto nach 14 m, bei 50 km/h trifft es das Kind noch mit fast 28 km/h. Messung a) zeigt, dass schon 50 km/h überschritten werden. → Tempo 30 ist sinnvoll (mit Bezug auf a), d), e))."),
        B("2a) Gleichmäßig beschleunigt?", "", "s : t² = 1,30 · 1,23 · 1,26 · 1,26 ≈ 1,25 m/s²", ["Quotient (fast) konstant → s ~ t² → gleichmäßig beschleunigt", "a = 2 · 1,25 = 2,5 m/s²"]),
        B("2b) Durchschnitt vs. Momentan", "", "v̄ = 20,1 m : 4 s = 5,0 m/s = 18 km/h   ·   v = a · t = 2,5 · 4 = 10 m/s = 36 km/h", ["Unterschied: das Auto wird immer schneller, der Durchschnitt mittelt über die langsame Anfangsphase (aus dem Stand: v̄ = v_Ende/2)"]),
        B("2c) Einholen", "", "Auto: s = 1,25 · t²   ·   Moped (36 km/h = 10 m/s): s = 10 · t", ["1,25 t² = 10 t → t = 8 s", "s = 10 · 8 = 80 m"]),
        B("2d) Diagramm", "Moped: Ursprungsgerade (Steigung 10 m/s). Auto: Parabelast. Schnittpunkt bei (8 s | 80 m) markieren. Bis 10 s zeichnen: Moped 100 m, Auto 125 m."),
        B("2e) Mit 50 km/h-Grenze", "", "v(8 s) = 2,5 · 8 = 20 m/s = 72 km/h > 50 km/h → zu schnell", ["50 km/h = 13,9 m/s nach t₁ = 13,9 : 2,5 = 5,56 s, Weg s₁ = 1,25 · 5,56² = 38,6 m", "danach: s = 38,6 + 13,9 · (t − 5,56)", "gleichsetzen mit 10 · t → 3,89 · t = 38,6 → t ≈ 9,9 s", "Ort: s ≈ 99 m"])],
      paper: ["Probeklausur in **90 Minuten** ohne Hilfe schreiben (PDF auf TaskCards, „Übung für die Klausur“).", "Danach erst die Lösungen hier aufklappen und mit Rotstift korrigieren. Alles Falsche → Punkt auf der Checkliste auf „Noch nicht“."] }
  ];
  /** Lernplan bis zur Klausur am 23.11.2026 (3.–4. Stunde) */
  const PLAN = [
    { d: "2026-11-18", title: "Überblick & Grundlagen", tasks: [{ t: "Checkliste einmal ehrlich durchgehen: jeden Punkt auf ✅ / 🟡 / ❌ setzen" }, { t: "Formelzettel anlegen (Größen, Einheiten, alle Formeln)", nr: "1" }, { t: "km/h ↔ m/s üben", nr: "2", practice: true }, { t: "Durchschnitt vs. Momentan", nr: "3", practice: true }] },
    { d: "2026-11-19", title: "Gleichförmige Bewegung & Begegnen", tasks: [{ t: "s(t) = v·t + s₀ üben", nr: "4", practice: true }, { t: "s-t-/v-t-Diagramme (Steigung = v)", nr: "5", practice: true }, { t: "Überholen & Begegnen + TaskCards-Aufgaben Bauer A/B, Franz/Theo im Heft", nr: "12", practice: true }] },
    { d: "2026-11-20", title: "Beschleunigte Bewegung", tasks: [{ t: "Bewegungsgesetze anwenden", nr: "7", practice: true }, { t: "Formeln umstellen (t, a)", nr: "8", practice: true }, { t: "Steigung & Fläche im v-t-Diagramm", nr: "9", practice: true }, { t: "Diagramme zuordnen", nr: "10", practice: true }] },
    { d: "2026-11-21", title: "Anwendungen & Experimente", tasks: [{ t: "Anhalteweg + AB Anhalteweg (mit Lösungen) im Heft", nr: "11", practice: true }, { t: "Geneigte Ebene: s ~ t² nachweisen", nr: "13", practice: true }, { t: "Messunsicherheit, Ausgleichsgerade, Linearisierung", nr: "15", practice: true }] },
    { d: "2026-11-22", title: "Probeklausur & Schwachstellen", tasks: [{ t: "Probeklausur in 90 Min. schreiben, dann mit den Lösungen vergleichen", nr: "P" }, { t: "Fehlerheft üben – genau deine Fehler" , fehler: true }, { t: "Alle Punkte mit 🟡/❌ noch einmal üben" }, { t: "Formelzettel einmal laut durchgehen, früh schlafen 😴" }] },
    { d: "2026-11-23", title: "Klausurtag", tasks: [{ t: "Morgens 10 Min. Formelzettel anschauen – nicht mehr Neues lernen" }, { t: "Taschenrechner, Geodreieck, Bleistift einpacken" }] }
  ];
  return { ITEMS, PLAN, G };
});
