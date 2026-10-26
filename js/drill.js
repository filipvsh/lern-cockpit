/* =====================================================================
   LERN-COCKPIT · GRAMMATIK-DRILL (Französisch) – Daten und reine Logik
   Themen aus dem Buch (Lektion 7): acheter/essayer/payer/préférer/répéter
   (Stiefel-Regel), mettre, Passé composé, ce/cet/cette/ces,
   quel/quelle/quels/quelles, beau/nouveau/vieux.
   Lernweg in kleinen Schritten (Box = Level): Endung einsetzen → Form aus
   Bausteinen bauen → Form schreiben (mit Spickzettel) → Satz ergänzen /
   Umformen → Fehler finden. Am Anfang zählt ein fehlender Akzent noch als
   richtig. Dazu eine Probe-Arbeit mit Note (streng, ohne Hilfe).
   Getestet in tests/engine.test.js.
   ===================================================================== */
(function (root, factory) {
  const D = factory();
  if (typeof module === "object" && module.exports) module.exports = D;
  else root.DRILL = D;
})(typeof self !== "undefined" ? self : this, function () {
  const PERSONS = [["je", "ich"], ["tu", "du"], ["il/elle/on", "er/sie/man"], ["nous", "wir"], ["vous", "ihr/Sie"], ["ils/elles", "sie (Pl.)"]];
  const BOOT = [0, 1, 2, 5];   // „im Stiefel“: Stamm ändert sich
  /** forms: [je, tu, il, nous, vous, ils] · stems: [Stiefel-Stamm, Stamm für nous/vous] · end: Endungen */
  const V = (inf, de, forms, pc, stems, end, note, boot) => ({ inf, de, forms, pc, stems, end, note, boot: boot || BOOT });
  const ER = ["e", "es", "e", "ons", "ez", "ent"];
  const VERBS = {
    acheter: V("acheter", "kaufen", ["achète", "achètes", "achète", "achetons", "achetez", "achètent"], "acheté", ["achèt", "achet"], ER, "e → è im Stiefel"),
    essayer: V("essayer", "versuchen / anprobieren", ["essaie", "essaies", "essaie", "essayons", "essayez", "essaient"], "essayé", ["essai", "essay"], ER, "y → i im Stiefel"),
    payer: V("payer", "bezahlen", ["paie", "paies", "paie", "payons", "payez", "paient"], "payé", ["pai", "pay"], ER, "y → i im Stiefel (wie essayer)"),
    préférer: V("préférer", "vorziehen", ["préfère", "préfères", "préfère", "préférons", "préférez", "préfèrent"], "préféré", ["préfèr", "préfér"], ER, "é → è im Stiefel"),
    répéter: V("répéter", "wiederholen", ["répète", "répètes", "répète", "répétons", "répétez", "répètent"], "répété", ["répèt", "répét"], ER, "é → è im Stiefel (wie préférer)"),
    mettre: V("mettre", "setzen, stellen, legen; anziehen", ["mets", "mets", "met", "mettons", "mettez", "mettent"], "mis", ["met", "mett"], ["s", "s", "", "ons", "ez", "ent"], "Singular met-, Plural mett- · j'ai mis", [0, 1, 2])
  };
  /** auch richtig (y-Variante): j'essaye, ils payent … */
  const ALT = { essayer: ["essaye", "essayes", "essaye", null, null, "essayent"], payer: ["paye", "payes", "paye", null, null, "payent"] };
  const altOf = it => it.verb && ALT[it.verb] && it.person != null && !String(it.key).startsWith("pc:") ? ALT[it.verb][it.person] : null;
  const vowel = s => /^[aeiouyhâàéèêëîïôûü]/i.test(s);
  const pron = (p, form) => p === 0 && vowel(form) ? "j'" : PERSONS[p][0];

  /* Nomen für ce/quel (g: m/f, pl: Plural, v: Vokal oder stummes h am Anfang) */
  const N = (w, de, g, pl, v) => ({ w, de, g, pl: !!pl, v: !!v });
  const NOUNS = [
    N("CD", "CD", "m"), N("acteur", "Schauspieler", "m", 0, 1), N("BD", "Comic", "f"), N("acteurs", "Schauspieler (Pl.)", "m", 1, 1), N("films", "Filme", "m", 1),
    N("pull", "Pullover", "m"), N("anorak", "Jacke", "m", 0, 1), N("robe", "Kleid", "f"), N("chaussures", "Schuhe", "f", 1), N("homme", "Mann", "m", 0, 1),
    N("hôtel", "Hotel", "m", 0, 1), N("magasin", "Geschäft", "m"), N("casquette", "Kappe", "f"), N("ami", "Freund", "m", 0, 1), N("amie", "Freundin", "f", 0, 1),
    N("jupes", "Röcke", "f", 1), N("jean", "Jeans", "m"), N("baskets", "Turnschuhe", "f", 1), N("idée", "Idee", "f", 0, 1), N("t-shirts", "T-Shirts", "m", 1)
  ];
  const demo = n => n.pl ? "ces" : n.g === "f" ? "cette" : n.v ? "cet" : "ce";
  const quel = n => n.pl ? (n.g === "f" ? "quelles" : "quels") : (n.g === "f" ? "quelle" : "quel");
  const demoWhy = n => n.pl ? "Plural → ces (egal ob m. oder f.)" : n.g === "f" ? "weiblich → cette" : n.v ? "männlich + Vokal/stummes h → cet" : "männlich + Konsonant → ce";
  const quelWhy = n => (n.g === "f" ? "weiblich" : "männlich") + (n.pl ? ", Plural" : ", Singular") + " → " + quel(n) + (n.v && !n.pl && n.g === "m" ? " (quel bleibt quel – kein „quelt“)" : "");

  /* beau / nouveau / vieux: [m vor Konsonant, m vor Vokal, f, m Pl., f Pl.] */
  const ADJ = { beau: ["beau", "bel", "belle", "beaux", "belles"], nouveau: ["nouveau", "nouvel", "nouvelle", "nouveaux", "nouvelles"], vieux: ["vieux", "vieil", "vieille", "vieux", "vieilles"] };
  const ADJ_NOUNS = [["un", "film", 0, "Film"], ["un", "avion", 1, "Flugzeug"], ["une", "maison", 2, "Haus"], ["des", "films", 3, "Filme"], ["des", "amis", 3, "Freunde"], ["des", "maisons", 4, "Häuser"],
    ["un", "pull", 0, "Pullover"], ["un", "anorak", 1, "Jacke"], ["une", "robe", 2, "Kleid"], ["un", "hôtel", 1, "Hotel"], ["des", "chaussures", 4, "Schuhe"]];
  const ADJ_WHY = ["männlich + Konsonant", "männlich + Vokal/stummes h → Sonderform", "weiblich", "männlich Plural", "weiblich Plural"];

  const TOPICS = [
    { id: "stiefel", title: "acheter, essayer, payer, préférer, répéter", short: "Stiefel-Verben", kind: "conj", verbs: ["acheter", "essayer", "payer", "préférer", "répéter"] },
    { id: "mettre", title: "mettre", short: "mettre", kind: "conj", verbs: ["mettre"] },
    { id: "pc", title: "Passé composé: j'ai acheté, j'ai mis …", short: "Passé composé", kind: "pc", verbs: ["acheter", "essayer", "payer", "préférer", "répéter", "mettre"] },
    { id: "ce", title: "ce, cet, cette, ces", short: "Demonstrativ", kind: "pick", options: ["ce", "cet", "cette", "ces"] },
    { id: "quel", title: "quel, quelle, quels, quelles", short: "Fragebegleiter", kind: "pick", options: ["quel", "quelle", "quels", "quelles"] },
    { id: "beau", title: "beau, nouveau, vieux", short: "beau/nouveau/vieux", kind: "adj" }
  ];
  const AUX = ["j'ai", "tu as", "il/elle a", "nous avons", "vous avez", "ils/elles ont"];

  /** Alle Aufgaben eines Themas: {key, prompt, sub, answer, options?, why, person?} */
  function items(topicId) {
    const t = TOPICS.find(x => x.id === topicId); if (!t) return [];
    if (t.kind === "conj") return t.verbs.flatMap(v => VERBS[v].forms.map((f, p) => ({ key: v + ":" + p, verb: v, person: p, prompt: pron(p, f) + " ___", sub: VERBS[v].inf + " · " + VERBS[v].de, answer: f, why: (v === "mettre" ? (p < 3 ? "Singular" : "Plural") + " (" + PERSONS[p][0] + "): Stamm " + VERBS[v].stems[p < 3 ? 0 : 1] + "-" : BOOT.includes(p) ? "👢 Im Stiefel (" + PERSONS[p][0] + "): Stamm " + VERBS[v].stems[0] + "-" : "Außerhalb des Stiefels (" + PERSONS[p][0] + "): Stamm " + VERBS[v].stems[1] + "-") + " · " + VERBS[v].note })));
    if (t.kind === "pc") return t.verbs.flatMap(v => [0, 3, 4].map(p => ({ key: "pc:" + v + ":" + p, verb: v, person: p, prompt: AUX[p] + " ___", sub: VERBS[v].inf + " · " + VERBS[v].de, answer: VERBS[v].pc, why: "Passé composé = avoir + Partizip: " + VERBS[v].inf + " → " + VERBS[v].pc + (v === "mettre" ? " (unregelmäßig!)" : " (-er → -é)") })));
    if (t.kind === "pick") return NOUNS.map(n => ({ key: t.id + ":" + n.w, prompt: t.id === "ce" ? "J'aime ___ " + n.w + "." : "___ " + n.w + " est-ce que tu préfères ?", sub: n.de + " · " + (n.g === "f" ? "weiblich" : "männlich") + (n.pl ? ", Plural" : ""), answer: t.id === "ce" ? demo(n) : quel(n), options: t.options, why: t.id === "ce" ? demoWhy(n) : quelWhy(n) }));
    if (t.kind === "adj") return Object.keys(ADJ).flatMap(a => ADJ_NOUNS.map(([art, noun, k, de]) => ({ key: a + ":" + noun, prompt: art + " ___ " + noun, sub: a + " · " + de, answer: ADJ[a][k], options: [...new Set(ADJ[a])], why: ADJ_WHY[k] + " → " + ADJ[a][k] + " · steht vor dem Nomen" })));
    return [];
  }
  /** Ablenker: typische Fehler zuerst (falscher Stamm, falsche Endung), dann andere echte Formen */
  function distractors(it, rng) {
    const r = rng || Math.random; const mix = a => a.map(x => [r(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
    if (it.options) return it.options.filter(o => o !== it.answer);
    const v = VERBS[it.verb], out = [];
    if (it.key.startsWith("pc:")) { const w = v.inf === "mettre" ? ["mettré", "metté", "mit"] : [v.inf, v.forms[0], v.pc + "s"]; return [...new Set(w.filter(x => x !== it.answer))].slice(0, 3); }
    const p = it.person; const inBoot = v.boot.includes(p);
    out.push((inBoot ? v.stems[1] : v.stems[0]) + v.end[p]);                       // falscher Stamm: achètons / achetent
    const otherEnd = mix(v.end.filter((e, i) => i !== p && e !== v.end[p]))[0];      // falsche Endung
    out.push(v.stems[inBoot ? 0 : 1] + otherEnd);
    mix(v.forms.filter(f => f !== it.answer)).forEach(f => out.push(f));
    return [...new Set(out.filter(x => x && x !== it.answer && x !== altOf(it)))].slice(0, 3);
  }
  /* ---------- Formate (alle zum Selberschreiben) ---------- */
  const SUBJ = [["Je"], ["Tu"], ["Marie", "Mon frère", "On", "Il", "Elle"], ["Nous", "Léa et moi, nous"], ["Vous"], ["Mes parents", "Les filles", "Ils", "Elles"]];
  const TAILS = {
    acheter: ["un pull.", "des baskets au marché.", "une robe pour la fête.", "du pain."],
    essayer: ["la veste bleue.", "le jean.", "les chaussures.", "de comprendre."],
    payer: ["avec la carte.", "les billets.", "le pull.", "le café."],
    préférer: ["le rouge.", "les jupes courtes.", "le sport.", "rester à la maison."],
    répéter: ["la question.", "les mots.", "la phrase.", "après le prof."],
    mettre: ["un anorak.", "la table.", "un T-shirt.", "les livres sur la table."]
  };
  const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
    /** Subjekt vor Verbform – mit j' bei Vokal */
  const subj = (p, form, r) => { const x = pick(SUBJ[p], r); return x === "Je" && vowel(form) ? "J'" : x; };
  const joinGap = (sj, gap) => sj.endsWith("'") ? sj + gap : sj + " " + gap;
  const FMT = { ending: "Setz die Endung ein", build: "Bau die Form aus Bausteinen", form: "Schreib die Form", satz: "Ergänze den Satz", um: "Forme um", fix: "Finde den Fehler – schreib es richtig" };
  /** Tipp ohne Lösung */
  function hint(it) {
    if (it.verb && !String(it.key).startsWith("pc:")) {
      const v = VERBS[it.verb], p = it.person;
      const where = it.verb === "mettre" ? (p < 3 ? "Singular → nur ein t" : "Plural → doppel-t") : v.boot.includes(p) ? "👢 im Stiefel → Stamm ändert sich (" + v.note.split(" im")[0] + ")" : "außerhalb des Stiefels → Stamm wie im Infinitiv";
      return where + " · Endung für " + PERSONS[p][0] + ": -" + (v.end[p] || "(keine)");
    }
    if (String(it.key).startsWith("pc:")) return "avoir + Partizip · -er-Verben enden auf -é" + (it.verb === "mettre" ? " – aber mettre ist unregelmäßig" : "");
    return it.why.split("→")[0].trim();
  }
  /** Aufgabe in ein Format bringen. level 0..3 (aus der Box), r: Zufall */
  function variant(it, level, r) {
    const o = Object.assign({}, it, { type: "type", fmt: "form", level });
    o.hint = hint(it);
    if (it.verb && !String(it.key).startsWith("pc:")) {
      const v = VERBS[it.verb], p = it.person, f = it.answer;
      let fmt = level <= 0 ? "ending" : level === 1 ? "build" : level === 2 ? "form" : level === 3 ? pick(["um", "satz"], r) : pick(["fix", "um", "satz"], r);
      if (fmt === "ending" && !v.end[p]) fmt = "build";      // il met: keine Endung
      o.fmt = fmt; o.lenient = level <= 2; o.spick = level <= 2 ? "ends" : null;
      if (fmt === "ending") { const stem = v.stems[v.boot.includes(p) ? 0 : 1]; o.full = f; o.answer = v.end[p]; o.stem = stem; o.prompt = pron(p, f) + (pron(p, f).endsWith("'") ? "" : " ") + stem + "___"; o.sub = v.inf + " (" + v.de + ") · Stamm steht schon da – nur die Endung"; }
      else if (fmt === "build") { o.prompt = pron(p, f) + (pron(p, f).endsWith("'") ? "" : " ") + "___"; o.sub = v.inf + " (" + v.de + ") · Stamm + Endung antippen"; o.blocks = { stems: v.stems.slice().sort(() => r() - 0.5), ends: [...new Set(v.end)].sort((a, b) => v.end.indexOf(a) - v.end.indexOf(b)) }; }
      else if (fmt === "form") { o.prompt = it.prompt; o.sub = v.inf + " (" + v.de + ") · " + PERSONS[p][0] + " = " + PERSONS[p][1]; }
      else if (fmt === "satz") { o.prompt = joinGap(subj(p, f, r), "___") + " " + pick(TAILS[it.verb], r); o.sub = "(" + v.inf + ")"; }
      else if (fmt === "um") {
        const q = pick([0, 1, 2, 3, 4, 5].filter(x => x !== p && (v.boot.includes(x) !== v.boot.includes(p) || r() < 0.3)), r);
        o.prompt = pron(p, f) + (pron(p, f).endsWith("'") ? "" : " ") + "___"; o.from = pron(q, v.forms[q]) + (pron(q, v.forms[q]).endsWith("'") ? "" : " ") + v.forms[q];
        o.sub = o.from + " → " + PERSONS[p][0] + " ?";
      } else {
        const wrong = distractors(it, r)[0]; const sj = subj(p, wrong, r);
        o.wrong = wrong; o.prompt = joinGap(sj === "J'" && !vowel(f) ? "Je" : sj, "___") + " " + pick(TAILS[it.verb], r);
        o.sub = "(" + v.inf + ") – da stimmt was nicht";
      }
      return o;
    }
    if (String(it.key).startsWith("pc:")) {
      const v = VERBS[it.verb], p = it.person;
      o.lenient = level <= 2; if (level <= 1) o.spick = "pc";
      if (level >= 3) { const aux = ["ai", "as", "a", "avons", "avez", "ont"][p]; o.fmt = "satz"; const sj = subj(p, aux, r); o.prompt = "Hier, " + joinGap(/^(Marie|Léa)/.test(sj) ? sj : sj.charAt(0).toLowerCase() + sj.slice(1), "___") + " " + pick(TAILS[it.verb], r); o.answer = aux + " " + v.pc; o.sub = "(" + v.inf + ") – Passé composé: Hilfsverb + Partizip"; }
      return o;
    }
    // ce/quel/beau: erst mit Merk-Tabelle, ab Level 3 ohne Geschlechts-Hinweis
    o.lenient = level <= 2; if (level <= 1) o.spick = it.key.split(":")[0] in ADJ ? "beau" : it.key.split(":")[0];
    if (level >= 3) { o.sub = String(it.sub).split(" · ")[0]; o.fmt = "satz"; }
    return o;
  }
  /** Runde bauen: schwächste zuerst (Box), alles selbst schreiben; n Aufgaben */
  function round(topicId, stats, n, rng) {
    const r = rng || Math.random; const st = stats || {};
    const t = TOPICS.find(x => x.id === topicId) || {}; const vi = it => (t.verbs || []).indexOf(it.verb);
    const list = items(topicId).map(it => ({ it, b: (st[it.key] || {}).b || 0, r: r() }));
    list.sort((a, b) => a.b - b.b || vi(a.it) - vi(b.it) || a.r - b.r);      // ein Verb nach dem anderen
    return list.slice(0, n || 12).map(x => [r(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => Object.assign(variant(x.it, Math.min(4, x.b), r), { box: x.b }));
  }
  /** Probe-Arbeit: gemischt aus allen Themen, schwere Formate, ohne Tipps */
  const TEST_MIX = [["stiefel", 8], ["mettre", 3], ["pc", 3], ["ce", 2], ["quel", 2], ["beau", 2]];
  function testRound(allStats, rng) {
    const r = rng || Math.random; const out = [];
    TEST_MIX.forEach(([t, n]) => {
      const st = (allStats || {})[t] || {};
      const list = items(t).map(it => ({ it, s: ((st[it.key] || {}).b || 0) + r() * 2 })).sort((a, b) => a.s - b.s).slice(0, n);
      list.forEach(x => out.push(Object.assign(variant(x.it, 3 + (r() < 0.5 ? 1 : 0), r), { topic: t, hint: null, lenient: false, spick: null })));
    });
    return out.map(x => [r(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  /** Sonderzeichen, die bei dieser Aufgabe vorkommen können (nur die des Verbs/Themas) */
  function accentsFor(it) {
    const src = !it.verb ? [it.answer] : String(it.key).startsWith("pc:") ? [VERBS[it.verb].pc] : VERBS[it.verb].forms;
    return [...new Set(src.join("").split("").filter(c => /[^\x00-\x7f]/.test(c)))];
  }
  /** Note aus Prozent (Schulnoten-Schlüssel) */
  const grade = pct => pct >= 92 ? 1 : pct >= 81 ? 2 : pct >= 67 ? 3 : pct >= 50 ? 4 : pct >= 30 ? 5 : 6;
  /** Antwort bewerten: richtig / nur Akzent falsch / falsch */
  const strip = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  function check(given, answer, it) {
    const g = String(given || "").trim().toLowerCase().replace(/’/g, "'");
    if (g === answer.toLowerCase() || (it && altOf(it) === g)) return "ok";
    if (strip(g) === strip(answer)) return "accent";
    return "wrong";
  }
  /** Statistik nach einer Antwort: Box hoch bei richtig, auf 0 bei falsch */
  function learn(stats, key, ok) {
    const s = Object.assign({}, stats); const x = Object.assign({ b: 0, r: 0, w: 0 }, s[key]);
    if (ok) { x.r++; x.b = Math.min(5, x.b + 1); } else { x.w++; x.b = 0; }
    s[key] = x; return s;
  }
  /** Wie gut sitzt jede Person? (für „Wo hakt's?“) → [{person, label, pct, n}] */
  function byPerson(topicId, stats) {
    const its = items(topicId).filter(i => i.person != null);
    return PERSONS.map(([fr], p) => { const ks = its.filter(i => i.person === p).map(i => (stats || {})[i.key]).filter(Boolean); const r = ks.reduce((a, x) => a + x.r, 0), w = ks.reduce((a, x) => a + x.w, 0); return { person: p, label: fr, n: r + w, pct: r + w ? Math.round(r / (r + w) * 100) : null }; }).filter(x => its.some(i => i.person === x.person));
  }
  /** Fortschritt eines Themas: Anteil Aufgaben mit Box ≥ 3 (kann die Form selbst schreiben) */
  const progress = (topicId, stats) => { const its = items(topicId); const ok = its.filter(i => ((stats || {})[i.key] || {}).b >= 3).length; return { ok, n: its.length, pct: its.length ? Math.round(ok / its.length * 100) : 0 }; };
  /** Stamm/Endung zum Einfärben + geänderter Buchstabe im Stiefel */
  function parts(verb, p) {
    const v = VERBS[verb], f = v.forms[p], inBoot = v.boot.includes(p);
    const stem = v.stems[inBoot ? 0 : 1], other = v.stems[inBoot ? 1 : 0];
    let i = 0; while (i < stem.length && stem[i] === other[i]) i++;
    const changed = stem !== other && i < stem.length;
    return { pre: stem.slice(0, i), ch: changed ? stem[i] : "", post: changed ? stem.slice(i + 1) : stem.slice(i), end: f.slice(stem.length), inBoot };
  }
  return { FMT, accentsFor, hint, variant, testRound, grade, TEST_MIX, ALT, altOf, PERSONS, BOOT, VERBS, NOUNS, ADJ, TOPICS, AUX, pron, items, distractors, round, check, learn, byPerson, progress, parts, demo, quel };
});
