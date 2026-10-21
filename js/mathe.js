/* =====================================================================
   LERN-COCKPIT · MATHE OHNE TIPPEN
   Graphen-Quiz zu Potenzfunktionen: Graph sehen → passende Funktion antippen.
   Graphen als SVG (keine Bibliothek). Rein bis auf graphSvg (liefert HTML).
   ===================================================================== */
const GRAPH_FUNCS = [
  { id: "x2", label: "f(x) = x²", f: x => x * x, why: "Gerader Exponent: U-Form, achsensymmetrisch zur y-Achse, geht durch (0|0) und (1|1)." },
  { id: "x3", label: "f(x) = x³", f: x => x ** 3, why: "Ungerader Exponent: von links unten nach rechts oben, punktsymmetrisch zum Ursprung." },
  { id: "x4", label: "f(x) = x⁴", f: x => x ** 4, why: "Gerader Exponent, flacher um 0 als x² und dann steiler – achsensymmetrisch." },
  { id: "x5", label: "f(x) = x⁵", f: x => x ** 5, why: "Ungerader Exponent: punktsymmetrisch, um 0 sehr flach." },
  { id: "-x2", label: "f(x) = −x²", f: x => -x * x, why: "Minus vor x²: an der x-Achse gespiegelt – nach unten geöffnet." },
  { id: "-x3", label: "f(x) = −x³", f: x => -(x ** 3), why: "Minus vor x³: von links oben nach rechts unten." },
  { id: "05x2", label: "f(x) = 0,5·x²", f: x => 0.5 * x * x, why: "Faktor 0,5 staucht: breitere U-Form, geht durch (2|2)." },
  { id: "2x2", label: "f(x) = 2·x²", f: x => 2 * x * x, why: "Faktor 2 streckt: schmalere U-Form, geht durch (1|2)." },
  { id: "x-1", label: "f(x) = x⁻¹ = 1/x", f: x => 1 / x, why: "Negativer ungerader Exponent: Hyperbel in 1. und 3. Quadrant, punktsymmetrisch, x ≠ 0." },
  { id: "x-2", label: "f(x) = x⁻² = 1/x²", f: x => 1 / (x * x), why: "Negativer gerader Exponent: beide Äste oben (1. und 2. Quadrant), achsensymmetrisch." },
  { id: "x-3", label: "f(x) = x⁻³ = 1/x³", f: x => 1 / x ** 3, why: "Wie 1/x, aber für |x| > 1 schneller an der x-Achse: punktsymmetrisch." },
  { id: "-x-1", label: "f(x) = −1/x", f: x => -1 / x, why: "Gespiegeltes 1/x: Äste im 2. und 4. Quadranten." },
  { id: "x2p1", label: "f(x) = x² + 1", f: x => x * x + 1, why: "+1 hinten: um 1 nach oben verschoben, Scheitel (0|1)." },
  { id: "xm2_2", label: "f(x) = (x − 2)²", f: x => (x - 2) ** 2, why: "(x − 2): um 2 nach rechts verschoben, Scheitel (2|0)." },
  { id: "xp1_3", label: "f(x) = (x + 1)³", f: x => (x + 1) ** 3, why: "(x + 1): um 1 nach links verschoben – Wendepunkt bei (−1|0)." },
  { id: "x-2m1", label: "f(x) = 1/x² − 1", f: x => 1 / (x * x) - 1, why: "1/x² um 1 nach unten: Äste nähern sich y = −1." }
];
/** Graph als SVG: x von −3 bis 3, y von −4 bis 4, Lücken an Polstellen */
let GRAPH_N = 0;
function graphSvg(fn, o) {
  o = o || {}; const cid = "gc" + (++GRAPH_N); const W = 300, H = 300, X0 = -3, X1 = 3, Y0 = -4, Y1 = 4;
  const sx = x => (x - X0) / (X1 - X0) * W, sy = y => H - (y - Y0) / (Y1 - Y0) * H;
  let grid = "";
  for (let x = Math.ceil(X0); x <= X1; x++) grid += '<line x1="' + sx(x) + '" y1="0" x2="' + sx(x) + '" y2="' + H + '" class="g' + (x === 0 ? " ax" : "") + '"/>' + (x && x > X0 ? '<text x="' + (sx(x) - 3) + '" y="' + (sy(0) + 13) + '">' + x + '</text>' : "");
  for (let y = Math.ceil(Y0); y <= Y1; y++) grid += '<line x1="0" y1="' + sy(y) + '" x2="' + W + '" y2="' + sy(y) + '" class="g' + (y === 0 ? " ax" : "") + '"/>' + (y && y < Y1 && y > Y0 ? '<text x="' + (sx(0) + 4) + '" y="' + (sy(y) + 4) + '">' + y + '</text>' : "");
  let d = "", pen = false, prev = null;
  for (let i = 0; i <= 600; i++) {
    const x = X0 + (X1 - X0) * i / 600; const y = fn(x);
    const ok = isFinite(y) && Math.abs(y) < 40 && !(prev != null && Math.sign(prev) !== Math.sign(y) && Math.abs(y - prev) > 8);
    if (!ok) { pen = false; prev = isFinite(y) ? y : null; continue; }
    const cy = Math.max(-12, Math.min(12, y));
    d += (pen ? "L" : "M") + sx(x).toFixed(1) + " " + sy(cy).toFixed(1); pen = Math.abs(y) < 12; prev = y;
  }
  return '<svg class="graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (o.label || "Funktionsgraph") + '"><defs><clipPath id="' + cid + '"><rect width="' + W + '" height="' + H + '"/></clipPath></defs>' + grid +
    '<text x="' + (W - 10) + '" y="' + (sy(0) - 6) + '" class="axl">x</text><text x="' + (sx(0) + 6) + '" y="12" class="axl">y</text><path d="' + d + '" class="curve" clip-path="url(#' + cid + ')"/></svg>';
}
/** Quiz-Runde: Ziel + 3 Ablenker (nach Möglichkeit aus derselben Familie) */
function graphRound(rng) {
  const r = rng || Math.random; const mix = a => a.map(x => [r(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
  const target = GRAPH_FUNCS[Math.floor(r() * GRAPH_FUNCS.length)];
  const neg = id => /-[123]/.test(id) || id === "x-2m1";
  const near = mix(GRAPH_FUNCS.filter(f => f.id !== target.id && neg(f.id) === neg(target.id)));
  const far = mix(GRAPH_FUNCS.filter(f => f.id !== target.id && neg(f.id) !== neg(target.id)));
  const opts = mix([target].concat(near.slice(0, 2), far.slice(0, 1)));
  return { target, opts, correct: opts.indexOf(target) };
}
if (typeof module === "object" && module.exports) module.exports = { GRAPH_FUNCS, graphRound, graphSvg };
