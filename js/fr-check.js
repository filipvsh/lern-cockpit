/* =====================================================================
   LERN-COCKPIT · SCHREIB-CHECK (Französisch, ohne Internet)
   Findet typische Schülerfehler in einem Text:
     · Elision          je achète → j'achète, le anorak → l'anorak
     · Artikel/Genus    un robe → une robe
     · Angleichung      une robe vert → verte, un pull verte → vert
     · Konjugation      nous achète → nous achetons (Verben aus fr-grammar)
     · Akzente          tres → très, ca → ça
   Rein, ohne DOM – getestet in tests/engine.test.js. Braucht FRG.
   ===================================================================== */
(function (root, factory) {
  const C = factory(typeof FRG !== "undefined" ? FRG : (typeof require === "function" ? require("./fr-grammar.js") : null));
  if (typeof module === "object" && module.exports) module.exports = C;
  else root.FRCHECK = C;
})(typeof self !== "undefined" ? self : this, function (G) {
  /** Genus der Nomen (m/f) – ergänzt durch Karten mit Artikel */
  const GENDER = { pantalon: "m", jean: "m", pull: "m", "t-shirt": "m", chemise: "f", jupe: "f", robe: "f", anorak: "m", chaussure: "f", basket: "f", casquette: "f", short: "m", manteau: "m",
    magasin: "m", prix: "m", style: "m", couleur: "f", veste: "f", carte: "f", mère: "f", père: "m", ami: "m", amie: "f", euro: "m", vêtement: "m", tenue: "f", taille: "f" };
  /** Adjektive: männlich → weiblich (marron/orange/beige ändern sich nicht) */
  const ADJ = { vert: "verte", bleu: "bleue", gris: "grise", noir: "noire", blanc: "blanche", violet: "violette", sportif: "sportive", "élégant": "élégante", original: "originale",
    "décontracté": "décontractée", cher: "chère", petit: "petite", grand: "grande", joli: "jolie", nouveau: "nouvelle", beau: "belle", long: "longue", court: "courte", parfait: "parfaite" };
  const INVAR = ["marron", "orange", "beige", "cool", "chic"];
  const ACCENTS = { tres: "très", ca: "ça", coute: "coûte", coutent: "coûtent", couter: "coûter", achete: "achète", achetes: "achètes", achetent: "achètent", prefere: "préfère", preferes: "préfères",
    preferent: "préfèrent", preferer: "préférer", elegant: "élégant", elegante: "élégante", decontracte: "décontracté", chere: "chère", vetements: "vêtements", vetement: "vêtement", etre: "être", deja: "déjà", apres: "après", bientot: "bientôt" };
  const PRON = { je: 0, "j'": 0, tu: 1, il: 2, elle: 2, on: 2, nous: 3, vous: 4, ils: 5, elles: 5 };
  const ART_M = ["un", "le", "mon", "ton", "son", "ce"], ART_F = ["une", "la", "ma", "ta", "sa", "cette"];
  const vowel = w => /^[aeiouyhâàéèêëîïôûü]/i.test(w) && !/^(haricot|hibou|héros|hors|haut)/i.test(w);

  /** alle Verbformen → [Verb, Person] */
  const FORMS = {};
  if (G) Object.entries(G.VERBS).forEach(([verb, v]) => { FORMS[verb] = FORMS[verb] || []; FORMS[verb].push([verb, -1]); v.forms.forEach((f, p) => { if (f) (FORMS[f] = FORMS[f] || []).push([verb, p]); }); Object.entries(v.also || {}).forEach(([a, b]) => { const p = v.forms.indexOf(a); (FORMS[b] = FORMS[b] || []).push([verb, p]); }); });

  /** Text → Wörter mit Position */
  function words(text) {
    const out = []; const re = /[A-Za-zÀ-ÿœŒ'’-]+/g; let m;
    while ((m = re.exec(text))) {
      let w = m[0].replace(/’/g, "'"), i = m.index;
      // j'achète → „j'“ + „achète“
      const ap = w.match(/^([a-zA-Z]{1,2}')(.+)$/);
      if (ap) { out.push({ w: ap[1], lw: ap[1].toLowerCase(), i, end: i + ap[1].length }); out.push({ w: ap[2], lw: ap[2].toLowerCase(), i: i + ap[1].length, end: i + w.length }); }
      else out.push({ w, lw: w.toLowerCase(), i, end: i + w.length });
    }
    return out;
  }
  const genderOf = (n, extra) => { const s = n.replace(/s$/, ""); return (extra && (extra[n] || extra[s])) || GENDER[n] || GENDER[s] || null; };
  const adjInfo = a => { for (const [m, f] of Object.entries(ADJ)) { if (a === m) return { m, f, g: "m", pl: false }; if (a === f) return { m, f, g: "f", pl: false }; if (a === m + "s" || (m.endsWith("s") && a === m)) return { m, f, g: "m", pl: true }; if (a === f + "s") return { m, f, g: "f", pl: true }; } return null; };

  /**
   * Text prüfen. o.genders: zusätzliche Genus-Einträge {nomen: "m"|"f"} (aus Karten).
   * Ergebnis: [{i, end, wrong, fix, msg, kind}] sortiert nach Position.
   */
  function check(text, o) {
    const extra = (o && o.genders) || {}; const ws = words(String(text || "")); const out = [];
    const add = (a, b, fix, msg, kind) => {
      if (out.some(x => x.i === a.i)) return;
      if (/^[A-ZÀ-Ý]/.test(a.w)) fix = fix.charAt(0).toUpperCase() + fix.slice(1);   // Satzanfang bleibt groß
      out.push({ i: a.i, end: (b || a).end, wrong: String(text).slice(a.i, (b || a).end), fix, msg, kind });
    };
    for (let k = 0; k < ws.length; k++) {
      const a = ws[k], b = ws[k + 1], c = ws[k + 2];
      // Akzente
      if (ACCENTS[a.lw]) add(a, null, ACCENTS[a.lw], "Akzent fehlt", "accent");
      if (!b) continue;
      // Elision
      if (["je", "le", "la", "de", "ne", "me", "te", "se", "que"].includes(a.lw) && vowel(b.w) && String(text).slice(a.end, b.i).trim() === "")
        add(a, b, a.lw.slice(0, -1) + "'" + b.w, "Vor Vokal wird „" + a.lw + "“ zu „" + a.lw.slice(0, -1) + "'“", "elision");
      // Artikel ↔ Genus
      const g = genderOf(b.lw, extra);
      if (g && ((ART_M.includes(a.lw) && g === "f") || (ART_F.includes(a.lw) && g === "m"))) {
        const swap = { un: "une", une: "un", le: "la", la: "le", mon: "ma", ma: "mon", ton: "ta", ta: "ton", son: "sa", sa: "son", ce: "cette", cette: "ce" }[a.lw];
        add(a, b, swap + " " + b.w, "„" + b.w + "“ ist " + (g === "f" ? "weiblich" : "männlich"), "gender");
      }
      // Adjektiv nach Nomen angleichen
      if (c && (ART_M.includes(a.lw) || ART_F.includes(a.lw) || ["des", "les", "mes", "tes", "ses", "ces"].includes(a.lw))) {
        const ng = genderOf(b.lw, extra) || (ART_F.includes(a.lw) ? "f" : ART_M.includes(a.lw) ? "m" : null);
        const pl = ["des", "les", "mes", "tes", "ses", "ces"].includes(a.lw) || /s$/.test(b.lw) && ["des", "les"].includes(a.lw);
        const ai = adjInfo(c.lw);
        if (ng && ai && !INVAR.includes(c.lw)) {
          const want = (ng === "f" ? ai.f : ai.m) + (pl && !/s$/.test(ng === "f" ? ai.f : ai.m) ? "s" : "");
          if (c.lw !== want) add(c, null, want, "„" + b.w + "“ ist " + (ng === "f" ? "weiblich" : "männlich") + (pl ? ", Mehrzahl" : "") + " → " + want, "agree");
        }
      }
      // Konjugation nach Pronomen
      const p = PRON[a.lw]; const prev = ws[k - 1];
      // „je vous aime“: vous/nous hier Objekt, nicht Subjekt
      if (p != null && FORMS[b.lw] && !(prev && PRON[prev.lw] != null)) {
        const verb = FORMS[b.lw][0][0]; const v = G.VERBS[verb]; const right = v.forms[p];
        const ok = FORMS[b.lw].some(([vb, pp]) => pp === p || (v.also && v.also[right] === b.lw));
        if (right && !ok) add(b, null, right, a.w + " … " + right + " (" + verb + ")", "verb");
      }
    }
    return out.sort((x, y) => x.i - y.i);
  }
  /** Wörter zählen (j'ai = 2) */
  const wordCount = text => words(text).length;
  return { check, wordCount, words, GENDER, ADJ };
});
