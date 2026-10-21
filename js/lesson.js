/* =====================================================================
   LERN-COCKPIT · LEKTION (Duolingo-Stil) – Daten und reine Logik
   Aufgabentypen: Bild wählen · Übersetzung wählen (beide Richtungen) ·
   Paare finden · Lücke füllen · Satz bauen (Wortbank) · Hören und bauen.
   Fehler kommen am Ende der Lektion noch einmal. Getestet in
   tests/engine.test.js. Sätze: Klausur „Les vêtements“; „key“ = Begriff
   der Karte (wie in der Sammlung), gap = Wort im Satz, opts = Ablenker.
   ===================================================================== */
(function (root, factory) {
  const L = factory();
  if (typeof module === "object" && module.exports) module.exports = L;
  else root.LESSON = L;
})(typeof self !== "undefined" ? self : this, function () {
  const S = (fr, de, key, gap, opts) => ({ fr, de, key, gap, opts });
  const SENTENCES = [
    S("Je porte un pantalon noir.", "Ich trage eine schwarze Hose.", "porter", "porte", ["portes", "portons", "portent"]),
    S("Elle porte une robe rouge.", "Sie trägt ein rotes Kleid.", "la robe", "robe", ["jupe", "chemise", "casquette"]),
    S("Tu mets ton pull bleu ?", "Ziehst du deinen blauen Pullover an?", "mettre", "mets", ["met", "mettons", "mettent"]),
    S("Nous achetons des baskets blanches.", "Wir kaufen weiße Turnschuhe.", "acheter", "achetons", ["achète", "achetez", "achètent"]),
    S("Il cherche une casquette grise.", "Er sucht eine graue Kappe.", "gris / grise", "grise", ["gris", "grises", "noir"]),
    S("J'essaie la jupe verte.", "Ich probiere den grünen Rock an.", "vert / verte", "verte", ["vert", "verts", "vertes"]),
    S("Le jean coûte quarante euros.", "Die Jeans kostet vierzig Euro.", "coûter", "coûte", ["coûtent", "coûtes", "coûtons"]),
    S("Le manteau est trop cher.", "Der Mantel ist zu teuer.", "cher / chère", "cher", ["chère", "chers", "chères"]),
    S("Ce t-shirt n'est pas cher.", "Dieses T-Shirt ist nicht teuer.", "le t-shirt", "t-shirt", ["manteau", "pantalon", "short"]),
    S("Je préfère le style décontracté.", "Ich mag den lockeren Stil lieber.", "préférer", "préfère", ["préférons", "préfèrent", "préférez"]),
    S("Mon anorak est très confortable.", "Meine Jacke ist sehr bequem.", "confortable", "confortable", ["cher", "classique", "simple"]),
    S("Vous payez par carte ?", "Zahlen Sie mit Karte?", "payer", "payez", ["paie", "payons", "paient"]),
    S("Elle aime les vêtements chics.", "Sie mag schicke Kleidung.", "aimer", "aime", ["aimes", "aimons", "aiment"]),
    S("Ils veulent acheter des chaussures.", "Sie wollen Schuhe kaufen.", "vouloir", "veulent", ["veut", "voulons", "voulez"]),
    S("J'ai une chemise blanche.", "Ich habe ein weißes Hemd.", "blanc / blanche", "blanche", ["blanc", "blancs", "blanches"]),
    S("Le short est jaune.", "Die Shorts sind gelb.", "un short", "short", ["pull", "jean", "manteau"]),
    S("Elle a un style sportif.", "Sie hat einen sportlichen Stil.", "sportif / sportive", "sportif", ["sportive", "sportifs", "sportives"]),
    S("Ton pull est très original.", "Dein Pullover ist sehr originell.", "original / originale", "original", ["originale", "originaux", "originales"]),
    S("Je cherche un manteau élégant.", "Ich suche einen eleganten Mantel.", "chercher", "cherche", ["cherches", "cherchons", "cherchent"]),
    S("La chemise est rose et violette.", "Das Hemd ist rosa und lila.", "violet / violette", "violette", ["violet", "violets", "violettes"]),
    S("Il porte un jean et des baskets.", "Er trägt eine Jeans und Turnschuhe.", "des baskets", "baskets", ["chemises", "robes", "jupes"]),
    S("Tu préfères la robe ou la jupe ?", "Magst du lieber das Kleid oder den Rock?", "la jupe", "jupe", ["chemise", "casquette", "chaussure"]),
    S("Les chaussures marron sont modernes.", "Die braunen Schuhe sind modern.", "des chaussures", "chaussures", ["chemises", "casquettes", "jupes"]),
    S("Je vais essayer le pantalon gris.", "Ich werde die graue Hose anprobieren.", "essayer", "essayer", ["acheter", "payer", "chercher"]),
    S("Ça coûte combien ?", "Wie viel kostet das?", "coûter", "coûte", ["coûtent", "coûtes", "coûtons"]),
    S("Le pull beige est classique.", "Der beige Pullover ist klassisch.", "classique", "classique", ["chère", "simple", "sportive"]),
    S("Ma robe noire est élégante.", "Mein schwarzes Kleid ist elegant.", "noir / noire", "noire", ["noir", "noirs", "noires"]),
    S("Vous voulez essayer la chemise ?", "Wollen Sie das Hemd anprobieren?", "la chemise", "chemise", ["robe", "jupe", "casquette"]),
    S("Ils portent des t-shirts verts.", "Sie tragen grüne T-Shirts.", "porter", "portent", ["porte", "portons", "portez"]),
    S("Le magasin est cool.", "Das Geschäft ist cool.", "le magasin", "magasin", ["prix", "manteau", "jean"]),
    S("Elles cherchent des jupes bleues.", "Sie suchen blaue Röcke.", "bleu / bleue", "bleues", ["bleu", "bleus", "bleue"]),
    S("Je paie le manteau.", "Ich bezahle den Mantel.", "un manteau", "manteau", ["pull", "short", "jean"]),
    S("Quel est le prix de la robe ?", "Was kostet das Kleid?", "le prix", "prix", ["magasin", "style", "short"]),
    S("Nous allons au magasin.", "Wir gehen ins Geschäft.", "aller", "allons", ["vais", "allez", "vont"]),
    S("J'ai des chaussures confortables.", "Ich habe bequeme Schuhe.", "avoir", "ai", ["as", "a", "ont"]),
    S("Elle met une casquette orange.", "Sie setzt eine orange Kappe auf.", "une casquette", "casquette", ["chemise", "robe", "jupe"]),
    S("Ce pantalon est simple mais chic.", "Diese Hose ist einfach, aber schick.", "chic", "chic", ["cher", "gris", "cool"]),
    S("La robe est moderne.", "Das Kleid ist modern.", "moderne", "moderne", ["classique", "simple", "chère"])
  ];
  /** Bilder (Emoji) und Farbfelder für „Wähle das richtige Bild“ */
  const PICS = {
    "le pantalon": "👖", "le t-shirt": "👕", "la chemise": "👔", "la robe": "👗", "l'anorak": "🧥", "des chaussures": "👞", "des baskets": "👟",
    "une casquette": "🧢", "un short": "🩳"
  };
  const COLORS = { "rouge": "#e53935", "jaune": "#fdd835", "vert / verte": "#43a047", "bleu / bleue": "#1e88e5", "gris / grise": "#9e9e9e", "noir / noire": "#212121",
    "blanc / blanche": "#ffffff", "rose": "#f48fb1", "violet / violette": "#8e24aa", "marron": "#6d4c41", "orange": "#fb8c00", "beige": "#e8d8b8" };

  const norm = s => String(s || "").toLowerCase().normalize("NFC").replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim();
  const strip = s => norm(s).replace(/[.,!?;:«»"]/g, "").replace(/\s+/g, " ").trim();
  const first = s => String(s).split(/\s*[;,/]\s*/)[0].trim();
  /** Satz → Kacheln (Satzzeichen weg, Groß/klein wie im Satz) */
  const tokens = s => String(s).replace(/[.,!?;:]/g, "").split(/\s+/).filter(Boolean);
  const checkBuild = (picked, sentence) => strip(picked.join(" ")) === strip(sentence);

  function mixer(rng) { const r = rng || Math.random; return a => a.map(x => [r(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]); }
  /**
   * Eine Lektion bauen.
   * o.cards: Karten im Bereich ({id, begriff, bedeutung, lang}); o.weak: ids zuerst üben; o.speech: Sprachausgabe da?
   * Ergebnis: Liste von Aufgaben {type, …}, leicht → schwer.
   */
  function buildLesson(o) {
    const mix = mixer(o.rng), r = o.rng || Math.random;
    const cards = (o.cards || []).filter(c => c.begriff && c.bedeutung);
    if (cards.length < 4) return [];
    const byKey = {}; cards.forEach(c => { byKey[norm(c.begriff)] = c; });
    const weak = new Set(o.weak || []);
    const ordered = mix(cards).sort((a, b) => weak.has(b.id) - weak.has(a.id));
    const focus = ordered.slice(0, 8);
    const distract = (c, n, side) => mix(cards.filter(x => x.id !== c.id && first(x[side]) !== first(c[side]))).slice(0, n).map(x => first(x[side]));
    const out = [];
    // 1. Bild wählen (Kleidung + Farben)
    const picCards = cards.filter(c => PICS[norm(c.begriff)] || COLORS[norm(c.begriff)]);
    const picOf = c => PICS[norm(c.begriff)] ? { emoji: PICS[norm(c.begriff)] } : { color: COLORS[norm(c.begriff)] };
    const picTask = c => { const group = picCards.filter(x => !!PICS[norm(x.begriff)] === !!PICS[norm(c.begriff)]); const pc = picOf(c);
      const others = mix(group.filter(x => x.id !== c.id && JSON.stringify(picOf(x)) !== JSON.stringify(pc))).filter((x, i, a) => a.findIndex(y => JSON.stringify(picOf(y)) === JSON.stringify(picOf(x))) === i).slice(0, 3);
      if (others.length < 3) return null; const opts = mix([c].concat(others));
      return { type: "pic", card: c.id, prompt: first(c.begriff), say: first(c.begriff), opts: opts.map(x => Object.assign({ label: first(x.bedeutung) }, picOf(x))), correct: opts.indexOf(c) }; };
    mix(picCards).filter(c => focus.includes(c) || picCards.length <= 6).slice(0, 2).forEach(c => { const t = picTask(c); if (t) out.push(t); });
    // 2. Übersetzung wählen: Fremdsprache → Deutsch, dann Deutsch → Fremdsprache
    focus.slice(0, 2).forEach(c => { const opts = mix([first(c.bedeutung)].concat(distract(c, 3, "bedeutung"))); out.push({ type: "mc", card: c.id, dir: "fwd", prompt: first(c.begriff), say: first(c.begriff), opts, correct: opts.indexOf(first(c.bedeutung)) }); });
    focus.slice(2, 4).forEach(c => { const opts = mix([first(c.begriff)].concat(distract(c, 3, "begriff"))); out.push({ type: "mc", card: c.id, dir: "rev", prompt: first(c.bedeutung), opts, correct: opts.indexOf(first(c.begriff)) }); });
    // 3. Paare finden
    if (cards.length >= 5) { const ps = mix(focus.concat(ordered)).filter((c, i, a) => a.indexOf(c) === i).filter((c, i, a) => a.findIndex(x => first(x.bedeutung) === first(c.bedeutung)) === i).slice(0, 5);
      out.push({ type: "pairs", cards: ps.map(c => c.id), left: mix(ps.map(c => ({ id: c.id, text: first(c.begriff) }))), right: mix(ps.map(c => ({ id: c.id, text: first(c.bedeutung) }))) }); }
    // 4.–6. Sätze zu Wörtern im Bereich: Lücke, Satz bauen, Hören
    const sents = mix((o.sentences || SENTENCES).filter(s => byKey[norm(s.key)]));
    const sentFocus = sents.sort((a, b) => focus.includes(byKey[norm(b.key)]) - focus.includes(byKey[norm(a.key)]));
    const pool = SENTENCES.flatMap(s => tokens(s.fr));
    const bank = s => { const t = tokens(s.fr); const extra = mix(pool.filter(w => !t.some(x => strip(x) === strip(w)))).filter((w, i, a) => a.findIndex(x => strip(x) === strip(w)) === i).slice(0, Math.min(4, Math.max(2, 7 - t.length))); return mix(t.concat(extra)); };
    sentFocus.slice(0, 2).forEach(s => { const opts = mix([s.gap].concat(s.opts.slice(0, 3))); out.push({ type: "gap", card: byKey[norm(s.key)].id, before: s.fr.slice(0, s.fr.indexOf(s.gap)), after: s.fr.slice(s.fr.indexOf(s.gap) + s.gap.length), de: s.de, opts, correct: opts.indexOf(s.gap), full: s.fr }); });
    sentFocus.slice(2, 4).forEach(s => out.push({ type: "build", card: byKey[norm(s.key)].id, prompt: s.de, target: s.fr, tiles: bank(s) }));
    if (o.speech) sentFocus.slice(4, 6).forEach(s => out.push({ type: "listen", card: byKey[norm(s.key)].id, say: s.fr, target: s.fr, de: s.de, tiles: bank(s) }));
    // ohne Sätze: mehr Wortaufgaben
    if (!sents.length) focus.slice(4, 8).forEach((c, i) => { const fwd = i % 2 === 0; const right = first(fwd ? c.bedeutung : c.begriff);
      const opts = mix([right].concat(distract(c, 3, fwd ? "bedeutung" : "begriff"))); out.push({ type: "mc", card: c.id, dir: fwd ? "fwd" : "rev", prompt: first(fwd ? c.begriff : c.bedeutung), say: fwd ? first(c.begriff) : null, opts, correct: opts.indexOf(right) }); });
    return out.slice(0, 14);
  }
  /** XP: 10 pro Lektion + 1 je fehlerfreie Aufgabe, Serie (Combo) ab 5 gibt +5 */
  const lessonXP = (right, total, bestCombo) => 10 + right + (bestCombo >= 5 ? 5 : 0) + (right === total ? 5 : 0);
  return { SENTENCES, PICS, COLORS, tokens, checkBuild, buildLesson, lessonXP, norm, strip };
});
