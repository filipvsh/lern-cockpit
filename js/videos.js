/* =====================================================================
   LERN-COCKPIT · LERNVIDEOS ZUM ABHAKEN
   Erklärvideos je Klausur (nach Fach und Thema), angetippt öffnet YouTube.
   „Gesehen“ in einstellungen.videos_gesehen = { Video-ID: Datum }, +5 XP.
   ch: Kanal nur, wenn sicher bekannt.
   ===================================================================== */
const VIDEO_SETS = [
  { fach: /^(Vert\. )?Mathe$/, thema: /potenz|exponent|funktion|graph/i, title: "Potenzen & Potenzfunktionen", videos: [
    { id: "Oo7gFQoG16c", t: "Potenzen – Grundlagen, Basis, Exponent, Potenzgesetze" },
    { id: "K9GV9OLIaX0", t: "Potenzen multiplizieren – ganz einfach erklärt" },
    { id: "TFFIjonEL4c", t: "Potenzen dividieren (gleiche Basis / gleicher Exponent)" },
    { id: "rJVfaCia0Ng", t: "Potenzen potenzieren – ganz einfach erklärt" },
    { id: "vnOCrWbZbX4", t: "Warum ist x hoch 0 = 1?" },
    { id: "0mZzbYLarGQ", t: "Potenzen mit negativen Exponenten berechnen", ch: "Lehrerschmidt" },
    { id: "nqYb7y3N3wQ", t: "Potenzfunktionen: Symmetrie, Monotonie, Definitions- und Wertebereich" },
    { id: "Skzjv2yp2a0", t: "Potenzfunktionen: gerade und ungerade Exponenten" },
    { id: "HYXhkAV0yQw", t: "Potenzfunktionen grafisch: positive und negative Exponenten" },
    { id: "iDoPrgyGeCQ", t: "Potenzfunktionen mit negativen Exponenten (Hyperbeln)" },
    { id: "qdxI7cl49Ps", t: "Funktion verschieben, strecken, spiegeln" }
  ] },
  { fach: /^Französisch$/, title: "Französisch: Kleidung & Grammatik", videos: [
    { id: "wzkALirMl9Y", t: "Die Kleidungsstücke (les vêtements)" },
    { id: "OKHtk9fdbvs", t: "Vocabulaire : les vêtements – über 40 Wörter" },
    { id: "Fi4Nr1gFfUo", t: "Angleichung des französischen Adjektivs" },
    { id: "1OKv4KuGZq0", t: "Farbadjektive: wann angleichen, wann nicht" },
    { id: "pjOjyaG7L6U", t: "Stellung der Adjektive" },
    { id: "Mf38QT24CJ8", t: "Verben auf -er: Bildung und Gebrauch" },
    { id: "YY3O3nanKas", t: "Das Verb „acheter“" },
    { id: "I7jky229jv4", t: "Das Verb „préférer“ mit Aussprache" }
  ] }
];
const videoSeen = () => setting("videos_gesehen", {}) || {};
/** Videos zu einer Klausur (Fach + passendes Thema, sonst alle des Fachs) */
function videosFor(k) {
  const txt = (k.thema || "") + " " + topicsOfExam(k.id).filter(t => t.status !== "paused").map(t => t.title).join(" ");
  return VIDEO_SETS.filter(s => s.fach.test(k.fach) && (!s.thema || s.thema.test(txt)));
}
function videoProgress(k) { const all = videosFor(k).flatMap(s => s.videos); const seen = videoSeen(); return { n: all.length, seen: all.filter(v => seen[v.id]).length }; }
function videoList(k) {
  const sets = videosFor(k); const seen = videoSeen();
  if (!sets.length) return '<div class="card">' + emptyState("play", "Noch keine Videos", "Für dieses Fach habe ich noch keine Erklärvideos hinterlegt.") + '</div>';
  return sets.map(s => { const done = s.videos.filter(v => seen[v.id]).length;
    return '<div class="card vid-set"><div class="km-row-h"><h2 style="margin:0">' + esc(s.title) + '</h2><span class="vid-count">' + done + '/' + s.videos.length + '</span></div>' + progBar(Math.round(done / s.videos.length * 100), done === s.videos.length ? "g" : "") +
      '<p class="hint">Antippen öffnet YouTube. Danach abhaken – so siehst du, was noch fehlt. <a href="https://www.youtube.com/watch_videos?video_ids=' + s.videos.map(v => v.id).join(",") + '" target="_blank" rel="noopener">Alle als Playlist</a></p>' +
      '<div class="vid-list">' + s.videos.map((v, i) => '<div class="vid' + (seen[v.id] ? " seen" : "") + '"><a class="vid-a" href="https://www.youtube.com/watch?v=' + esc(v.id) + '" target="_blank" rel="noopener"><img loading="lazy" onerror="this.remove()" src="https://i.ytimg.com/vi/' + esc(v.id) + '/mqdefault.jpg" alt=""><span class="vid-t"><span class="vid-n">' + (i + 1) + '</span>' + esc(v.t) + (v.ch ? '<span class="t-sub"> · ' + esc(v.ch) + '</span>' : '') + '</span></a>' +
        '<button class="vid-chk" data-vid="' + esc(v.id) + '" aria-label="' + (seen[v.id] ? "Als nicht gesehen markieren" : "Als gesehen abhaken") + '">' + (seen[v.id] ? "✓" : "") + '</button></div>').join("") + '</div></div>'; }).join("");
}
function bindVideos() {
  document.querySelectorAll("[data-vid]").forEach(b => b.onclick = async () => {
    const id = b.dataset.vid; const m = Object.assign({}, videoSeen()); const was = !!m[id];
    if (was) delete m[id]; else m[id] = todayISO();
    await setSetting("videos_gesehen", m); if (!was) addXP(5);
    route();
  });
}
