/* =====================================================================
   LERN-COCKPIT · GRAMMATIK-SPICKZETTEL (Französisch)
   Kurze Erklärungen mit Beispielen – vor den Spielen und im Klausur-Modus.
   game: passendes Spiel zum direkten Üben.
   ===================================================================== */
const GRAMMAR_NOTES = [
  { id: "er", title: "Verben auf -er", game: "verben", short: "Stamm + Endung: -e, -es, -e, -ons, -ez, -ent",
    body: [["Stamm finden", "Infinitiv ohne -er: port|er → port-"], ["Endungen", "je port<b>e</b> · tu port<b>es</b> · il/elle/on port<b>e</b> · nous port<b>ons</b> · vous port<b>ez</b> · ils/elles port<b>ent</b>"], ["Merke", "-e, -es, -e, -ent klingen gleich (stumm) – nur -ons und -ez hört man."]],
    ex: ["Je porte un jean.", "Nous cherchons un magasin.", "Ils aiment les baskets."] },
  { id: "akzent", title: "acheter & préférer", game: "verben", short: "Vor stummer Endung wird es è",
    body: [["Regel", "Bei je, tu, il, ils (stumme Endung) bekommt der Stamm ein <b>è</b>."], ["acheter", "j'ach<b>è</b>te, tu ach<b>è</b>tes, il ach<b>è</b>te, ils ach<b>è</b>tent – aber nous ach<b>e</b>tons, vous ach<b>e</b>tez"], ["préférer", "je préf<b>è</b>re … ils préf<b>è</b>rent – aber nous préf<b>é</b>rons, vous préf<b>é</b>rez"]],
    ex: ["J'achète une robe.", "Nous achetons des chaussures.", "Tu préfères la jupe ?"] },
  { id: "yer", title: "payer & essayer", game: "verben", short: "y wird zu i vor stummer Endung",
    body: [["Regel", "je pa<b>i</b>e, tu pa<b>i</b>es, il pa<b>i</b>e, ils pa<b>i</b>ent – aber nous pa<b>y</b>ons, vous pa<b>y</b>ez"], ["Gut zu wissen", "„je paye“ und „j'essaye“ sind auch richtig."]],
    ex: ["Je paie le manteau.", "Vous essayez la chemise ?"] },
  { id: "irr", title: "aller, avoir, vouloir, mettre", game: "verben", short: "Unregelmäßig – auswendig lernen",
    body: [["aller (gehen)", "je vais · tu vas · il va · nous allons · vous allez · ils vont"], ["avoir (haben)", "j'ai · tu as · il a · nous avons · vous avez · ils ont"], ["vouloir (wollen)", "je veux · tu veux · il veut · nous voulons · vous voulez · ils veulent"], ["mettre (anziehen)", "je mets · tu mets · il met · nous mettons · vous mettez · ils mettent"]],
    ex: ["Je vais au magasin.", "Elle veut une casquette.", "Tu mets ton pull ?"] },
  { id: "pron", title: "Pronomen: je, j', on …", game: "pronomen", short: "j' vor Vokal · on = man (oft „wir“)",
    body: [["Liste", "je (ich) · tu (du) · il / elle / on (er / sie / man) · nous (wir) · vous (ihr / Sie) · ils / elles (sie)"], ["j'", "Vor a, e, i, o, u, h wird je zu <b>j'</b>: j'achète, j'aime, j'ai, j'essaie"], ["on", "Verb wie bei il/elle: on achète, on va. Umgangssprachlich heißt on oft „wir“."], ["ils / elles", "elles nur, wenn alle weiblich sind – sonst ils."]],
    ex: ["J'aime ce pull.", "On va au magasin ?", "Elles portent des robes."] },
  { id: "art", title: "Artikel & Geschlecht", game: "artikel", short: "un/le = männlich · une/la = weiblich",
    body: [["Männlich", "<b>un</b> pantalon · <b>le</b> pantalon"], ["Weiblich", "<b>une</b> robe · <b>la</b> robe"], ["Mehrzahl", "<b>des</b> baskets · <b>les</b> baskets"], ["l'", "Vor Vokal: l'anorak – verrät das Geschlecht nicht, deshalb immer mit un/une mitlernen."], ["Tipp", "Lerne jedes Nomen mit Artikel – die App zählt „robe“ ohne Artikel als falsch."]],
    ex: ["une casquette (la casquette)", "un short (le short)", "des chaussures (les chaussures)"] },
  { id: "adj", title: "Adjektive angleichen", game: "lesson", short: "Weiblich + e, Mehrzahl + s",
    body: [["Grundregel", "un pull vert → une jupe vert<b>e</b> → des pulls vert<b>s</b> → des jupes vert<b>es</b>"], ["Sonderformen", "blanc → blan<b>che</b> · sportif → sporti<b>ve</b> · cher → ch<b>ère</b> · violet → violet<b>te</b>"], ["Endet schon auf -e", "rouge, jaune, rose, moderne, simple bleiben weiblich gleich: une robe rouge"], ["Ändert sich nie", "marron, orange: des chaussures marron, une casquette orange"], ["Stellung", "Farben stehen <b>nach</b> dem Nomen: une robe noire (nicht: une noire robe)"]],
    ex: ["une chemise blanche", "des baskets vertes", "un style sportif – une tenue sportive"] }
];
function grammarCard(n, open) {
  return '<details class="card gr-card"' + (open ? " open" : "") + '><summary><b>' + esc(n.title) + '</b><span class="t-sub">' + esc(n.short) + '</span></summary>' +
    '<div class="gr-body">' + n.body.map(([h, t]) => '<div class="gr-row"><span class="gr-h">' + esc(h) + '</span><span>' + t + '</span></div>').join("") +
    '<div class="gr-ex">' + n.ex.map(x => '<span>' + esc(x) + '</span>').join("") + '</div>' +
    (n.game ? '<button class="btn primary sm" data-grgame="' + n.game + '">' + (n.game === "lesson" ? "In einer Lektion üben" : "Jetzt üben") + '</button>' : '') + '</div></details>';
}
/** Erklärung, die zu einem Spiel gehört (vor dem Start einblendbar) */
const grammarFor = game => GRAMMAR_NOTES.filter(n => n.game === game);
function bindGrammarGames(scope) {
  document.querySelectorAll("[data-grgame]").forEach(b => b.onclick = () => { closeModal(); b.dataset.grgame === "lesson" ? startLesson(scope) : startGame(b.dataset.grgame, scope); });
}
/** Erklärung als Fenster (aus den Spielen heraus) */
function grammarModal(notes) {
  openModal("Kurz erklärt", notes.map((n, i) => grammarCard(Object.assign({}, n, { game: null }), i === 0)).join(""), '<button class="btn primary" id="gr_ok">Verstanden</button>', () => {
    document.getElementById("gr_ok").onclick = closeModal;
  });
}
/** passende Regel zu einem Verb */
const noteForVerb = v => GRAMMAR_NOTES.find(n => n.id === (/^(acheter|préférer)$/.test(v) ? "akzent" : /^(payer|essayer)$/.test(v) ? "yer" : /^(aller|avoir|vouloir|mettre)$/.test(v) ? "irr" : "er"));
