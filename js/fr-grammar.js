/* =====================================================================
   LERN-COCKPIT · FRANZÖSISCH-GRAMMATIK
   Konjugation (Präsens) und Pronomen für Verb-Puzzle und Pronomen-Spiel.
   Rein, ohne DOM – getestet in tests/engine.test.js.
   Verben: die Liste vom Klausur-Blatt „Les vêtements“; weitere einfach in
   VERBS ergänzen ([je, tu, il, nous, vous, ils], null = Form kommt nicht vor).
   ===================================================================== */
(function (root, factory) {
  const G = factory();
  if (typeof module === "object" && module.exports) module.exports = G;
  else root.FRG = G;
})(typeof self !== "undefined" ? self : this, function () {
  const PERSONS = ["je", "tu", "il", "nous", "vous", "ils"];
  const ENDINGS_ER = ["e", "es", "e", "ons", "ez", "ent"];
  /** regular: Stamm + Endung (-er, auch mit Akzent-/y-Wechsel im Stamm); sonst ganze Formen */
  const VERBS = {
    acheter: { de: "kaufen", regular: true, forms: ["achète", "achètes", "achète", "achetons", "achetez", "achètent"], hint: "è vor stummer Endung: j'achète, aber nous achetons" },
    porter: { de: "tragen", regular: true, forms: ["porte", "portes", "porte", "portons", "portez", "portent"] },
    aimer: { de: "mögen", regular: true, forms: ["aime", "aimes", "aime", "aimons", "aimez", "aiment"] },
    chercher: { de: "suchen", regular: true, forms: ["cherche", "cherches", "cherche", "cherchons", "cherchez", "cherchent"] },
    préférer: { de: "vorziehen", regular: true, forms: ["préfère", "préfères", "préfère", "préférons", "préférez", "préfèrent"], hint: "é → è vor stummer Endung: je préfère, aber nous préférons" },
    essayer: { de: "anprobieren", regular: true, forms: ["essaie", "essaies", "essaie", "essayons", "essayez", "essaient"], also: { essaie: "essaye", essaies: "essayes", essaient: "essayent" }, hint: "y → i vor stummer Endung (essaye geht auch)" },
    payer: { de: "bezahlen", regular: true, forms: ["paie", "paies", "paie", "payons", "payez", "paient"], also: { paie: "paye", paies: "payes", paient: "payent" }, hint: "y → i vor stummer Endung (paye geht auch)" },
    coûter: { de: "kosten", regular: true, forms: [null, null, "coûte", null, null, "coûtent"], hint: "meist nur: ça coûte / ils coûtent" },
    mettre: { de: "anziehen", forms: ["mets", "mets", "met", "mettons", "mettez", "mettent"] },
    aller: { de: "gehen", forms: ["vais", "vas", "va", "allons", "allez", "vont"] },
    vouloir: { de: "wollen", forms: ["veux", "veux", "veut", "voulons", "voulez", "veulent"] },
    avoir: { de: "haben", forms: ["ai", "as", "a", "avons", "avez", "ont"] }
  };
  /** Pronomen mit deutscher Entsprechung; person = Spalte in forms */
  const PRONOUNS = [
    { fr: "je", de: "ich", person: 0 }, { fr: "tu", de: "du", person: 1 },
    { fr: "il", de: "er", person: 2 }, { fr: "elle", de: "sie (eine Person)", person: 2 }, { fr: "on", de: "man", person: 2 },
    { fr: "nous", de: "wir", person: 3 }, { fr: "vous", de: "ihr / Sie", person: 4 },
    { fr: "ils", de: "sie (mehrere, Jungs/gemischt)", person: 5 }, { fr: "elles", de: "sie (mehrere Mädchen)", person: 5 }
  ];
  const elides = form => /^[aeiouyhàâéèêëîïôûü]/i.test(form);
  /** „je“ + Form → „j'achète“ / „je porte“ */
  const pronounFor = (pr, form) => pr.fr === "je" && elides(form) ? "j'" : pr.fr;
  const join = (p, form) => p.endsWith("'") ? p + form : p + " " + form;
  /** Stamm + Endung einer regelmäßigen Form */
  function split(verb, person) {
    const v = VERBS[verb], form = v.forms[person];
    if (!form) return null;
    if (!v.regular) return { stem: null, ending: null, form };
    const end = ENDINGS_ER[person];
    return { stem: form.slice(0, form.length - end.length), ending: end, form };
  }
  /** alle Aufgaben (Verb × Pronomen), deren Form es gibt */
  function tasks(verbs) {
    const out = [];
    (verbs || Object.keys(VERBS)).forEach(verb => PRONOUNS.forEach(pr => {
      const form = VERBS[verb] && VERBS[verb].forms[pr.person];
      if (form) out.push({ verb, pr, form, answer: join(pronounFor(pr, form), form) });
    }));
    return out;
  }
  const uniq = a => a.filter((x, i) => a.indexOf(x) === i);
  /** Puzzle-Teile für eine Aufgabe: Reihen mit Auswahl (immer die richtige drin), gemischt mit rng */
  function puzzle(task, rng) {
    const r = rng || Math.random, mix = a => a.map(x => [r(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    const v = VERBS[task.verb], sp = split(task.verb, task.pr.person);
    const p = pronounFor(task.pr, task.form);
    const prRow = mix(uniq([p].concat(mix(uniq(PRONOUNS.map(x => pronounFor(x, task.form)).concat(task.pr.fr === "je" ? ["je", "j'"] : []))).filter(x => x !== p).slice(0, 3))));
    if (v.regular) {
      const stems = uniq(v.forms.filter(Boolean).map((f, i) => split(task.verb, v.forms.indexOf(f)).stem));
      return { rows: [{ key: "pronoun", label: "Pronomen", options: prRow, correct: p }, { key: "stem", label: "Stamm", options: mix(stems), correct: sp.stem }, { key: "ending", label: "Endung", options: mix(uniq(ENDINGS_ER)), correct: sp.ending }], answer: task.answer };
    }
    return { rows: [{ key: "pronoun", label: "Pronomen", options: prRow, correct: p }, { key: "form", label: "Verbform", options: mix(uniq(v.forms.filter(Boolean))), correct: task.form }], answer: task.answer };
  }
  /** gewählte Teile → Text und ob richtig (Endung mit Stamm verbunden; essaye/paye als Variante ok) */
  function checkPuzzle(task, picked) {
    const v = VERBS[task.verb];
    const form = v.regular ? (picked.stem || "") + (picked.ending || "") : (picked.form || "");
    const text = join(picked.pronoun || "", form);
    const okForm = form === task.form || (v.also && v.also[task.form] === form);
    return { text, ok: okForm && picked.pronoun === pronounFor(task.pr, task.form), parts: Object.fromEntries(Object.keys(picked).map(k => [k, k === "pronoun" ? picked.pronoun === pronounFor(task.pr, task.form) : k === "form" ? okForm : k === "stem" ? okForm || picked.stem === split(task.verb, task.pr.person).stem : okForm || picked.ending === split(task.verb, task.pr.person).ending])) };
  }
  return { PERSONS, ENDINGS_ER, VERBS, PRONOUNS, pronounFor, split, tasks, puzzle, checkPuzzle };
});
