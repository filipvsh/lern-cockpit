/* =====================================================================
   LERN-COCKPIT · LOGOS
   50 Motive im Punkt-Raster-Stil (Halbton wie ein Zeitungsfoto),
   ohne Bilddateien: jedes Motiv ist eine kleine Formel, die auf ein
   24×24-Raster gezeichnet und mit einer Bayer-Matrix gerastert wird.
   Das Logo oben links wechselt jeden Tag (Tipp aufs Logo = nächstes).
   ===================================================================== */
const LOGOS = (() => {
  const N = 24, H = Math.hypot, PI = Math.PI, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  /* ---------- Masken (true/false) ---------- */
  const disc = (cx, cy, r) => (x, y) => H(x - cx, y - cy) <= r;
  const ring = (cx, cy, r, t) => (x, y) => { const d = H(x - cx, y - cy); return d <= r && d >= r - t; };
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const ellRing = (cx, cy, rx, ry, t) => (x, y) => { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; return d <= 1 && d >= ((1 - t / Math.min(rx, ry)) ** 2); };
  const box = (cx, cy, w, h) => (x, y) => Math.abs(x - cx) <= w / 2 && Math.abs(y - cy) <= h / 2;
  const seg = (a, b, c, d, t) => (x, y) => { const vx = c - a, vy = d - b; const u = clamp(((x - a) * vx + (y - b) * vy) / (vx * vx + vy * vy || 1)); return H(x - (a + u * vx), y - (b + u * vy)) <= t / 2; };
  const poly = pts => (x, y) => { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  const or = (...m) => (x, y) => m.some(f => f(x, y));
  const and = (a, b) => (x, y) => a(x, y) && b(x, y);
  const not = a => (x, y) => !a(x, y);
  const minus = (a, b) => (x, y) => a(x, y) && !b(x, y);
  const rot = (m, deg, cx = 0, cy = 0) => { const a = -deg * PI / 180, c = Math.cos(a), s = Math.sin(a); return (x, y) => m(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c); };
  const mov = (m, dx, dy) => (x, y) => m(x - dx, y - dy);
  const edge = (m, t = .09) => (x, y) => m(x, y) && !(m(x + t, y) && m(x - t, y) && m(x, y + t) && m(x, y - t) && m(x + t * .7, y + t * .7) && m(x - t * .7, y - t * .7) && m(x + t * .7, y - t * .7) && m(x - t * .7, y + t * .7));
  const arc = (cx, cy, r, t, a0, a1) => (x, y) => { const d = H(x - cx, y - cy); if (d > r || d < r - t) return false; let a = Math.atan2(y - cy, x - cx) * 180 / PI; if (a < 0) a += 360; return a0 <= a1 ? a >= a0 && a <= a1 : a >= a0 || a <= a1; };
  const star = (cx, cy, R, r, n = 5, rotDeg = -90) => poly(Array.from({ length: n * 2 }, (_, i) => { const a = (rotDeg + i * 180 / n) * PI / 180, q = i % 2 ? r : R; return [cx + q * Math.cos(a), cy + q * Math.sin(a)]; }));

  /* ---------- Füllungen: Zahl oder (x,y) → 0..1 ---------- */
  const vg = (y0, y1, a, b) => (x, y) => a + (b - a) * clamp((y - y0) / (y1 - y0));
  const hg = (x0, x1, a, b) => (x, y) => a + (b - a) * clamp((x - x0) / (x1 - x0));
  const rg = (cx, cy, r, a, b) => (x, y) => a + (b - a) * clamp(H(x - cx, y - cy) / r);
  /* F: Maske + Füllung → Schicht (null = nicht getroffen). L: erste getroffene Schicht gewinnt (oben zuerst) */
  const F = (m, v) => (x, y) => m(x, y) ? (typeof v === "function" ? v(x, y) : v) : null;
  const L = (...f) => (x, y) => { for (const g of f) { const r = g(x, y); if (r !== null && r !== undefined) return r; } return 0; };
  /* Hilfsfiguren */
  const solid = (m, v = .9) => L(F(edge(m), 1), F(m, v));
  const flame = (cx, cy, w, h, lean = .1) => (x, y) => { const t = (y - (cy - h / 2)) / h; if (t < 0 || t > 1) return false; const hw = w / 2 * Math.sin(PI * Math.pow(t, .65)); const c = cx + lean * Math.sin(PI * t * 1.2) * (1 - t); return Math.abs(x - c) <= hw; };

  /* ---------- 50 Motive ---------- */
  const M = [];
  const add = (name, fn) => M.push({ name, fn });

  add("Lagerfeuer", L(
    F(edge(or(seg(-.8, .9, .8, .42, .26), seg(.8, .9, -.8, .42, .26)), .07), 1),
    F(or(seg(-.8, .9, .8, .42, .26), seg(.8, .9, -.8, .42, .26)), .55),
    F(flame(0, .12, .3, .5, .06), .2),
    F(edge(flame(0, -.18, .8, 1.2, .2), .08), 1),
    F(flame(0, -.18, .8, 1.2, .2), vg(-.78, .42, .35, .9))));
  add("Berg", L(
    F(disc(.55, -.55, .17), 1),
    F(and(poly([[-.95, .75], [-.25, -.65], [.1, -.15], [.42, -.45], [.95, .75]]), (x, y) => y < -.35 && x < 0), .3),
    F(poly([[-.95, .75], [-.25, -.65], [.1, -.15], [.42, -.45], [.95, .75]]), hg(-.6, .9, .95, .55))));
  add("Mond", L(F(disc(.5, -.55, .035), 1), F(disc(.62, .5, .035), 1), F(minus(disc(-.05, 0, .72), disc(.3, -.18, .62)), rg(-.5, .3, 1.1, 1, .5))));
  add("Sonne", L(F(disc(0, 0, .36), 1), ...Array.from({ length: 8 }, (_, i) => { const a = i * PI / 4; return F(seg(.56 * Math.cos(a), .56 * Math.sin(a), .88 * Math.cos(a), .88 * Math.sin(a), .13), 1); }), F(ring(0, 0, .5, .08), .35)));
  add("Tanne", L(
    F(box(0, .68, .16, .26), .9),
    F(poly([[0, -.9], [-.38, -.3], [.38, -.3]]), vg(-.9, -.3, .55, 1)),
    F(poly([[0, -.55], [-.55, .15], [.55, .15]]), vg(-.55, .15, .55, 1)),
    F(poly([[0, -.15], [-.72, .6], [.72, .6]]), vg(-.15, .6, .55, 1))));
  add("Haus", L(
    F(box(.04, .22, .2, .46), 0), F(box(-.36, .0, .22, .22), .15), F(edge(box(-.36, .0, .22, .22), .06), 1),
    F(box(.04, .3, .2, .46), .1),
    F(or(poly([[-.9, -.1], [0, -.82], [.9, -.1]])), .95),
    F(box(0, .32, 1.5, .8), .55), F(box(.6, -.55, .14, .3), .95)));
  add("Buch", L(
    F(seg(-.02, -.4, -.02, .62, .06), 1),
    F(and(poly([[-.9, -.5], [0, -.32], [0, .62], [-.9, .42]]), not(or(seg(-.7, -.15, -.15, -.05, .06), seg(-.7, .05, -.15, .15, .06), seg(-.7, .25, -.15, .35, .06)))), .75),
    F(and(poly([[.9, -.5], [0, -.32], [0, .62], [.9, .42]]), not(or(seg(.7, -.15, .15, -.05, .06), seg(.7, .05, .15, .15, .06), seg(.7, .25, .15, .35, .06)))), .55),
    F(box(0, .72, 1.8, .06), .9)));
  { const pen = L(F(box(-.72, 0, .22, .5), .35), F(box(-.55, 0, .07, .5), 1), F(box(-.1, 0, 1.0, .5), hg(-.6, .4, .95, .65)), F(box(-.1, 0, 1.0, .08), 0), F(poly([[.4, -.25], [.4, .25], [.88, 0]]), .5), F(poly([[.72, -.09], [.72, .09], [.88, 0]]), 1)); add("Bleistift", (x, y) => pen((-x + y) * .7071, (x + y) * .7071)); }
  add("Glühbirne", L(F(seg(-.12, .0, -.02, -.25, .06), 1), F(seg(.12, .0, .02, -.25, .06), 1), F(box(0, .62, .28, .1), .9), F(box(0, .5, .38, .1), .6), F(box(0, .38, .4, .1), .9), F(poly([[-.22, .08], [.22, .08], [.2, .34], [-.2, .34]]), .6), F(disc(0, -.25, .52), rg(-.15, -.45, .75, 1, .35))));
  { const rk = L(
      F(poly([[-.13, .55], [.13, .55], [0, .98]]), .5),
      F(disc(0, -.22, .1), 0), F(edge(disc(0, -.22, .19), .06), 1),
      F(poly([[-.26, .0], [-.66, .72], [-.26, .46]]), .85), F(poly([[.26, .0], [.66, .72], [.26, .46]]), .85),
      F(poly([[0, -.98], [.24, -.5], [.26, .55], [-.26, .55], [-.24, -.5]]), hg(-.26, .26, 1, .5)));
    const c = Math.cos(PI / 4), sn = Math.sin(PI / 4);
    add("Rakete", (x, y) => rk((x * c + y * sn) * 1.12, (-x * sn + y * c) * 1.12)); }
  add("Planet", (() => { const tilt = (x, y) => { const a = 20 * PI / 180; return { u: x * Math.cos(a) + y * Math.sin(a), v: -x * Math.sin(a) + y * Math.cos(a) }; }; const ringM = (x, y) => { const { u, v } = tilt(x, y); const d = (u / .98) ** 2 + (v / .3) ** 2; return d <= 1 && d >= .7; }; const front = (x, y) => tilt(x, y).v > 0; const pl = disc(0, 0, .46); return L(F(and(ringM, front), 1), F(edge(pl, .07), 1), F(pl, rg(-.2, -.2, .6, .95, .4)), F(ringM, .9)); })());
  { const e = (a) => rot(ellRing(0, 0, .88, .32, .1), a); add("Atom", L(F(disc(0, 0, .15), 1), F(e(0), .9), F(e(60), .9), F(e(120), .9))); }
  add("Kolben", L(
    F(or(disc(-.18, -.05, .07), disc(.1, .2, .06), disc(.2, -.1, .05)), 1),
    F(edge(poly([[-.14, -.85], [.14, -.85], [.14, -.2], [.75, .72], [-.75, .72], [-.14, -.2]]), .09), 1),
    F(poly([[-.4, .25], [.4, .25], [.75, .72], [-.75, .72]]), .62),
    F(box(0, -.85, .5, .08), 1)));
  add("Globus", L(F(or(arc(0, 0, .72, .09, 20, 160)), 0), F(seg(-.42, .88, .42, .88, .1), .9), F(seg(0, .72, 0, .86, .1), .9), F(or(ring(0, -.05, .72, .09), ellRing(0, -.05, .32, .72, .08), seg(-.72, -.05, .72, -.05, .08), seg(-.6, -.38, .6, -.38, .07), seg(-.6, .3, .6, .3, .07)), 1), F(disc(0, -.05, .72), .22)));
  add("Blatt", L(F(seg(-.55, .5, .4, -.45, .06), 0), F(rot(and(disc(-.45, .0, .92), disc(.45, .0, .92)), 45), vg(-.6, .6, .6, 1)), F(seg(-.85, .85, -.45, .45, .1), 1)));
  add("Welle", (x, y) => { for (const o of [-.55, -.05, .45]) if (Math.abs(y - (o + .17 * Math.sin(x * 4.5))) <= .1) return 1; return 0; });
  add("Wolke", L(F(edge(or(disc(-.3, .05, .34), disc(.05, -.2, .45), disc(.42, .08, .3), box(.0, .3, .98, .38)), .08), 1), F(or(disc(-.3, .05, .34), disc(.05, -.2, .45), disc(.42, .08, .3), box(.0, .3, .98, .38)), vg(-.6, .5, .3, .7))));
  add("Blitz", L(F(edge(poly([[.32, -.92], [-.62, .14], [-.06, .14], [-.3, .92], [.62, -.2], [.04, -.2]]), .06), 1), F(poly([[.32, -.92], [-.62, .14], [-.06, .14], [-.3, .92], [.62, -.2], [.04, -.2]]), .75)));
  add("Stern", L(F(edge(star(0, .05, .9, .38), .07), 1), F(star(0, .05, .9, .38), rg(0, 0, .9, .35, .8))));
  add("Herz", (x, y) => { const u = x * 1.28, v = -y * 1.28 + .1; const w = (u * u + v * v - 1) ** 3 - u * u * v ** 3; if (w > 0) return 0; const e = ((u * 1.03) ** 2 + (v * 1.03) ** 2 - 1) ** 3 - (u * 1.03) ** 2 * (v * 1.03) ** 3; return e > 0 ? 1 : .55 + .35 * clamp((x + .8) / 1.6) * 0; });
  add("Tasse", L(
    F(or(arc(.12, -.78, .12, .07, 0, 360)), 1),
    F(or(seg(-.05, -.78, -.05, -.62, .06), seg(.2, -.82, .2, -.62, .06)), .55),
    F(minus(ringM2(.52, .1, .3), box(.25, .1, .5, 1)), 1),
    F(poly([[-.55, -.4], [.5, -.4], [.4, .55], [-.45, .55]]), (x, y) => y < -.3 ? .15 : hg(-.5, .5, .95, .6)(x, y)),
    F(box(-.03, .62, 1.0, .08), .9)));
  function ringM2(cx, cy, r) { return (x, y) => { const d = H(x - cx, y - cy); return d <= r && d >= r - .1; }; }
  add("Schlüssel", L(F(disc(-.5, -.0, .12), 0), F(ring(-.5, 0, .36, .13), 1), F(seg(-.14, 0, .85, 0, .12), .95), F(box(.55, .15, .1, .22), .9), F(box(.76, .15, .1, .3), .9)));
  add("Uhr", L(F(seg(0, 0, 0, -.45, .09), 1), F(seg(0, 0, .32, .12, .09), 1), F(disc(0, 0, .06), 1), F(or(...Array.from({ length: 12 }, (_, i) => { const a = i * PI / 6; return seg(.62 * Math.cos(a), .62 * Math.sin(a), .72 * Math.cos(a), .72 * Math.sin(a), .07); })), 1), F(ring(0, 0, .86, .1), 1), F(disc(0, 0, .86), .12)));
  add("Kompass", L(F(rot(poly([[0, -.62], [.14, 0], [0, .62], [-.14, 0]]), 40), (x, y) => { const a = -40 * PI / 180, u = x * Math.cos(a) - y * Math.sin(a); return u > 0 ? .5 : 1; }), F(disc(0, 0, .05), 0), F(ring(0, 0, .86, .1), 1), F(or(box(0, -.76, .06, .16), box(0, .76, .06, .16), box(.76, 0, .16, .06), box(-.76, 0, .16, .06)), .9), F(disc(0, 0, .86), .14)));
  add("Zelt", L(F(poly([[0, -.5], [-.14, .58], [.14, .58]]), 0), F(poly([[0, -.5], [-.24, .58], [.24, .58]]), .0), F(poly([[0, -.55], [-.9, .62], [.9, .62]]), hg(-.9, .9, .95, .55)), F(seg(0, -.55, 0, -.85, .07), 1), F(box(0, .72, 1.9, .07), .9)));
  add("Leuchtturm", L(
    F(or(seg(.15, -.55, .9, -.8, .08), seg(.15, -.5, .9, -.45, .08), seg(-.15, -.55, -.9, -.8, .08), seg(-.15, -.5, -.9, -.45, .08)), .55),
    F(poly([[-.18, -.7], [0, -.9], [.18, -.7]]), 1), F(box(0, -.57, .26, .22), .35),
    F(and(poly([[-.22, -.4], [.22, -.4], [.38, .7], [-.38, .7]]), (x, y) => (y > -.1 && y < .1) || (y > .35 && y < .55)), .35),
    F(poly([[-.22, -.4], [.22, -.4], [.38, .7], [-.38, .7]]), .95), F(box(0, .78, 1.0, .08), .9)));
  add("Pilz", L(F(or(disc(-.3, -.35, .09), disc(.25, -.15, .08), disc(.0, -.58, .07)), 0), F(and(ell(0, .05, .9, .72), (x, y) => y < .05), vg(-.7, .05, .95, .6)), F(box(0, .38, .34, .56), hg(-.17, .17, .95, .6)), F(box(0, .08, 1.8, .06), 0)));
  add("Kaktus", L(F(poly([[-.3, .5], [.3, .5], [.22, .88], [-.22, .88]]), .85), F(box(0, -.1, .34, 1.2), hg(-.17, .17, 1, .6)), F(or(box(-.38, -.15, .28, .12), box(-.5, -.4, .12, .5)), hg(-.6, -.25, 1, .7)), F(or(box(.38, .1, .28, .12), box(.5, -.18, .12, .5)), hg(.25, .6, .7, 1))));
  add("Fisch", L(F(disc(-.4, -.08, .06), 0), F(disc(-.4, -.08, .1), 1), F(poly([[.35, 0], [.9, -.38], [.9, .38]]), .85), F(poly([[-.1, -.4], [.2, -.62], [.28, -.3]]), .7), F(ell(-.1, 0, .62, .4), vg(-.4, .4, .5, 1))));
  add("Vogel", L(F(disc(.62, -.62, .14), 1), F(or(seg(-.9, -.1, -.45, -.5, .15), seg(-.45, -.5, 0, .05, .15), seg(0, .05, .45, -.5, .15), seg(.45, -.5, .9, -.1, .15)), 1), F(or(seg(-.5, .5, -.25, .3, .1), seg(-.25, .3, 0, .55, .1), seg(0, .55, .25, .3, .1), seg(.25, .3, .5, .5, .1)), .8)));
  add("Schmetterling", L(F(or(seg(0, -.3, -.28, -.75, .05), seg(0, -.3, .28, -.75, .05)), 1), F(ell(0, .0, .08, .55), 1), F(edge(or(ell(-.5, -.28, .42, .34), ell(.5, -.28, .42, .34), ell(-.4, .38, .3, .26), ell(.4, .38, .3, .26)), .07), 1), F(or(disc(-.55, -.3, .12), disc(.55, -.3, .12)), 1), F(or(ell(-.5, -.28, .42, .34), ell(.5, -.28, .42, .34)), .45), F(or(ell(-.4, .38, .3, .26), ell(.4, .38, .3, .26)), .4)));
  add("Anker", L(F(ring(0, -.68, .2, .08), 1), F(seg(0, -.5, 0, .72, .1), 1), F(seg(-.32, -.28, .32, -.28, .09), 1), F(arc(0, .2, .72, .1, 10, 170), 1), F(or(poly([[-.72, .22], [-.5, .0], [-.5, .3]]), poly([[.72, .22], [.5, .0], [.5, .3]])), 1)));
  add("Kerze", L(F(flame(0, -.6, .26, .5, .06), (x, y) => y > -.5 ? .3 : 1), F(seg(0, -.34, 0, -.26, .05), 1), F(box(0, .22, .46, .86), hg(-.23, .23, .95, .55)), F(box(0, .72, .9, .08), .9), F(or(seg(-.22, -.1, .22, -.1, .0)), 0)));
  add("Diamant", L(F(edge(poly([[-.4, -.7], [.4, -.7], [.88, -.2], [0, .85], [-.88, -.2]]), .06), 1), F(or(seg(-.88, -.2, .88, -.2, .06), seg(-.4, -.7, -.18, -.2, .06), seg(.4, -.7, .18, -.2, .06), seg(-.18, -.2, 0, .85, .06), seg(.18, -.2, 0, .85, .06)), .95), F(poly([[-.4, -.7], [.4, -.7], [.88, -.2], [0, .85], [-.88, -.2]]), (x, y) => y < -.2 ? .35 : .65)));
  add("Zahnrad", L(F(disc(0, 0, .2), 0), F(or(disc(0, 0, .72), ...Array.from({ length: 8 }, (_, i) => rot(box(0, -.78, .3, .36), i * 45))), rg(0, 0, .9, .6, 1))));
  add("Schneeflocke", (() => { const arm = or(seg(0, 0, 0, -.88, .1), seg(0, -.45, -.3, -.7, .08), seg(0, -.45, .3, -.7, .08), seg(0, -.2, -.2, -.38, .07), seg(0, -.2, .2, -.38, .07)); return L(F(disc(0, 0, .1), 1), ...[0, 60, 120, 180, 240, 300].map(a => F(rot(arm, a), 1))); })());
  add("Regenschirm", L(F(or(disc(-.3, .78, .05), disc(.55, .6, .05), disc(.3, .85, .05)), 1), F(or(arc(.1, .5, .2, .08, 180, 360), seg(.1, -.05, .1, .5, .08)), 1), F(and(disc(0, -.1, .88), (x, y) => y < -.05), vg(-.9, -.05, .5, 1)), F(or(disc(-.45, -.04, .13), disc(-.0, -.04, .13), disc(.45, -.04, .13)), 0)));
  add("Sanduhr", L(F(or(box(0, -.82, .9, .09), box(0, .82, .9, .09)), 1), F(poly([[-.36, .75], [.36, .75], [.12, .4], [-.12, .4]]), .95), F(poly([[-.36, -.75], [.36, -.75], [.04, -.05], [-.04, -.05]]), (x, y) => y < -.45 ? .15 : .9), F(edge(poly([[-.36, -.75], [.36, -.75], [.04, 0], [.36, .75], [-.36, .75], [-.04, 0]]), .07), 1)));
  add("Lupe", L(F(seg(.32, .32, .85, .85, .17), 1), F(ring(-.14, -.14, .56, .13), 1), F(disc(-.14, -.14, .56), .22)));
  add("Kopfhörer", L(F(or(ell(-.7, .15, .17, .34), ell(.7, .15, .17, .34)), .95), F(arc(0, .12, .7, .13, 180, 360), 1), F(or(box(-.7, .05, .06, .26), box(.7, .05, .06, .26)), .0)));
  add("Würfel", L(
    F(poly([[0, -.85], [.75, -.42], [0, .0], [-.75, -.42]]), .3),
    F(edge(poly([[0, -.85], [.75, -.42], [.75, .45], [0, .88], [-.75, .45], [-.75, -.42]]), .06), 1),
    F(or(seg(0, 0, 0, .88, .06), seg(0, 0, .75, -.42, .06), seg(0, 0, -.75, -.42, .06)), 1),
    F(poly([[0, 0], [.75, -.42], [.75, .45], [0, .88]]), .5), F(poly([[0, 0], [-.75, -.42], [-.75, .45], [0, .88]]), .95)));
  add("Pyramide", L(F(poly([[0, -.8], [.9, .62], [.12, .38]]), .45), F(poly([[0, -.8], [.12, .38], [-.9, .62]]), .95), F(edge(poly([[0, -.8], [.9, .62], [-.9, .62]]), .06), 1)));
  add("Spirale", (x, y) => { const r = H(x, y), a = Math.atan2(y, x); const s = r / .3 - a / (2 * PI); const f = s - Math.floor(s); return r < .92 && (f < .48 || r < .08) ? 1 : 0; });
  add("Sinuskurve", L(F(or(seg(-.9, 0, .9, 0, .06), seg(-.8, -.8, -.8, .8, .06)), .85), F((x, y) => Math.abs(y + .5 * Math.sin((x + .8) * 4.4)) <= .1 && x > -.8, 1)));
  add("Parabel", L(F(disc(0, .62, .1), 1), F((x, y) => Math.abs(y - (.62 - 1.5 * x * x)) <= .1 && Math.abs(x) < .85, 1), F(or(seg(-.9, -.1, .9, -.1, .06), seg(0, -.88, 0, .88, .06)), .65)));
  add("Waage", L(F(or(seg(0, -.7, 0, .72, .09), box(0, .8, .6, .09), seg(-.7, -.5, .7, -.5, .09)), 1), F(or(disc(0, -.7, .1)), 1), F(or(seg(-.7, -.5, -.9, .12, .05), seg(-.7, -.5, -.5, .12, .05), seg(.7, -.5, .9, .12, .05), seg(.7, -.5, .5, .12, .05)), .8), F(or(and(disc(-.7, .1, .27), (x, y) => y > .1), and(disc(.7, .1, .27), (x, y) => y > .1)), .85)));
  add("Taschenrechner", L(
    F(or(...[-.3, 0, .3].flatMap(cx => [.0, .26, .52].map(cy => disc(cx, cy, .09)))), 1),
    F(box(0, -.46, .56, .22), .2), F(edge(box(0, -.46, .56, .22), .05), 1),
    F(edge(box(0, 0, .96, 1.7), .08), 1), F(box(0, 0, .96, 1.7), .35)));
  add("Eule", L(F(poly([[-.06, 0], [.06, 0], [0, .16]]), 1), F(or(disc(-.28, -.18, .08), disc(.28, -.18, .08)), 1), F(or(disc(-.28, -.18, .26), disc(.28, -.18, .26)), 0), F(or(ring(-.28, -.18, .29, .07), ring(.28, -.18, .29, .07)), 1), F(or(poly([[-.52, -.5], [-.56, -.88], [-.26, -.66]]), poly([[.52, -.5], [.56, -.88], [.26, -.66]])), 1), F(ell(0, .5, .22, .26), .25), F(ell(0, .06, .6, .82), .85), F(or(seg(-.34, .88, -.34, .98, .08), seg(.34, .88, .34, .98, .08)), 1)));
  add("Tulpe", L(F(poly([[-.4, -.62], [-.16, -.22], [0, -.68], [.16, -.22], [.4, -.62], [.44, .02], [.22, .34], [-.22, .34], [-.44, .02]]), hg(-.45, .45, 1, .6)), F(seg(0, .3, 0, .9, .1), 1), F(or(ell(-.34, .58, .3, .12), ell(.34, .5, .3, .12)), .8)));
  add("Brücke", L(
    F(or(arc(-.46, .5, .4, .14, 180, 360), arc(.46, .5, .4, .14, 180, 360), box(-.9, .5, .1, .5), box(0, .5, .1, .5), box(.9, .5, .1, .5)), 1),
    F(box(0, .0, 1.9, .16), 1), F(or(seg(-.9, -.35, -.9, 0, .07), seg(.9, -.35, .9, 0, .07), seg(-.9, -.35, .9, -.35, .06)), .85),
    F((x, y) => y > .74 && Math.abs(y - (.84 + .05 * Math.sin(x * 6))) <= .06, 1)));

  /* ---------- Rastern ---------- */
  function dots(i) {
    const f = M[i % M.length].fn, out = [];
    for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
      const x = ((gx + .5) / N * 2 - 1) * 1.0, y = ((gy + .5) / N * 2 - 1) * 1.0;
      const v = f(x, y); if (v > 0 && v > (BAYER[gy % 4][gx % 4] + .5) / 16 * .9) out.push([gx, gy]);
    }
    return out;
  }
  const cache = {};
  function svg(i, size) {
    i = ((i % M.length) + M.length) % M.length;
    const d = cache[i] || (cache[i] = dots(i).map(([x, y]) => "M" + (x + .5) + " " + y + "a.5 .5 0 1 0 .01 0z").join(""));
    return '<svg viewBox="0 0 ' + N + " " + N + '" width="' + (size || 40) + '" height="' + (size || 40) + '" fill="currentColor" role="img" aria-label="Logo: ' + M[i].name + '"><path d="' + d + '"/></svg>';
  }
  const dayIndex = (iso) => { const d = iso ? new Date(iso + "T12:00:00") : new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 864e5); };
  return { count: M.length, names: M.map(m => m.name), svg, today: (iso) => ((dayIndex(iso) % M.length) + M.length) % M.length };
})();
if (typeof module !== "undefined") module.exports = LOGOS;
