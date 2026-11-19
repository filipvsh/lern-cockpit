/* =====================================================================
   LERN-COCKPIT · PHYSIK-LERNKURS KINEMATIK (Klausur EF, 23.11.2026)
   Der Kurs zur Klausur – nach dem „Klausur-Standard“ (siehe CLAUDE.md):
   Kapitel mit Erklärung, Diagrammen, Beispielen Schritt für Schritt,
   typischen Fehlern, Videos und passenden Übungen (Generatoren aus
   physik.js) + Merkblatt zum Ausdrucken.
   PK.svg(spec) zeichnet Physik-Diagramme (s-t, v-t, a-t) als SVG-Text.
   Getestet in tests/engine.test.js.
   ===================================================================== */
(function (root, factory) {
  const P = factory();
  if (typeof module === "object" && module.exports) module.exports = P;
  else root.PK = P;
})(typeof self !== "undefined" ? self : this, function () {
  const fx = x => { const r = Math.round(x * 100) / 100; return String(r).replace(".", ","); };
  const e = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  /** Punkte einer Funktion f(t) von a bis b */
  const curve = (f, a, b, n) => { const out = []; n = n || 40; for (let i = 0; i <= n; i++) { const t = a + (b - a) * i / n; out.push([t, f(t)]); } return out; };
  /** „schöne“ Achsenteilung: 1, 2, 5 · 10^k mit ca. 5 Strichen */
  function niceStep(range, ticks) { const raw = Math.abs(range) / (ticks || 5) || 1; const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  function axis(lo, hi, ticks) { if (hi - lo < 1e-9) hi = lo + 1; const st = niceStep(hi - lo, ticks); return [Math.floor(lo / st + 1e-9) * st, Math.ceil(hi / st - 1e-9) * st, st]; }

  /** Diagramm zeichnen.
     spec: { x:[von,bis,Schritt], y:[von,bis,Schritt], xl:"t in s", yl:"v in m/s", w, h,
             lines:[{pts:[[x,y]…], c:1-4, dash, label}], areas:[{pts, c, label}],
             marks:[{x, y, label, c}], tri:{p:[x1,y1], q:[x2,y2], dx:"Δt = 2 s", dy:"Δs = 10 m"},
             title, vlines:[{x, label}] } */
  function svg(F) {
    const W = F.w || 360, H = F.h || 240, L = 46, R = 16, T = F.title ? 26 : 14, B = 40;
    const [x0, x1, xs] = F.x, [y0, y1, ys] = F.y;
    const sx = x => L + (x - x0) / (x1 - x0) * (W - L - R), sy = y => H - B - (y - y0) / (y1 - y0) * (H - B - T);
    const n = v => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
    let g = "";
    const nx = Math.floor((x1 - x0) / xs + 1e-6), ny = Math.floor((y1 - y0) / ys + 1e-6);
    for (let i = 0; i <= nx; i++) { const x = x0 + i * xs; g += '<line class="g" x1="' + n(sx(x)) + '" y1="' + n(sy(y0)) + '" x2="' + n(sx(x)) + '" y2="' + n(sy(y1)) + '"/><text class="tk" x="' + n(sx(x)) + '" y="' + n(sy(y0) + 15) + '" text-anchor="middle">' + fx(x) + '</text>'; }
    for (let i = 0; i <= ny; i++) { const y = y0 + i * ys; g += '<line class="g" x1="' + n(sx(x0)) + '" y1="' + n(sy(y)) + '" x2="' + n(sx(x1)) + '" y2="' + n(sy(y)) + '"/><text class="tk" x="' + n(sx(x0) - 6) + '" y="' + n(sy(y) + 4) + '" text-anchor="end">' + fx(y) + '</text>'; }
    const ay = y0 <= 0 && y1 >= 0 ? 0 : y0;
    g += '<line class="ax" x1="' + n(sx(x0)) + '" y1="' + n(sy(ay)) + '" x2="' + n(sx(x1) + 8) + '" y2="' + n(sy(ay)) + '"/><path class="axh" d="M' + n(sx(x1) + 10) + ' ' + n(sy(ay)) + 'l-7 -4v8z"/>';
    g += '<line class="ax" x1="' + n(sx(x0)) + '" y1="' + n(sy(y0)) + '" x2="' + n(sx(x0)) + '" y2="' + n(sy(y1) - 8) + '"/><path class="axh" d="M' + n(sx(x0)) + ' ' + n(sy(y1) - 10) + 'l-4 7h8z"/>';
    g += '<text class="axl" x="' + n(W - R) + '" y="' + n(H - 6) + '" text-anchor="end">' + e(F.xl || "t in s") + '</text><text class="axl" x="' + n(sx(x0) + 8) + '" y="' + n(T - 2) + '">' + e(F.yl || "") + '</text>';
    if (F.title) g = '<text class="ttl" x="' + (W / 2) + '" y="14" text-anchor="middle">' + e(F.title) + '</text>' + g;
    const P = pts => pts.map(p => n(sx(p[0])) + "," + n(sy(Math.max(y0, Math.min(y1, p[1]))))).join(" ");
    (F.areas || []).forEach(a => { g += '<polygon class="ar c' + (a.c || 1) + '" points="' + P(a.pts) + '"/>'; if (a.label) { const cx = a.pts.reduce((s, p) => s + p[0], 0) / a.pts.length, cy = a.pts.reduce((s, p) => s + p[1], 0) / a.pts.length; g += '<text class="arl c' + (a.c || 1) + '" x="' + n(sx(cx)) + '" y="' + n(sy(cy) + 4) + '" text-anchor="middle">' + e(a.label) + '</text>'; } });
    (F.vlines || []).forEach(v => { g += '<line class="vl" x1="' + n(sx(v.x)) + '" y1="' + n(sy(y0)) + '" x2="' + n(sx(v.x)) + '" y2="' + n(sy(y1)) + '"/>' + (v.label ? '<text class="vll" x="' + n(sx(v.x) + 3) + '" y="' + n(sy(y1) + 10) + '">' + e(v.label) + '</text>' : ""); });
    if (F.tri) { const [a, b] = [F.tri.p, F.tri.q]; g += '<polyline class="tri" points="' + P([a, [b[0], a[1]], b]) + '"/><text class="tril" x="' + n((sx(a[0]) + sx(b[0])) / 2) + '" y="' + n(sy(a[1]) + 14) + '" text-anchor="middle">' + e(F.tri.dx || "Δt") + '</text><text class="tril" x="' + n(sx(b[0]) + 4) + '" y="' + n((sy(a[1]) + sy(b[1])) / 2 + 4) + '">' + e(F.tri.dy || "Δs") + '</text>'; }
    (F.lines || []).forEach(l => { g += '<polyline class="ln c' + (l.c || 1) + (l.dash ? " dash" : "") + '" points="' + P(l.pts) + '"/>'; if (l.label) { const p = l.at != null ? l.pts[l.at] : l.pts[l.pts.length - 1]; g += '<text class="lnl c' + (l.c || 1) + '" x="' + n(Math.min(sx(p[0]) + 4, W - R - 4)) + '" y="' + n(Math.max(T + 10, sy(Math.min(y1, p[1])) - 6)) + '" text-anchor="' + (sx(p[0]) > W - 90 ? "end" : "start") + '">' + e(l.label) + '</text>'; } });
    (F.marks || []).forEach(m => { g += '<circle class="mk c' + (m.c || 1) + '" cx="' + n(sx(m.x)) + '" cy="' + n(sy(m.y)) + '" r="4.5"/>' + (m.label ? '<text class="mkl" x="' + n(sx(m.x) + (sx(m.x) > W * 0.55 ? -7 : 7)) + '" y="' + n(sy(m.y) - 7) + '" text-anchor="' + (sx(m.x) > W * 0.55 ? "end" : "start") + '">' + e(m.label) + '</text>' : ""); });
    return '<svg class="phf" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + e((F.title || "") + " Diagramm " + (F.yl || "") + " über " + (F.xl || "t")) + '">' + g + '</svg>';
  }

  /** Mini-Diagramme für die Übersicht (Ruhe / gleichförmig / beschleunigt × s-t, v-t, a-t) */
  const MINI = {
    ruhe: { st: [[0, 3], [5, 3]], vt: [[0, 0], [5, 0]], at: [[0, 0], [5, 0]] },
    gleich: { st: [[0, 0.5], [5, 5]], vt: [[0, 3], [5, 3]], at: [[0, 0], [5, 0]] },
    besch: { st: curve(t => 0.2 * t * t, 0, 5, 20), vt: [[0, 0], [5, 5]], at: [[0, 2.5], [5, 2.5]] }
  };
  const mini = (pts, yl, c) => svg({ w: 150, h: 112, x: [0, 5, 5], y: [0, 5, 5], xl: "t", yl, lines: [{ pts, c }] });
  const matrix = () => '<div class="ku-matrix"><div></div><b>s-t</b><b>v-t</b><b>a-t</b>' + [["ruhe", "Ruhe", 4], ["gleich", "gleichförmig", 1], ["besch", "gleichmäßig beschleunigt", 2]].map(([k, l, c]) => '<b class="ku-mr">' + l + '</b>' + mini(MINI[k].st, "s", c) + mini(MINI[k].vt, "v", c) + mini(MINI[k].at, "a", c)).join("") + '</div>';

  /* ---------------- Kapitel ---------------- */
  // Abschnitt: { h, t (Text mit **fett**), f (Formel), tbl:[[Kopf…],[…]], fig | figs:[…], ex:{q, steps, a}, lab:{s0,v0,a}, matrix:true, tip }
  const bus = [[0, 0], [5, 10], [15, 10], [20, 0]];
  const CH = [
    { id: "grund", ico: "📏", title: "Grundlagen: Größen, Einheiten, Durchschnitt", short: "Grundlagen", goal: "Du kennst s, t, v, a mit Einheit, rechnest km/h ↔ m/s im Schlaf und weißt, was Durchschnitts- und Momentangeschwindigkeit ist.", nrs: ["1", "2", "3"],
      sec: [
        { h: "Die vier Größen der Kinematik", t: "Kinematik beschreibt Bewegungen – **ohne** nach der Ursache (Kraft) zu fragen. Du brauchst nur vier Größen:",
          tbl: [["Größe", "Zeichen", "Einheit", "Bedeutung"], ["Ort / Weg", "s", "m", "Wo ist der Körper? Wie weit ist er gekommen?"], ["Zeit", "t", "s", "Wie lange dauert es?"], ["Geschwindigkeit", "v", "m/s", "Wie viele Meter pro Sekunde?"], ["Beschleunigung", "a", "m/s²", "Um wie viel m/s wird er pro Sekunde schneller?"]],
          tip: "Δ (Delta) heißt „Differenz“: Δs = s₂ − s₁, Δt = t₂ − t₁. Deshalb: v = Δs : Δt und a = Δv : Δt." },
        { h: "km/h ↔ m/s – der Faktor 3,6", t: "1 km/h = 1000 m : 3600 s = 1/3,6 m/s. **m/s ist immer die kleinere Zahl** – also von km/h nach m/s durch 3,6 teilen.", f: "km/h : 3,6 = m/s     ·     m/s · 3,6 = km/h",
          tbl: [["km/h", "18", "30", "36", "50", "54", "72", "100", "108"], ["m/s", "5", "8,3", "10", "13,9", "15", "20", "27,8", "30"]],
          ex: { q: "Ein Radfahrer fährt 27 km/h. Wie viele m/s sind das? Und wie viel km/h sind 25 m/s?", steps: ["km/h → m/s: durch 3,6", "27 : 3,6 = 7,5 m/s", "m/s → km/h: mal 3,6", "25 · 3,6 = 90 km/h"], a: "7,5 m/s und 90 km/h" },
          tip: "In jede Formel **immer m/s** einsetzen! Erst am Ende zurück in km/h, wenn danach gefragt ist." },
        { h: "Durchschnitt oder Momentan?", t: "**Durchschnittsgeschwindigkeit** v̄ = ganze Strecke : ganze Zeit – im s-t-Diagramm die Steigung der Verbindungslinie (Sekante). **Momentangeschwindigkeit** = der Tachowert in genau einem Moment – im s-t-Diagramm die Steigung der Tangente.",
          fig: { x: [0, 4, 1], y: [0, 25, 5], xl: "t in s", yl: "s in m", lines: [{ pts: curve(t => 1.25 * t * t, 0, 4), c: 1, label: "Auto", at: 28 }, { pts: [[0, 0], [4, 20]], c: 2, dash: 1, label: "v̄ = 5 m/s", at: 0 }, { pts: [[2, 0], [4, 20]], c: 3, dash: 1 }], marks: [{ x: 4, y: 20, label: "v(4 s) = 10 m/s", c: 3 }] },
          ex: { q: "Ein Auto fährt aus dem Stand gleichmäßig beschleunigt (a = 2,5 m/s²) und legt in 4 s 20 m zurück. Durchschnitts- und Momentangeschwindigkeit nach 4 s?", steps: ["v̄ = Δs : Δt = 20 m : 4 s = 5 m/s = 18 km/h", "v(4 s) = a · t = 2,5 m/s² · 4 s = 10 m/s = 36 km/h", "Warum doppelt? Das Auto wird immer schneller – am Anfang ist es langsam, das zieht den Durchschnitt runter."], a: "v̄ = 5 m/s (18 km/h), v = 10 m/s (36 km/h)" },
          tip: "Aus dem Stand gleichmäßig beschleunigt gilt immer: v̄ = v_Ende : 2." }
      ],
      pit: ["km/h direkt in die Formel eingesetzt – immer erst in m/s umrechnen.", "Durchschnitt mit Endgeschwindigkeit verwechselt.", "Einheit vergessen: „5“ ist kein Ergebnis, „5 m/s“ schon."],
      vids: [{ id: "ABfjpgI9O9M", t: "km/h in m/s umrechnen – und warum" }, { id: "SoPDIv1llf8", t: "Wann mal 3,6 und wann durch 3,6? (Eselsbrücke)" }] },

    { id: "gleich", ico: "➡️", title: "Gleichförmige Bewegung", short: "Gleichförmig", goal: "Du erkennst gleichförmige Bewegungen, rechnest mit s(t) = v·t + s₀ und liest v als Steigung aus dem s-t-Diagramm ab.", nrs: ["4", "5"],
      sec: [
        { h: "Merkmale", t: "Die Geschwindigkeit ist **konstant**, die Beschleunigung ist **a = 0**. In gleichen Zeiten legt der Körper gleiche Wege zurück. s₀ ist der Startort (wo er bei t = 0 ist).", f: "s(t) = v · t + s₀",
          tbl: [["t in s", "0", "1", "2", "3", "4"], ["s in m (v = 5 m/s, s₀ = 10 m)", "10", "15", "20", "25", "30"]] },
        { h: "So sehen die Diagramme aus", t: "**s-t-Diagramm:** eine Gerade – je steiler, desto schneller. Wo sie die s-Achse schneidet, liest du s₀ ab. **v-t-Diagramm:** eine waagerechte Linie in Höhe v.",
          figs: [{ x: [0, 6, 1], y: [0, 60, 10], xl: "t in s", yl: "s in m", lines: [{ pts: [[0, 0], [6, 60]], c: 1, label: "v = 10 m/s" }, { pts: [[0, 0], [6, 30]], c: 2, label: "v = 5 m/s" }, { pts: [[0, 20], [6, 50]], c: 3, label: "s₀ = 20 m" }] },
            { x: [0, 6, 1], y: [0, 12, 2], xl: "t in s", yl: "v in m/s", lines: [{ pts: [[0, 10], [6, 10]], c: 1, label: "10 m/s" }, { pts: [[0, 5], [6, 5]], c: 2, label: "5 m/s" }] }] },
        { h: "Geschwindigkeit ablesen – das Steigungsdreieck", t: "Zwei gut ablesbare Punkte auf der Geraden wählen, Δs und Δt an den **Achsenwerten** ablesen (nicht Kästchen zählen!), dann teilen.", f: "v = Δs : Δt",
          fig: { x: [0, 8, 1], y: [0, 50, 10], xl: "t in s", yl: "s in m", lines: [{ pts: [[0, 10], [8, 42]], c: 1 }], tri: { p: [2, 18], q: [7, 38], dx: "Δt = 5 s", dy: "Δs = 20 m" }, marks: [{ x: 2, y: 18 }, { x: 7, y: 38 }] },
          ex: { q: "Lies aus dem Diagramm oben v und s₀ ab und stelle das Zeit-Ort-Gesetz auf.", steps: ["Punkte (2 s | 18 m) und (7 s | 38 m)", "v = (38 − 18) m : (7 − 2) s = 20 m : 5 s = 4 m/s", "Schnitt mit der s-Achse: s₀ = 10 m", "s(t) = 4 m/s · t + 10 m"], a: "s(t) = 4 · t + 10 (s in m, t in s)" } },
        { h: "Rechnen mit Schema", t: "In der Klausur gibt der Rechenweg Punkte – auch wenn das Ergebnis falsch ist. Schreib immer **Geg. – Ges. – Lösung – Antwort**.",
          ex: { q: "Ein Zug fährt gleichförmig mit 72 km/h. Wie lange braucht er für 1,5 km?", steps: ["Geg.: v = 72 km/h = 20 m/s, s = 1,5 km = 1500 m", "Ges.: t", "s = v · t  →  t = s : v", "t = 1500 m : 20 m/s = 75 s", "Antwort: Der Zug braucht 75 s (1 min 15 s)."], a: "75 s" } },
        { h: "🔬 Bewegungs-Labor: probier es aus", t: "Verändere v₀ und s₀ (a bleibt 0) und schau, wie sich die Diagramme ändern. Mit dem t-Regler wanderst du durch die Zeit.", lab: { s0: 10, v0: 5, a: 0 } }
      ],
      pit: ["s₀ vergessen, wenn der Körper nicht bei 0 startet.", "Steigung über Kästchen statt über Achsenwerte bestimmt.", "Waagerechte Linie im v-t-Diagramm mit Stillstand verwechselt – sie heißt nur „v konstant“."],
      vids: [{ id: "XNA1ZUlx0N4", t: "Gleichförmige Bewegung – einfach erklärt (Lerntippsammlung)" }, { id: "5dPe7-NVt5g", t: "Gleichförmige Bewegung und s(t)-Gesetz (Physik 10)" }, { id: "5d3xR4th8y4", t: "Gleichförmige Bewegung im s-t- und v-t-Diagramm" }] },

    { id: "besch", ico: "🚀", title: "Gleichmäßig beschleunigte Bewegung", short: "Beschleunigt", goal: "Du kennst die Merkmale, wendest v(t) = a·t + v₀ und s(t) = ½·a·t² + v₀·t + s₀ an und stellst nach t oder a um.", nrs: ["6", "7", "8"],
      sec: [
        { h: "Merkmale", t: "Die Beschleunigung ist **konstant (≠ 0)**. Die Geschwindigkeit wächst jede Sekunde um gleich viel – die Wege pro Sekunde werden **immer größer**.",
          tbl: [["t in s", "0", "1", "2", "3", "4"], ["v in m/s (a = 2 m/s²)", "0", "2", "4", "6", "8"], ["s in m", "0", "1", "4", "9", "16"], ["Weg in dieser Sekunde", "–", "1", "3", "5", "7"]],
          tip: "Die Wege pro Sekunde wachsen wie 1, 3, 5, 7 … – daran erkennst du in Messreihen eine gleichmäßig beschleunigte Bewegung." },
        { h: "Die zwei Bewegungsgesetze", f: "v(t) = a · t + v₀\ns(t) = ½ · a · t² + v₀ · t + s₀", t: "Startet der Körper aus dem Stand am Nullpunkt (v₀ = 0, s₀ = 0), wird es einfacher: **v = a · t** und **s = ½ · a · t²**.",
          figs: [{ x: [0, 4, 1], y: [0, 16, 4], xl: "t in s", yl: "s in m", title: "s-t: Parabelast", lines: [{ pts: curve(t => t * t, 0, 4), c: 1 }], w: 240, h: 190 },
            { x: [0, 4, 1], y: [0, 8, 2], xl: "t in s", yl: "v in m/s", title: "v-t: steigende Gerade", lines: [{ pts: [[0, 0], [4, 8]], c: 1 }], w: 240, h: 190 },
            { x: [0, 4, 1], y: [0, 3, 1], xl: "t in s", yl: "a in m/s²", title: "a-t: waagerecht", lines: [{ pts: [[0, 2], [4, 2]], c: 1 }], w: 240, h: 190 }],
          ex: { q: "Ein Auto beschleunigt aus dem Stand in 8 s auf 100 km/h. Wie groß ist a, welche Strecke legt es dabei zurück?", steps: ["Geg.: v₀ = 0, v = 100 km/h = 27,8 m/s, t = 8 s", "a = v : t = 27,8 m/s : 8 s ≈ 3,47 m/s²", "s = ½ · a · t² = ½ · 3,47 · 8² ≈ 111 m", "Probe mit v̄: (27,8 : 2) · 8 = 111 m ✓"], a: "a ≈ 3,5 m/s², s ≈ 111 m" } },
        { h: "Formeln umstellen", t: "Die Klausur fragt oft nach t oder a. Diese Umstellungen solltest du auswendig können:", f: "t = v : a     ·     a = v : t\nt = √(2s : a)     ·     a = 2s : t²\nohne Zeit:  v² = v₀² + 2 · a · s",
          ex: { q: "Ein Körper startet aus der Ruhe mit a = 4 m/s². Nach welcher Zeit hat er 50 m zurückgelegt? Wie schnell ist er dann?", steps: ["s = ½ · a · t²  | · 2  | : a", "t² = 2s : a = 100 : 4 = 25", "t = √25 = 5 s", "v = a · t = 4 · 5 = 20 m/s = 72 km/h"], a: "t = 5 s, v = 20 m/s" } },
        { h: "Bremsen = negative Beschleunigung", t: "„Bremsverzögerung 6 m/s²“ heißt: pro Sekunde **6 m/s langsamer**. Bis zum Stillstand gilt:", f: "Bremszeit t = v₀ : a     ·     Bremsweg s = v₀² : (2a)",
          fig: { x: [0, 5, 1], y: [0, 15, 5], xl: "t in s", yl: "v in m/s", lines: [{ pts: [[0, 12], [2, 12], [4, 0]], c: 1 }], areas: [{ pts: [[2, 0], [2, 12], [4, 0]], c: 4, label: "Bremsweg" }], vlines: [{ x: 2, label: "Bremsen" }] } },
        { h: "🔬 Bewegungs-Labor", t: "Stell eine Beschleunigung ein und beobachte: s-t wird zum Parabelast, v-t zur schrägen Geraden, a-t bleibt waagerecht. Probier auch ein negatives a (Bremsen)!", lab: { s0: 0, v0: 0, a: 2 } }
      ],
      pit: ["Das ½ in s = ½·a·t² vergessen.", "t nicht quadriert (t², nicht 2t).", "Den Term v₀·t vergessen, wenn der Körper schon Geschwindigkeit hat.", "Beim Umstellen nach t die Wurzel vergessen."],
      vids: [{ id: "waYZwEmb39M", t: "Gleichmäßig beschleunigte Bewegung – Grundwissen" }, { id: "BKjBpK7sBOw", t: "Formeln und Herleitung (s₀ = 0, v₀ = 0)" }, { id: "BhL1kVizBMs", t: "Allgemeine Bewegungsgleichungen mit Startgeschwindigkeit" }] },

    { id: "diag", ico: "📈", title: "Diagramme: Steigung & Fläche", short: "Diagramme", goal: "Du ordnest s-t-, v-t- und a-t-Diagramme einander zu, liest a als Steigung ab und bestimmst die Strecke als Fläche unter dem v-t-Graphen.", nrs: ["9", "10"],
      sec: [
        { h: "Die drei Bewegungsarten auf einen Blick", t: "Diese Übersicht ist der Kern der Klausur. Präg sie dir ein – und zeichne sie einmal selbst ab.", matrix: true },
        { h: "Steigung = die nächste Größe", t: "Die Steigung im **s-t-Diagramm** ist die Geschwindigkeit v. Die Steigung im **v-t-Diagramm** ist die Beschleunigung a.", f: "s-t: Steigung = v = Δs : Δt\nv-t: Steigung = a = Δv : Δt",
          fig: { x: [0, 6, 1], y: [0, 15, 5], xl: "t in s", yl: "v in m/s", lines: [{ pts: [[0, 2], [6, 14]], c: 1 }], tri: { p: [1, 4], q: [5, 12], dx: "Δt = 4 s", dy: "Δv = 8 m/s" }, marks: [{ x: 1, y: 4 }, { x: 5, y: 12, label: "a = 8 : 4 = 2 m/s²" }] } },
        { h: "Fläche unter dem v-t-Graphen = Strecke", t: "Teile die Fläche in Dreiecke und Rechtecke. Dreieck: ½ · Grundseite · Höhe. Rechteck: Breite · Höhe. So bekommst du auch bei Bremsen und Anfahren die Strecke.",
          fig: { x: [0, 20, 5], y: [0, 12, 2], xl: "t in s", yl: "v in m/s", lines: [{ pts: bus, c: 1, label: "Bus" , at: 1 }], areas: [{ pts: [[0, 0], [5, 10], [5, 0]], c: 2, label: "I" }, { pts: [[5, 0], [5, 10], [15, 10], [15, 0]], c: 3, label: "II" }, { pts: [[15, 0], [15, 10], [20, 0]], c: 2, label: "III" }] },
          ex: { q: "Ein Bus fährt an einer Haltestelle los (siehe Diagramm). Bestimme die Beschleunigung in jedem Abschnitt und den Abstand der Haltestellen.", steps: ["I (0–5 s): a = 10 m/s : 5 s = 2 m/s²", "II (5–15 s): v konstant → a = 0", "III (15–20 s): a = (0 − 10) m/s : 5 s = −2 m/s² (Bremsen)", "Fläche I: ½ · 5 s · 10 m/s = 25 m", "Fläche II: 10 s · 10 m/s = 100 m", "Fläche III: ½ · 5 s · 10 m/s = 25 m", "Abstand: 25 + 100 + 25 = 150 m", "Höchstgeschwindigkeit: 10 m/s · 3,6 = 36 km/h"], a: "a = 2 / 0 / −2 m/s², Abstand 150 m" } },
        { h: "Vom v-t- zum s-t-Diagramm", t: "Wo v **steigt**, wird der s-t-Graph immer steiler (Parabel nach oben). Wo v **konstant** ist, ist er eine Gerade. Wo v **sinkt**, flacht er ab. Wo **v = 0**, ist er waagerecht (Stillstand).",
          figs: [{ x: [0, 20, 5], y: [0, 12, 2], xl: "t in s", yl: "v in m/s", lines: [{ pts: bus, c: 1 }], w: 300, h: 200 },
            { x: [0, 20, 5], y: [0, 150, 25], xl: "t in s", yl: "s in m", lines: [{ pts: curve(t => t <= 5 ? t * t : t <= 15 ? 25 + 10 * (t - 5) : 125 + 10 * (t - 15) - (t - 15) * (t - 15), 0, 20, 60), c: 1 }], vlines: [{ x: 5, label: "I|II" }, { x: 15, label: "II|III" }], w: 300, h: 200 }] },
        { h: "🔬 Bewegungs-Labor", t: "Die blaue Fläche im v-t-Diagramm ist genau die Strecke, die seit t = 0 dazugekommen ist. Schieb den t-Regler und vergleiche mit dem s-t-Diagramm.", lab: { s0: 0, v0: 2, a: 1 } }
      ],
      pit: ["Im v-t-Diagramm die Höhe als Ort gelesen – die Höhe ist die Geschwindigkeit!", "Fallende Linie im v-t-Diagramm = Bremsen, nicht „rückwärts fahren“.", "Bei der Fläche das ½ beim Dreieck vergessen.", "Achsen beim Zeichnen nicht beschriftet (Größe und Einheit!)."],
      vids: [{ id: "JzNS-cpauzU", t: "Bewegungsdiagramme interpretieren (s-t, v-t, a-t)" }, { id: "5i65gzbDtNk", t: "Diagramme zur gleichförmigen und beschleunigten Bewegung" }, { id: "U9tqTmTTYU4", t: "Vom v(t)- zum s(t)-Diagramm über die Fläche" }] },

    { id: "anhalt", ico: "🛑", title: "Reaktionsweg, Bremsweg, Anhalteweg", short: "Anhalteweg", goal: "Du berechnest Reaktions-, Brems- und Anhalteweg und die Geschwindigkeit, mit der ein Auto ein Hindernis noch trifft.", nrs: ["11"],
      sec: [
        { h: "Zwei Phasen", t: "**1. Reaktionszeit:** Der Fahrer hat noch nicht gebremst – das Auto fährt gleichförmig weiter. **2. Bremsen:** gleichmäßig verzögert bis zum Stillstand.", f: "s_R = v · t_R\ns_B = v² : (2a)\ns_A = s_R + s_B",
          fig: { x: [0, 4, 1], y: [0, 15, 5], xl: "t in s", yl: "v in m/s", lines: [{ pts: [[0, 13.9], [1, 13.9], [3.32, 0]], c: 1 }], areas: [{ pts: [[0, 0], [0, 13.9], [1, 13.9], [1, 0]], c: 2, label: "s_R" }, { pts: [[1, 0], [1, 13.9], [3.32, 0]], c: 4, label: "s_B" }], vlines: [{ x: 1, label: "Bremsen" }] },
          tip: "Woher kommt v² : (2a)? Bremszeit t = v : a, Bremsweg = Dreiecksfläche ½ · v · t = ½ · v · v/a = v² : (2a)." },
        { h: "Beispiel: Tempo 50 oder Tempo 30?", ex: { q: "Ein Kind läuft 25 m vor einem Auto auf die Straße. Reaktionszeit 1,0 s, Bremsverzögerung 6,0 m/s². Kommt das Auto bei 50 km/h bzw. 30 km/h rechtzeitig zum Stehen?", steps: ["50 km/h = 13,9 m/s", "s_R = 13,9 m/s · 1,0 s = 13,9 m", "s_B = 13,9² : (2 · 6) = 193 : 12 = 16,1 m", "s_A = 30,0 m > 25 m → NICHT rechtzeitig", "30 km/h = 8,33 m/s: s_R = 8,3 m, s_B = 8,33² : 12 = 5,8 m", "s_A = 14,1 m < 25 m → hält rechtzeitig"], a: "50 km/h: 30 m (zu lang) · 30 km/h: 14 m (reicht)" },
          tip: "Doppelte Geschwindigkeit → **vierfacher** Bremsweg (wegen v²)." },
        { h: "Mit welcher Geschwindigkeit trifft das Auto?", t: "Reicht der Weg nicht, bremst das Auto nur auf der Reststrecke d − s_R. Dafür gibt es die Formel ohne Zeit:", f: "v² = v₀² − 2 · a · s",
          ex: { q: "Wie oben, 50 km/h, Hindernis in 25 m. Mit welcher Geschwindigkeit erreicht das Auto die Stelle?", steps: ["Reststrecke zum Bremsen: 25 m − 13,9 m = 11,1 m", "v² = 13,9² − 2 · 6 · 11,1 = 193 − 133 = 60", "v = √60 ≈ 7,7 m/s", "7,7 · 3,6 ≈ 28 km/h"], a: "≈ 7,7 m/s ≈ 28 km/h" } },
        { h: "Faustformeln der Fahrschule (v in km/h, Ergebnis in m)", tbl: [["Weg", "Faustformel", "bei 50 km/h"], ["Reaktionsweg", "(v : 10) · 3", "15 m"], ["Bremsweg", "(v : 10)²", "25 m"], ["Gefahrbremsung", "(v : 10)² : 2", "12,5 m"], ["Anhalteweg", "Reaktionsweg + Bremsweg", "40 m"]],
          tip: "Die Faustformeln nehmen schlechtere Werte an (t_R ≈ 1,1 s, kleineres a) – deshalb kommen größere Wege heraus als mit der Physik-Formel." }
      ],
      pit: ["km/h nicht in m/s umgerechnet – dann ist alles falsch.", "Reaktionsweg vergessen.", "Beim Aufprall mit der ganzen Strecke statt der Reststrecke gerechnet."],
      vids: [{ id: "zELzOssHpzY", t: "Anhalteweg – Reaktionsweg – Bremsweg" }, { id: "kNIBunvsNiA", t: "Anhalteweg und Bremsweg: Übungsaufgabe 1" }, { id: "4aHb6cTvUBs", t: "Anhalteweg und Bremsweg: Übungsaufgabe 2" }, { id: "xFBZqffj3Yo", t: "Faustformeln aus der Fahrschule (inkl. Gefahrbremsung)" }] },

    { id: "treff", ico: "🚗", title: "Überholen, Einholen, Begegnen", short: "Treffpunkte", goal: "Du stellst für zwei Fahrzeuge die Zeit-Ort-Gesetze auf, setzt sie gleich und findest Zeit und Ort des Treffens – auch im Diagramm.", nrs: ["12"],
      sec: [
        { h: "Das Rezept", t: "**1.** Gemeinsamen Nullpunkt und gemeinsame Uhr festlegen. **2.** Für jedes Fahrzeug s(t) aufstellen. **3.** Gleichsetzen und nach t auflösen. **4.** t in eine Gleichung einsetzen → Ort. **5.** Antwortsatz. Im s-t-Diagramm ist der Treffpunkt der **Schnittpunkt** der Graphen." },
        { h: "Begegnen (aufeinander zu)", f: "s_A = v_A · t     ·     s_B = d − v_B · t",
          fig: { x: [0, 200, 40], y: [0, 3000, 500], xl: "t in s", yl: "s in m", lines: [{ pts: [[0, 0], [200, 2000]], c: 1, label: "A" }, { pts: [[0, 3000], [200, 0]], c: 2, label: "B" }], marks: [{ x: 120, y: 1200, label: "Treffpunkt (120 s | 1200 m)" }] },
          ex: { q: "A und B sind 3 km voneinander entfernt und fahren gleichzeitig aufeinander zu: A mit 36 km/h, B mit 54 km/h. Wann und wo treffen sie sich?", steps: ["v_A = 10 m/s, v_B = 15 m/s, d = 3000 m", "s_A = 10 · t,  s_B = 3000 − 15 · t", "10 t = 3000 − 15 t  →  25 t = 3000", "t = 120 s", "Ort: s = 10 · 120 = 1200 m (von A aus)"], a: "nach 120 s, 1200 m von A entfernt" } },
        { h: "Einholen mit späterem Start", f: "s₁ = v₁ · t     ·     s₂ = v₂ · (t − Δt)",
          fig: { x: [0, 240, 60], y: [0, 1200, 200], xl: "t in s", yl: "s in m", lines: [{ pts: [[0, 0], [240, 1200]], c: 1, label: "Franz", at: 0 }, { pts: [[60, 0], [240, 1350]], c: 2, label: "Theo" }], marks: [{ x: 180, y: 900, label: "(180 s | 900 m)" }] },
          ex: { q: "Franz fährt mit 18 km/h los. Theo startet 60 s später am selben Ort mit 27 km/h. Wann holt Theo ihn ein?", steps: ["v₁ = 5 m/s, v₂ = 7,5 m/s, Δt = 60 s", "5 · t = 7,5 · (t − 60)", "5 t = 7,5 t − 450  →  2,5 t = 450", "t = 180 s nach Franz' Start", "Ort: 5 · 180 = 900 m"], a: "nach 180 s, 900 m vom Start" } },
        { h: "Beschleunigt gegen gleichförmig (Ampel)", f: "½ · a · t² = v · t   →   t = 2v : a",
          fig: { x: [0, 10, 2], y: [0, 125, 25], xl: "t in s", yl: "s in m", lines: [{ pts: curve(t => 1.25 * t * t, 0, 10), c: 1, label: "Auto" }, { pts: [[0, 0], [10, 100]], c: 2, label: "Moped" }], marks: [{ x: 8, y: 80, label: "(8 s | 80 m)" }] },
          ex: { q: "Ein Auto fährt an der Ampel mit a = 2,5 m/s² los. Gleichzeitig fährt ein Moped mit konstant 36 km/h vorbei. Wann und wo holt das Auto das Moped ein?", steps: ["Moped: 36 km/h = 10 m/s → s = 10 · t", "Auto: s = ½ · 2,5 · t² = 1,25 · t²", "1,25 t² = 10 t  | : t (t ≠ 0)", "1,25 t = 10  →  t = 8 s", "Ort: 10 · 8 = 80 m", "(t = 0 ist auch eine Lösung – das ist nur der Start an der Ampel.)"], a: "nach 8 s, 80 m hinter der Ampel" } }
      ],
      pit: ["Unterschiedliche Nullpunkte für die beiden Fahrzeuge gewählt.", "Beim späteren Start (t − Δt) vergessen.", "Durch t geteilt und die Lösung t = 0 nicht erklärt.", "Nur t ausgerechnet, den Ort vergessen."],
      vids: [{ id: "dmqZF_jenGU", t: "Zwei Objekte fahren aufeinander zu" }, { id: "dV4_K6hPTYo", t: "Wann überholt der PKW den LKW? (s-t-Diagramm)" }, { id: "PUMIssKax_o", t: "Musterlösung: Auto holt LKW ein" }, { id: "w0eo_SpE2oE", t: "Kinematik: Überholmanöver" }] },

    { id: "exp", ico: "🔬", title: "Experimente auswerten & Aufgaben aufschreiben", short: "Experimente", goal: "Du weist s ~ t² nach (Quotient und Linearisierung), zeichnest Ausgleichsgeraden, nennst Fehlerquellen und schreibst Lösungen mit Geg./Ges./Lösung.", nrs: ["13", "14", "15", "16", "17", "18"],
      sec: [
        { h: "Messreihe auf der Fahrbahn / geneigten Ebene", t: "Ein Wagen rollt aus der Ruhe los, gemessen werden Strecke s und Zeit t. Ist die Bewegung gleichmäßig beschleunigt? Dann muss **s ~ t²** gelten, also **s : t² konstant**.",
          tbl: [["t in s", "1", "2", "3", "4"], ["s in m", "1,30", "4,92", "11,34", "20,1"], ["t² in s²", "1", "4", "9", "16"], ["s : t² in m/s²", "1,30", "1,23", "1,26", "1,26"]],
          ex: { q: "Zeige mit der Tabelle, dass die Bewegung gleichmäßig beschleunigt ist, und bestimme a.", steps: ["Quotienten s : t² ausrechnen: 1,30 · 1,23 · 1,26 · 1,26", "Sie sind (bis auf Messungenauigkeit) gleich → s ~ t²", "→ gleichmäßig beschleunigte Bewegung", "Mittelwert ≈ 1,25 m/s²", "s = ½ · a · t² → s : t² = ½ a → a = 2 · 1,25 = 2,5 m/s²"], a: "a ≈ 2,5 m/s²" } },
        { h: "Linearisierung: s über t² auftragen", t: "Trägst du s nicht über t, sondern über **t²** auf, wird aus dem Parabelast eine **Ursprungsgerade** – das beweist s ~ t² grafisch. Die Steigung ist ½ a.",
          figs: [{ x: [0, 4, 1], y: [0, 25, 5], xl: "t in s", yl: "s in m", title: "s über t: Parabel", lines: [{ pts: curve(t => 1.25 * t * t, 0, 4), c: 4, dash: 1 }], marks: [[1, 1.3], [2, 4.92], [3, 11.34], [4, 20.1]].map(p => ({ x: p[0], y: p[1], c: 1 })), w: 280, h: 200 },
            { x: [0, 16, 4], y: [0, 25, 5], xl: "t² in s²", yl: "s in m", title: "s über t²: Gerade", lines: [{ pts: [[0, 0], [16, 20]], c: 3, label: "Ausgleichsgerade" }], marks: [[1, 1.3], [4, 4.92], [9, 11.34], [16, 20.1]].map(p => ({ x: p[0], y: p[1], c: 1 })), w: 280, h: 200 }] },
        { h: "Ausgleichsgerade richtig zeichnen", t: "**Nicht** von Punkt zu Punkt verbinden! Lege ein Lineal so, dass ungefähr gleich viele Punkte darüber und darunter liegen. Bei Proportionalität geht die Gerade durch den Ursprung." },
        { h: "Messunsicherheit und Fehlerquellen", t: "Typisch: **Handstoppen** (Reaktionszeit beim Starten und Stoppen, ± 0,2 s), Ablesefehler, **Reibung**, ungenau gemessene Strecke. Mit Unsicherheit rechnest du **beide Grenzen** aus.",
          ex: { q: "Ein Auto braucht für 40 m gestoppte 2,6 s (± 0,2 s). War es sicher schneller als 50 km/h?", steps: ["v = 40 m : 2,6 s = 15,4 m/s = 55 km/h", "Langsamster Fall: t = 2,8 s → v = 14,3 m/s = 51 km/h", "Schnellster Fall: t = 2,4 s → v = 16,7 m/s = 60 km/h", "Auch der kleinste Wert liegt über 50 km/h → sicher zu schnell"], a: "ja, zwischen 51 und 60 km/h" } },
        { h: "So schreibst du jede Rechenaufgabe auf", tbl: [["Schritt", "Was du hinschreibst"], ["Geg.", "alle Größen mit Einheit, in m, s, m/s umgerechnet"], ["Ges.", "die gesuchte Größe"], ["Lösung", "Formel → umgestellt → Zahlen mit Einheiten → Ergebnis"], ["Runden", "sinnvoll, meist 2–3 gültige Ziffern"], ["Antwort", "ein ganzer Satz"]] },
        { h: "Operatoren – was die Aufgabe will", tbl: [["Operator", "Das musst du tun"], ["nennen", "ohne Erklärung aufzählen"], ["beschreiben", "in eigenen Worten sagen, was passiert"], ["erklären", "mit physikalischen Gesetzen begründen, warum"], ["berechnen", "Rechenweg mit Geg./Ges./Lösung und Einheit"], ["begründen", "Aussage mit Argumenten oder Rechnung stützen"], ["skizzieren", "grob zeichnen, Achsen mit Größe und Einheit beschriften"], ["Stellung nehmen", "Ergebnisse vergleichen, eigene Meinung mit Begründung"]] }
      ],
      pit: ["Messpunkte mit Zickzack verbunden statt Ausgleichsgerade.", "s : t statt s : t² berechnet.", "„Messfehler“ ohne Ursache genannt – immer konkret: Reaktionszeit, Reibung …", "Antwortsatz vergessen."],
      vids: [{ id: "FnvEav_WI9E", t: "Proportionalität in der Physik" }, { id: "I7sEXvIIMwo", t: "Quotientengleichheit überprüfen" }] }
  ];

  /* ---------------- Merkblatt ---------------- */
  const SHEET = [
    { h: "Größen & Einheiten", rows: [["Ort / Weg", "s in m"], ["Zeit", "t in s"], ["Geschwindigkeit", "v in m/s"], ["Beschleunigung", "a in m/s²"], ["Umrechnen", "km/h : 3,6 = m/s · m/s · 3,6 = km/h"], ["Merkwerte", "36 km/h = 10 m/s · 72 km/h = 20 m/s · 50 km/h ≈ 13,9 m/s"]] },
    { h: "Gleichförmige Bewegung (a = 0)", rows: [["Zeit-Ort-Gesetz", "s(t) = v · t + s₀"], ["Geschwindigkeit", "v = Δs : Δt (Steigung im s-t)"], ["Diagramme", "s-t Gerade · v-t waagerecht · a-t = 0"]] },
    { h: "Gleichmäßig beschleunigt (a konstant)", rows: [["Zeit-Geschw.-Gesetz", "v(t) = a · t + v₀"], ["Zeit-Ort-Gesetz", "s(t) = ½ · a · t² + v₀ · t + s₀"], ["aus dem Stand", "v = a · t · s = ½ · a · t² · v̄ = v_Ende : 2"], ["umgestellt", "t = v : a · a = v : t · t = √(2s : a) · a = 2s : t²"], ["ohne Zeit", "v² = v₀² + 2 · a · s (Bremsen: − 2 · a · s)"], ["Diagramme", "s-t Parabelast · v-t schräge Gerade · a-t waagerecht"]] },
    { h: "Diagramme lesen", rows: [["Steigung s-t", "= Geschwindigkeit v"], ["Steigung v-t", "= Beschleunigung a"], ["Fläche unter v-t", "= Strecke s (Dreieck ½·g·h, Rechteck b·h)"], ["Durchschnitt", "Steigung der Sekante · Momentan: Steigung der Tangente"]] },
    { h: "Anhalteweg (v in m/s!)", rows: [["Reaktionsweg", "s_R = v · t_R"], ["Bremsweg", "s_B = v² : (2a)"], ["Anhalteweg", "s_A = s_R + s_B"], ["Aufprall", "v² = v₀² − 2 · a · (d − s_R)"], ["Faustformeln (km/h → m)", "Reaktion (v/10)·3 · Bremsen (v/10)² · Gefahr (v/10)²/2"]] },
    { h: "Treffpunkte", rows: [["Begegnen", "v_A · t = d − v_B · t"], ["Einholen (später los)", "v₁ · t = v₂ · (t − Δt)"], ["Ampel", "½ · a · t² = v · t → t = 2v : a"], ["Rezept", "gleicher Nullpunkt → gleichsetzen → t → Ort → Antwortsatz"]] },
    { h: "Experimente", rows: [["s ~ t² rechnerisch", "s : t² ist konstant (Quotientengleichheit) → a = 2 · (s : t²)"], ["s ~ t² grafisch", "s über t² auftragen → Ursprungsgerade (Linearisierung)"], ["Ausgleichsgerade", "gleich viele Punkte darüber und darunter"], ["Fehlerquellen", "Reaktionszeit beim Stoppen, Reibung, Ablesen, Streckenmessung"]] },
    { h: "Aufschreiben & Operatoren", rows: [["Schema", "Geg. → Ges. → Formel → Rechnung mit Einheiten → Ergebnis → Antwortsatz"], ["nennen / beschreiben", "aufzählen / sagen, was passiert"], ["erklären / begründen", "mit Gesetzen / mit Argumenten"], ["skizzieren", "grob zeichnen, Achsen beschriften"]] }
  ];

  const COURSE = { id: "physik", fach: "Physik", title: "Kinematik", sub: "Physik EF · Klausur am Mo 23.11. (3.–4. Std.)", chapters: CH, sheet: SHEET, matrix, exam: "#/mathe/test?f=ph", blitz: "#/mathe/blitz?f=ph", unit: id => "ph-" + id, all: "ph-all" };
  return { svg, curve, axis, niceStep, matrix, CH, SHEET, COURSE, fx };
});
