/* =====================================================================
   LERN-COCKPIT · MATERIAL
   PDFs und Bilder hochladen und jederzeit ansehen (z. B. Merkblatt zur
   Analyse-Struktur). Zeichenblatt zum gestalterischen Arbeiten mit Stift
   oder Finger – wird als Bild im Material gespeichert.
   Speicher: Supabase Storage „material“ + Tabelle „dokumente“ (Migration 006).
   ===================================================================== */
const MAT_BUCKET = "material";
let MAT_FACH = "";
const materialReady = () => (STATE.engineVersion || 0) >= 6;
const docUrl = d => Api.publicUrl(MAT_BUCKET, d.path) + (d.updated_at ? "?v=" + encodeURIComponent(d.updated_at) : "");
const docById = id => ES.docs.find(d => String(d.id) === String(id));
const KIND_LABEL = { pdf: "PDF", bild: "Bild", skizze: "Zeichenblatt" };
const slug = s => String(s || "datei").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "datei";

function materialSetupCard() {
  return '<div class="card"><h2>Material einrichten</h2><p class="hint">Für PDFs und Zeichenblätter braucht die Datenbank einmalig einen Dateispeicher.</p><ol class="steps" style="margin-top:var(--s3)"><li>Supabase → <b>SQL Editor</b> → <b>New query</b></li><li>Inhalt von <code>supabase/migrations/006_material.sql</code> einfügen → <b>Run</b></li><li>Diese Seite neu laden</li></ol></div>';
}
function docTile(d) {
  const thumb = d.kind === "pdf" ? '<div class="doc-ico">' + ICO.doc + '<b>PDF</b></div>' : '<img src="' + esc(docUrl(d)) + '" alt="" loading="lazy">';
  return '<a class="doc-tile" href="#/material/' + esc(d.id) + '"><div class="doc-thumb">' + thumb + '</div><div class="doc-meta"><div class="tn">' + esc(d.title) + '</div><div class="tm">' + esc(KIND_LABEL[d.kind] || "") + (d.fach ? " · " + esc(d.fach) : "") + '</div></div></a>';
}
/** Material einer Prüfung: gleiche Prüfung oder gleiches Fach */
const docsFor = k => ES.docs.filter(d => String(d.exam_ref) === String(k.id) || (d.fach && d.fach === k.fach));

V.material = () => {
  if (!engineReady()) return pageHead("Material") + setupCard();
  if (ROUTE.sub === "zeichnen" || /^zeichnen-/.test(ROUTE.sub)) return sketchView();
  if (ROUTE.sub) return docView(docById(decodeURIComponent(ROUTE.sub)));
  const head = pageHead("Material", { sub: "Merkblätter, PDFs und Zeichenblätter – immer griffbereit.", actions: materialReady() ? '<button class="btn" id="mt_draw">' + ICO.edit + 'Zeichenblatt</button><button class="btn primary" id="mt_up">' + ICO.plus + 'PDF hochladen</button>' : '' });
  if (!materialReady()) return head + materialSetupCard();
  const fachs = [...new Set(ES.docs.map(d => d.fach || "Allgemein"))].sort((a, b) => a.localeCompare(b, "de"));
  const list = ES.docs.filter(d => !MAT_FACH || (d.fach || "Allgemein") === MAT_FACH);
  const seg = fachs.length > 1 ? '<div class="seg" style="margin-bottom:var(--s5)"><button class="' + (!MAT_FACH ? "on" : "") + '" data-mf="">Alle</button>' + fachs.map(f => '<button class="' + (MAT_FACH === f ? "on" : "") + '" data-mf="' + esc(f) + '">' + esc(f) + '</button>').join("") + '</div>' : '';
  const groups = {}; list.forEach(d => (groups[d.fach || "Allgemein"] = groups[d.fach || "Allgemein"] || []).push(d));
  const body = list.length ? Object.keys(groups).sort((a, b) => a.localeCompare(b, "de")).map(f => '<div class="section" style="margin-top:0">' + sectionHead(esc(f)) + '<div class="doc-grid">' + groups[f].map(docTile).join("") + '</div></div>').join("")
    : '<div class="card">' + emptyState("doc", "Noch kein Material", "Lade ein PDF hoch, z. B. dein Merkblatt zur Analyse-Struktur, oder fang ein Zeichenblatt an.", '<button class="btn primary sm" id="mt_up2">PDF hochladen</button> <button class="btn sm" id="mt_draw2">Zeichenblatt</button>') + '</div>';
  return netNotice() + head + seg + body;
};
function bindMaterial() {
  if (ROUTE.sub === "zeichnen" || /^zeichnen-/.test(ROUTE.sub)) return bindSketch();
  if (ROUTE.sub) return bindDocView();
  const q = id => document.getElementById(id);
  ["mt_up", "mt_up2"].forEach(id => { const b = q(id); if (b) b.onclick = () => uploadModal(); });
  ["mt_draw", "mt_draw2"].forEach(id => { const b = q(id); if (b) b.onclick = () => { location.hash = "#/material/zeichnen"; }; });
  document.querySelectorAll("[data-mf]").forEach(b => b.onclick = () => { MAT_FACH = b.dataset.mf; route(); });
}

/* ---------------- Hochladen ---------------- */
function uploadModal(preset) {
  preset = preset || {};
  const fachs = ["Allgemein"].concat(FACHER);
  openModal("PDF oder Bild hochladen", '<div class="form"><label class="fld">Datei<input id="up_file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"></label>' +
    '<label class="fld">Titel<input id="up_title" placeholder="z. B. Struktur einer Analyse" maxlength="120"></label>' +
    '<div class="form c2"><label class="fld">Fach<select id="up_fach">' + fachs.map(f => '<option' + (f === (preset.fach || "Allgemein") ? " selected" : "") + '>' + esc(f) + '</option>').join("") + '</select></label>' +
    '<label class="fld">Zu einer Prüfung (optional)<select id="up_exam"><option value="">—</option>' + upcomingKL().map(k => '<option value="' + esc(k.id) + '"' + (String(preset.exam_ref) === String(k.id) ? " selected" : "") + '>' + esc(k.fach + " · " + (isVocabTest(k) ? vtName(k) : klTitle(k))) + '</option>').join("") + '</select></label></div>' +
    '<p class="hint">PDF, PNG, JPG oder WebP, höchstens 25 MB. Fotos vom Heft gehen auch.</p></div>',
    '<button class="btn" id="up_cancel">Abbrechen</button><button class="btn primary" id="up_go" disabled>Hochladen</button>', () => {
      const q = id => document.getElementById(id);
      q("up_cancel").onclick = closeModal;
      q("up_file").onchange = () => { const f = q("up_file").files[0]; q("up_go").disabled = !f; if (f && !q("up_title").value) q("up_title").value = f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " "); };
      q("up_go").onclick = async () => {
        const f = q("up_file").files[0]; if (!f) return;
        if (f.size > 25 * 1024 * 1024) { toast("Die Datei ist zu groß (höchstens 25 MB).", true); return; }
        const kind = f.type === "application/pdf" ? "pdf" : "bild";
        const title = val("up_title") || f.name; const fach = val("up_fach") === "Allgemein" ? null : val("up_fach");
        const ext = kind === "pdf" ? "pdf" : (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
        const path = (fach ? slug(fach) + "/" : "") + Engine.uuid().slice(0, 8) + "-" + slug(title) + "." + ext;
        const btn = q("up_go"); btn.classList.add("loading");
        try {
          await Api.upload(MAT_BUCKET, path, f, f.type);
          const r = await dbInsert("dokumente", { title, fach, exam_ref: val("up_exam") || null, kind, path, size: f.size, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          await Api.idle(); closeModal(); toast("Hochgeladen"); location.hash = "#/material/" + r.row.id;
        } catch (e) { btn.classList.remove("loading"); toast(e.message || "Hochladen fehlgeschlagen", true); }
      };
    });
}

/* ---------------- Ansehen ---------------- */
function docView(d) {
  if (!d) return pageHead("Material", { back: ["#/material", "Material"] }) + '<div class="card">' + emptyState("doc", "Nicht gefunden", "Vielleicht wurde es gelöscht.") + '</div>';
  const url = docUrl(d);
  const head = pageHead(esc(d.title), { back: ["#/material", "Material"], eyebrow: esc(KIND_LABEL[d.kind] + (d.fach ? " · " + d.fach : "")), actions: (d.kind === "skizze" ? '<a class="btn" href="#/material/zeichnen-' + esc(d.id) + '">' + ICO.edit + 'Weiterzeichnen</a>' : '') + '<a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener">Öffnen</a><button class="btn" id="dv_edit">Umbenennen</button><button class="btn danger" id="dv_del">Löschen</button>' });
  const body = d.kind === "pdf" ? '<div class="pdfview" id="pdfview" data-url="' + esc(url) + '"><div class="pdf-loading"><span class="spinner"></span> PDF wird geladen …</div></div>'
    : '<div class="card imgview"><img src="' + esc(url) + '" alt="' + esc(d.title) + '"></div>';
  return head + body;
}
function bindDocView() {
  const d = docById(decodeURIComponent(ROUTE.sub)); if (!d) return;
  const q = id => document.getElementById(id);
  q("dv_del").onclick = async () => { if (!confirm("„" + d.title + "“ löschen?")) return; try { await dbDelete("dokumente", d.id); Api.removeObject(MAT_BUCKET, d.path); location.hash = "#/material"; toast("Gelöscht"); } catch (e) { toast("Löschen fehlgeschlagen: " + e.message, true); } };
  q("dv_edit").onclick = () => openModal("Umbenennen", '<div class="form"><label class="fld">Titel<input id="rn_t" value="' + esc(d.title) + '"></label><label class="fld">Fach<select id="rn_f">' + ["Allgemein"].concat(FACHER).map(f => '<option' + ((d.fach || "Allgemein") === f ? " selected" : "") + '>' + esc(f) + '</option>').join("") + '</select></label></div>', '<button class="btn" id="rn_c">Abbrechen</button><button class="btn primary" id="rn_s">Speichern</button>', () => {
    q("rn_c").onclick = closeModal;
    q("rn_s").onclick = async () => { await dbPatch("dokumente", d.id, { title: val("rn_t") || d.title, fach: val("rn_f") === "Allgemein" ? null : val("rn_f") }); closeModal(); route(); };
  });
  const pv = q("pdfview"); if (pv) renderPdf(pv, pv.dataset.url);
}
/** PDF mit pdf.js seitenweise rendern (funktioniert auch auf iPad/iPhone); sonst eingebettete Ansicht */
let PDFJS = null;
function loadPdfJs() {
  if (PDFJS) return PDFJS;
  PDFJS = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { if (!window.pdfjsLib) return rej(new Error("pdf.js")); window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(window.pdfjsLib); };
    s.onerror = () => { PDFJS = null; rej(new Error("pdf.js nicht geladen")); };
    document.head.appendChild(s);
  });
  return PDFJS;
}
async function renderPdf(box, url) {
  try {
    const lib = await Promise.race([loadPdfJs(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000))]);
    const pdf = await lib.getDocument(url).promise;
    box.innerHTML = "";
    const width = Math.min(box.clientWidth || 800, 1100); const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (let i = 1; i <= pdf.numPages; i++) {
      if (!document.body.contains(box)) return;   // Seite verlassen
      const page = await pdf.getPage(i); const vp0 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: width / vp0.width * dpr });
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; c.style.width = "100%"; c.className = "pdfpage";
      box.appendChild(c);
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    }
  } catch (e) {
    box.innerHTML = '<iframe class="pdfframe" src="' + esc(url) + '#view=FitH" title="PDF"></iframe><p class="hint" style="margin-top:var(--s3)">Wird nicht alles angezeigt? Tippe oben auf „Öffnen“.</p>';
  }
}

/* ---------------- Zeichenblatt ----------------
   Stift (druckempfindlich mit Apple Pencil), Marker, Radierer, Farben, Rückgängig.
   Gespeichert wird ein PNG im Material; „Weiterzeichnen“ lädt es als Grundlage. */
const SK = { W: 1600, H: 1131 };
let SKETCH = null;
function sketchView() {
  const editId = /^zeichnen-/.test(ROUTE.sub) ? ROUTE.sub.slice(9) : null; const d = editId ? docById(editId) : null;
  if (!materialReady()) return pageHead("Zeichenblatt", { back: ["#/material", "Material"] }) + materialSetupCard();
  const colors = ["#1d1d1f", "#2D5BD7", "#D70015", "#248A3D", "#E8890C", "#8E44AD"];
  return '<a class="backlink" href="#/material">' + ICO.back + 'Material</a>' +
    '<div class="sk-bar"><div class="sk-group" role="group" aria-label="Werkzeug"><button class="sk-t on" data-skt="pen">Stift</button><button class="sk-t" data-skt="marker">Marker</button><button class="sk-t" data-skt="eraser">Radierer</button></div>' +
    '<div class="sk-group">' + colors.map((c, i) => '<button class="sk-c' + (i === 0 ? " on" : "") + '" data-skc="' + c + '" style="--c:' + c + '" aria-label="Farbe"></button>').join("") + '</div>' +
    '<div class="sk-group">' + [["S", 2], ["M", 4], ["L", 9]].map(([l, v], i) => '<button class="sk-t' + (i === 1 ? " on" : "") + '" data-sks="' + v + '">' + l + '</button>').join("") + '</div>' +
    (d ? '' : '<div class="sk-group"><select id="sk_bg" aria-label="Hintergrund"><option value="grid">Kariert</option><option value="lines">Liniert</option><option value="blank">Leer</option></select></div>') +
    '<div class="sk-group"><button class="sk-t" id="sk_undo">Rückgängig</button><button class="sk-t" id="sk_clear">Leeren</button></div>' +
    '<span class="grow"></span><button class="btn primary" id="sk_save">Speichern</button></div>' +
    '<div class="sk-wrap"><canvas id="sk_canvas" width="' + SK.W + '" height="' + SK.H + '"></canvas></div>' +
    '<p class="hint" style="margin-top:var(--s3)">Mit Apple Pencil druckempfindlich. Nutzt du den Stift, werden Finger auf dem Blatt ignoriert (Handballen).</p>';
}
function drawBg(ctx, bg) {
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, SK.W, SK.H);
  if (bg === "blank") return;
  ctx.strokeStyle = "#e3e6ee"; ctx.lineWidth = 1.5; ctx.beginPath();
  const step = 40;
  if (bg === "grid") for (let x = step; x < SK.W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, SK.H); }
  for (let y = bg === "lines" ? 60 : step; y < SK.H; y += bg === "lines" ? 52 : step) { ctx.moveTo(0, y); ctx.lineTo(SK.W, y); }
  ctx.stroke();
}
function bindSketch() {
  const canvas = document.getElementById("sk_canvas"); if (!canvas) return;
  const editId = /^zeichnen-/.test(ROUTE.sub) ? ROUTE.sub.slice(9) : null; const doc = editId ? docById(editId) : null;
  const ctx = canvas.getContext("2d");
  SKETCH = { tool: "pen", color: "#1d1d1f", size: 4, strokes: [], base: null, bg: "grid", penSeen: false, dirty: false };
  const S = SKETCH;
  const redraw = () => {
    if (S.base) ctx.drawImage(S.base, 0, 0, SK.W, SK.H); else drawBg(ctx, S.bg);
    S.strokes.forEach(st => drawStroke(st, 0));
  };
  const style = st => { ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = st.tool === "marker" ? 0.35 : 1; ctx.strokeStyle = st.tool === "eraser" ? "#fff" : st.color; };
  const widthAt = (st, p) => st.tool === "marker" ? st.size * 4 : st.tool === "eraser" ? st.size * 5 : st.size * (st.pen ? 0.35 + p * 1.3 : 1);
  function drawStroke(st, from) {
    const pts = st.pts; style(st);
    if (pts.length === 1) { const [x, y, p] = pts[0]; ctx.beginPath(); ctx.fillStyle = ctx.strokeStyle; ctx.arc(x, y, widthAt(st, p) / 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; return; }
    if (st.tool !== "pen") {
      // Marker/Radierer: gleichmäßige Breite, als ein Pfad (kein Nachdunkeln an den Übergängen)
      ctx.beginPath(); ctx.lineWidth = widthAt(st, 0.5); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], (pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2);
      ctx.stroke(); ctx.globalAlpha = 1; return;
    }
    for (let i = Math.max(1, from); i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1, p1] = pts[i];
      const mx0 = i > 1 ? (pts[i - 2][0] + x0) / 2 : x0, my0 = i > 1 ? (pts[i - 2][1] + y0) / 2 : y0;
      ctx.beginPath(); ctx.lineWidth = widthAt(st, p1);
      ctx.moveTo(mx0, my0); ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const pos = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * SK.W, (e.clientY - r.top) / r.height * SK.H, e.pressure || 0.5]; };
  let cur = null;
  canvas.onpointerdown = e => {
    if (e.pointerType === "pen") S.penSeen = true;
    if (S.penSeen && e.pointerType === "touch") return;   // Handballen ignorieren
    canvas.setPointerCapture(e.pointerId);
    cur = { tool: S.tool, color: S.color, size: S.size, pen: e.pointerType === "pen", pts: [pos(e)] };
    S.strokes.push(cur); S.dirty = true; drawStroke(cur, 0);
  };
  canvas.onpointermove = e => {
    if (!cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const start = cur.pts.length;
    evs.forEach(ev => cur.pts.push(pos(ev)));
    if (cur.tool === "marker") redraw(); else drawStroke(cur, cur.tool === "pen" ? start : 0);
  };
  canvas.onpointerup = canvas.onpointercancel = () => { cur = null; };
  const q = id => document.getElementById(id);
  const on = (sel, el) => { document.querySelectorAll(sel).forEach(x => x.classList.toggle("on", x === el)); };
  document.querySelectorAll("[data-skt]").forEach(b => b.onclick = () => { S.tool = b.dataset.skt; on("[data-skt]", b); });
  document.querySelectorAll("[data-skc]").forEach(b => b.onclick = () => { S.color = b.dataset.skc; on("[data-skc]", b); if (S.tool === "eraser") { S.tool = "pen"; on("[data-skt]", document.querySelector('[data-skt="pen"]')); } });
  document.querySelectorAll("[data-sks]").forEach(b => b.onclick = () => { S.size = +b.dataset.sks; on("[data-sks]", b); });
  const bg = q("sk_bg"); if (bg) bg.onchange = () => { S.bg = bg.value; redraw(); };
  q("sk_undo").onclick = () => { S.strokes.pop(); redraw(); };
  q("sk_clear").onclick = () => { if (S.strokes.length && !confirm("Alles auf dem Blatt löschen?")) return; S.strokes = []; S.base = null; redraw(); };
  q("sk_save").onclick = () => saveSketch(canvas, doc);
  if (doc) {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { S.base = img; redraw(); }; img.onerror = () => { toast("Zeichenblatt konnte nicht geladen werden.", true); redraw(); };
    img.src = docUrl(doc);
  }
  redraw();
}
function saveSketch(canvas, doc) {
  const finish = async (title, fach) => {
    const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
    if (!blob) { toast("Speichern fehlgeschlagen.", true); return; }
    const now = new Date().toISOString();
    try {
      if (doc) {
        await Api.upload(MAT_BUCKET, doc.path, blob, "image/png");
        await dbPatch("dokumente", doc.id, { updated_at: now, size: blob.size });
        SKETCH.dirty = false; toast("Gespeichert"); location.hash = "#/material/" + doc.id;
      } else {
        const path = (fach ? slug(fach) + "/" : "") + Engine.uuid().slice(0, 8) + "-" + slug(title) + ".png";
        await Api.upload(MAT_BUCKET, path, blob, "image/png");
        const r = await dbInsert("dokumente", { title, fach, kind: "skizze", path, size: blob.size, created_at: now, updated_at: now });
        await Api.idle(); SKETCH.dirty = false; closeModal(); toast("Zeichenblatt gespeichert"); location.hash = "#/material/" + r.row.id;
      }
    } catch (e) { toast(e.message || "Speichern fehlgeschlagen", true); }
  };
  if (doc) { finish(doc.title, doc.fach); return; }
  openModal("Zeichenblatt speichern", '<div class="form"><label class="fld">Titel<input id="sv_t" placeholder="z. B. Mindmap Kommunikationsmodelle"></label><label class="fld">Fach<select id="sv_f">' + ["Allgemein"].concat(FACHER).map(f => '<option>' + esc(f) + '</option>').join("") + '</select></label></div>',
    '<button class="btn" id="sv_c">Abbrechen</button><button class="btn primary" id="sv_s">Speichern</button>', () => {
      document.getElementById("sv_c").onclick = closeModal;
      document.getElementById("sv_s").onclick = () => { const t = val("sv_t") || "Zeichenblatt " + new Date().toLocaleDateString("de-DE"); const f = val("sv_f"); document.getElementById("sv_s").classList.add("loading"); finish(t, f === "Allgemein" ? null : f); };
      setTimeout(() => document.getElementById("sv_t").focus(), 50);
    });
}
