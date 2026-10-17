/* =====================================================================
   LERN-COCKPIT · INHALTS-PAKETE
   Einmalige Aktualisierungen der Lerndaten, die beim Start laufen
   (Merker in „einstellungen“: packs_done). Nur INSERT und PATCH.
   Ein Paket, dessen Voraussetzung fehlt (z. B. keine Mathe-Klausur
   eingetragen), läuft beim nächsten Start erneut.
   ===================================================================== */
const VETEMENTS = [
  // les styles
  ["cool", "cool"], ["sportif / sportive", "sportlich"], ["chic", "schick"], ["élégant / élégante", "elegant"], ["moderne", "modern"],
  ["simple", "einfach"], ["classique", "klassisch"], ["original / originale", "originell"], ["décontracté / décontractée", "locker"], ["confortable", "bequem"],
  // les noms
  ["le pantalon", "die Hose"], ["le jean", "die Jeans"], ["le pull", "der Pullover"], ["le t-shirt", "das T-Shirt"], ["la chemise", "das Hemd"],
  ["la jupe", "der Rock"], ["la robe", "das Kleid"], ["l'anorak", "die Jacke"], ["des chaussures", "die Schuhe"], ["des baskets", "die Turnschuhe"],
  ["une casquette", "die Kappe"], ["un short", "die Shorts"], ["un manteau", "der Mantel"],
  // faire du shopping
  ["acheter", "kaufen"], ["chercher", "suchen"], ["essayer", "anprobieren"], ["payer", "bezahlen"], ["coûter", "kosten"],
  ["le prix", "der Preis"], ["le magasin", "das Geschäft"], ["cher / chère", "teuer"], ["pas cher / pas chère", "nicht teuer, günstig"],
  // les verbes
  ["porter", "tragen"], ["mettre", "anziehen"], ["aimer", "mögen"], ["préférer", "vorziehen"], ["aller", "gehen"], ["vouloir", "wollen"], ["avoir", "haben"],
  // les couleurs (m / f)
  ["rouge", "rot"], ["jaune", "gelb"], ["vert / verte", "grün"], ["bleu / bleue", "blau"], ["gris / grise", "grau"], ["noir / noire", "schwarz"],
  ["blanc / blanche", "weiß"], ["rose", "rosa"], ["violet / violette", "lila"], ["marron", "braun"], ["orange", "orange"], ["beige", "beige"]
];
const VET_NAME = "Les vêtements";

const upcomingExam = re => upcomingKL().filter(k => !isVocabTest(k) && re.test(k.fach)).sort((a, b) => a.datum < b.datum ? -1 : 1)[0] || null;
async function ensureTopic(k, title) {
  let t = topicsOfExam(k.id).find(x => x.title.toLowerCase() === title.toLowerCase());
  if (!t) t = (await dbInsert("topics", { title, exam_id: k.id, subject_id: subjectId(k.fach), priority: 3, status: "active" })).row;
  else if (t.status !== "active") await dbPatch("topics", t.id, { status: "active" });
  return t;
}
async function ensureSub(t, title, sort) {
  let s = subsOfTopic(t.id).find(x => x.title.toLowerCase() === title.toLowerCase());
  if (!s) s = (await dbInsert("subtopics", { topic_id: t.id, title, difficulty: 2, sort })).row;
  return s;
}
/** Übungen anlegen, die es (am Fragetext erkannt) noch nicht gibt */
async function ensureExercises(st, rows) {
  const missing = rows.filter(r => !exercisesOf(st.id).some(e => e.question === r.question))
    .map(r => Object.assign({ id: Engine.uuid(), subtopic_id: st.id, difficulty: 2, source: "ai", created_at: new Date().toISOString() }, r));
  if (!missing.length) return;
  await Api.insert("exercises", missing); ES.exercises.push(...missing);
}
const mc = (question, options, correct_index, solution) => ({ type: "multiple_choice", question, options, correct_index, solution });
const open_ = (question, solution, type) => ({ type: type || "free_text", question, solution });

/* Fahrschule (vorübergehend): Abfahrtkontrolle Klasse B, Fahrschule Fleischmann, Stand 18.09.2011.
   [Frage, Antwort, weitere richtige Antworten]. „;“ in der Antwort = jede der Varianten zählt. */
const FS_PDF_NAME = "Fahrschule · Abfahrtkontrolle", FS_EXTRA_NAME = "Fahrschule · Extras";
const FS_CHAIN = (seite, list) => list.map((x, i) => [i === 0 ? "Licht " + seite + " mit 2 Personen: 1. Kommando?" : "Licht " + seite + " mit 2 Personen: Was kommt nach „" + list[i - 1] + "“?", x, []]);
const FAHRSCHULE_PDF = [
  // Reifen
  ["Reifen: Mindestprofiltiefe?", "1,6 mm", ["1,6 millimeter", "1.6 mm", "1,6"]],
  ["Reifen: Was darf an den Reifenseiten nicht sein?", "Einschnitte, Risse oder Beulen", ["Einschnitte Risse Beulen", "Risse", "Beulen", "Einschnitte"]],
  ["Reifen: Wo steht der richtige Reifendruck?", "Tankklappe; Bedienungsanleitung; B-Säule (Fahrertür öffnen)", ["in der Tankklappe", "an der B-Säule", "Fahrertür"]],
  // Beleuchtung
  ["Beleuchtung prüfen: Was muss eingeschaltet sein?", "Zündung", ["die Zündung"]],
  ["Wie schaltest du das Standlicht ein?", "Lichtschalter 1x nach rechts drehen", ["1x nach rechts", "einmal nach rechts", "Lichtschalter einmal nach rechts", "1x nach rechts drehen"]],
  ["Wie schaltest du das Abblendlicht ein?", "Lichtschalter 2x nach rechts drehen", ["2x nach rechts", "zweimal nach rechts", "Lichtschalter zweimal nach rechts", "2x nach rechts drehen"]],
  ["Wie schaltest du das Fernlicht ein?", "Blinkerhebel nach vorn drücken", ["Blinkerhebel nach vorne drücken", "Hebel nach vorne drücken", "nach vorne drücken", "nach vorn drücken"]],
  ["Fernlicht: Welche Farbe hat die Kontrollleuchte?", "blau", []],
  ["Wie schaltest du die Nebelscheinwerfer ein?", "Abblendlicht an und Lichtschalter 1x herausziehen", ["Lichtschalter 1x herausziehen", "1x herausziehen", "einmal herausziehen", "Lichtschalter einmal herausziehen"]],
  ["Wie schaltest du die Nebelschlussleuchte ein?", "Abblendlicht an und Lichtschalter 2x herausziehen", ["Lichtschalter 2x herausziehen", "2x herausziehen", "zweimal herausziehen", "Lichtschalter zweimal herausziehen"]],
  ["Nebelschlussleuchte: Welche Farbe hat die Kontrollleuchte?", "gelb", []],
  ["Wie schaltest du die Parkleuchte ein?", "Licht und Zündung aus und Blinker nach links", ["Blinker links", "Blinker nach links", "Blinker links anschalten", "Licht und Zündung aus, Blinker links"]],
  ["Wann darf die Nebelschlussleuchte an?", "Sichtweite durch Nebel unter 50 m", ["unter 50 m", "weniger als 50 m", "unter 50 Meter", "weniger als 50 Meter", "50 m", "50 Meter"]],
  ["Auf welcher Seite ist die Nebelschlussleuchte?", "nur links", ["links", "linke Seite", "linke Fahrzeugseite"]],
  // Lenkspiel
  ["Lenkspiel: Wie viel ist höchstens erlaubt?", "2 cm", ["2 zentimeter", "maximal 2 cm", "höchstens 2 cm", "2-3 Finger breit", "2 bis 3 Finger"]],
  ["Lenkspiel prüfen: Welche Scheibe öffnest du?", "linke Seitenscheibe", ["links", "linke Scheibe", "Fahrerscheibe", "die linke Seitenscheibe"]],
  ["Lenkspiel prüfen: Worauf schaust du, während du das Lenkrad bewegst?", "Vorderrad", ["auf das Vorderrad", "das Vorderrad", "Vorderrad beobachten", "Rad"]],
  ["Lenkspiel: Ab wie viel Fingerbreit muss sich das Vorderrad bewegen?", "2-3 Finger", ["2 bis 3 Finger", "2-3", "2 bis 3", "2-3 Finger breit"]],
  // Bremsen
  ["Fußbremse prüfen: Wann muss der feste Widerstand kommen?", "nach einem Drittel des Pedalwegs", ["ein Drittel", "nach einem Drittel", "Drittel", "nach 1 Drittel"]],
  ["Bremspedal lässt sich weiter durchtreten – was tun?", "Fahrzeug nicht benutzen und Fachwerkstatt benachrichtigen", ["nicht fahren", "Werkstatt", "Fachwerkstatt", "Fahrzeug nicht benutzen"]],
  ["Handbremse prüfen: Wie ziehst du den Hebel?", "langsam hochziehen ohne den Knopf zu drücken", ["ohne Knopf", "ohne Arretierungsknopf", "langsam ohne Knopf", "langsam hochziehen ohne Knopf"]],
  ["Handbremse: Nach wie vielen „Klack“ darf das Auto nicht mehr rollen?", "3 bis 5", ["3-5", "drei bis fünf", "nach 3 bis 5"]],
  ["Kontrollleuchte Feststellbremse leuchtet auch bei …?", "Fehlern im Bremssystem", ["Fehler im Bremssystem", "Bremssystem", "Bremsfehler"]],
  // Motoröl
  ["Ölstand prüfen: Wie muss das Auto stehen?", "gerade (nicht schräg, nicht am Berg)", ["gerade", "eben", "waagerecht", "nicht schräg", "nicht am Berg"]],
  ["Ölstand prüfen: Wie lange muss der Motor vorher aus sein?", "ca. 5 Minuten", ["5 Minuten", "5 min", "fünf Minuten"]],
  ["Ölpeilstab: Was machst du nach dem ersten Herausziehen?", "mit einem Lappen säubern", ["abwischen", "säubern", "sauber machen", "mit Lappen säubern", "mit einem Lappen abwischen"]],
  ["Ölpeilstab: Und nach dem Säubern?", "wieder ganz reinstecken und erneut herausziehen", ["wieder reinstecken", "reinstecken", "wieder ganz reinstecken", "reinstecken und wieder rausziehen"]],
  ["Wann musst du Öl nachfüllen?", "wenn der Ölstand auf Min. ist", ["bei Min", "Min", "auf Min", "Minimum"]],
  ["Wie viel Öl füllst du ungefähr nach?", "½ bis ¾ Liter", ["halber bis dreiviertel Liter", "einen halben bis dreiviertel Liter", "halben Liter", "ein halber Liter"]],
  // Kühlmittel
  ["Kühlmittel: Wann darfst du nachfüllen?", "nur bei abgekühltem Motor", ["bei kaltem Motor", "kalter Motor", "Motor kalt", "wenn der Motor kalt ist", "abgekühlter Motor"]],
  ["Kühlmittel: Warum nur bei kaltem Motor?", "Verbrühungsgefahr", ["Verbrühung", "verbrühen", "heißer Dampf", "Gefahr beim Öffnen"]],
  ["Kühlmittel: Wo muss der Stand sein?", "zwischen den zwei Strichen", ["zwischen den Strichen", "zwischen min und max", "zwischen den Markierungen"]],
  ["Kühlmittel: Wann musst du nachfüllen?", "wenn der Stand unter dem unteren Strich ist", ["unter dem unteren Strich", "unter Min", "unterhalb des unteren Striches"]],
  ["Frostschutz (Kühlmittel und Wischwasser): bis wie viel Grad?", "-25 °C", ["minus 25 Grad", "-25 Grad", "-25", "minus 25"]],
  ["Wofür darf der Frostschutzprüfer nur verwendet werden?", "für das Kühlmittel", ["Kühlmittel", "nur für das Kühlmittel", "nicht für die Scheibenwaschanlage"]],
  // Scheibenwaschanlage
  ["Scheibenwaschanlage: Woran siehst du, ob genug drin ist?", "Nach dem Öffnen des Deckels muss Flüssigkeit zu sehen sein", ["Flüssigkeit sichtbar", "man sieht Flüssigkeit", "Flüssigkeit zu sehen"]],
  ["Wischwasser: Was kommt im Sommer dazu?", "Reinigungsmittel", ["Reiniger"]],
  ["Wischwasser: Was kommt im Winter dazu?", "Frostschutzmittel", ["Frostschutz"]],
  ["Nach dem Auffüllen mit Frostschutz: Was musst du noch tun?", "Anlage betätigen, damit der Frostschutz in die Düsen kommt", ["Anlage betätigen", "betätigen", "Scheibenwaschanlage betätigen", "einmal sprühen"]],
  // Licht mit 2 Personen
  ["Licht mit 2 Personen: Wer setzt sich auf den Fahrersitz?", "der Fahrlehrer", ["Fahrlehrer", "Fahrlehrerin"]],
  ["Licht mit 2 Personen: Was muss der Fahrlehrer einschalten?", "Zündung", ["die Zündung"]]
].concat(FS_CHAIN("hinten", ["Abblendlicht", "Bremse", "Rückwärtsgang", "Nebelschlussleuchte", "Blinker links", "Blinker rechts", "Warnblinker"]))
 .concat(FS_CHAIN("vorne", ["Standlicht", "Abblendlicht", "Fernlicht", "Nebelscheinwerfer", "Blinker links", "Blinker rechts", "Warnblinker"]))
 .concat([
  ["Licht hinten – „Abblendlicht“: Was muss leuchten?", "Rückleuchten und Kennzeichenleuchten", ["Rücklichter und Kennzeichenbeleuchtung", "Rückleuchten", "Kennzeichenleuchten", "Rücklichter"]],
  ["Licht hinten – „Bremse“: Wie viele Bremslichter müssen leuchten?", "3", ["drei"]],
  ["Licht hinten – „Rückwärtsgang“: Was muss leuchten?", "Rückfahrscheinwerfer rechts und links", ["Rückfahrscheinwerfer", "Rückfahrleuchten", "Rückfahrlicht"]]
]);
/* Extras: übliche Technikfragen Klasse B, nicht aus der PDF */
const FAHRSCHULE_EXTRA = [
  ["Bremsflüssigkeit: Wo muss der Stand sein?", "zwischen Min und Max", ["zwischen min und max", "zwischen den Markierungen"]],
  ["Bremsflüssigkeit unter Min – was tun?", "nicht weiterfahren und Werkstatt aufsuchen", ["Werkstatt", "Fachwerkstatt", "Werkstatt aufsuchen"]],
  ["Rote Öldruck-Kontrollleuchte leuchtet beim Fahren – was tun?", "sofort anhalten und Motor abstellen", ["anhalten", "sofort anhalten", "Motor aus", "Motor abstellen"]],
  ["Rote Batterie-Leuchte (Ladekontrolle) leuchtet beim Fahren – was heißt das?", "Batterie wird nicht geladen (Lichtmaschine)", ["Batterie wird nicht geladen", "Lichtmaschine", "Lichtmaschine lädt nicht"]],
  ["Kühlmitteltemperatur-Warnleuchte rot – was tun?", "anhalten und Motor abkühlen lassen", ["anhalten", "Motor abkühlen lassen"]],
  ["Gelbe Motorkontrollleuchte – was heißt das?", "Störung an Motor oder Abgasanlage – Werkstatt", ["Werkstatt", "Motorstörung", "Abgasanlage", "Störung an Motor oder Abgasanlage"]],
  ["ABS-Leuchte bleibt an – was heißt das?", "ABS ist ausgefallen – Bremse geht, aber ohne ABS", ["ABS ausgefallen", "ABS Fehler", "ohne ABS"]],
  ["Reifendruck: Bei warmen oder kalten Reifen prüfen?", "bei kalten Reifen", ["kalt", "kalte Reifen", "kalten"]],
  ["Empfohlene Profiltiefe bei Winterreifen?", "4 mm", ["4 millimeter", "4"]],
  ["Pflicht im Auto (3 Dinge)?", "Warndreieck, Verbandkasten, Warnweste", ["Warndreieck", "Verbandkasten", "Warnweste"]],
  ["Warndreieck: Abstand innerorts?", "ca. 50 m", ["50 m", "50 Meter"]],
  ["Warndreieck: Abstand auf der Landstraße?", "ca. 100 m", ["100 m", "100 Meter"]],
  ["Warndreieck: Abstand auf der Autobahn?", "mindestens 200 m", ["200 m", "200 Meter"]],
  ["Frontscheibe beschlagen – was tun?", "Gebläse auf die Frontscheibe und Klimaanlage an", ["Gebläse auf die Scheibe", "Klimaanlage an", "Gebläse", "Defroster"]],
  ["Wozu dient die Leuchtweitenregulierung?", "damit andere bei Beladung nicht geblendet werden", ["nicht blenden", "Gegenverkehr nicht blenden", "Blendung vermeiden"]],
  ["Kopfstütze richtig einstellen?", "Oberkante auf Höhe des Scheitels", ["Kopfoberkante", "Höhe Kopfoberkante", "auf Höhe des Kopfes", "Scheitel"]],
  ["Hupe: Wann prüfen?", "bei der Abfahrtkontrolle kurz drücken", ["kurz drücken", "kurz hupen"]]
];
async function ensureTermCollection(name, desc, rows) {
  let col = ES.collections.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!col) col = (await dbInsert("vocab_collections", { name, source_language: "de", target_language: "de", subject_id: null, description: desc })).row;
  else if (isArchived(col.id)) await setArchived(col.id, false);
  const have = new Set(cardsOf(col.id).map(v => Engine.normalize(v.begriff)));
  const add = rows.filter(([q]) => !have.has(Engine.normalize(q))).map(([q, a, alts]) => ({ begriff: q, bedeutung: a, alternatives: alts || [], sprache: col.name, collection_id: col.id, source_language: "de", target_language: "de", subject_id: null, level: 0, next: todayISO() }));
  if (add.length) { const r = await Api.insert("vokabeln", add); (Array.isArray(r) && r.length ? r : add).forEach(x => STATE.vo.push(normVO(x))); }
  return add.length;
}

const PACKS = [
  { id: "vetements-1809", label: "Vokabeln „Les vêtements“", run: async () => {
    let col = ES.collections.find(c => c.name.toLowerCase() === VET_NAME.toLowerCase());
    if (!col) col = (await dbInsert("vocab_collections", { name: VET_NAME, source_language: "fr", target_language: "de", subject_id: subjectId("Französisch"), description: "Mindmap 18.09.26" })).row;
    const have = new Set(cardsOf(col.id).map(v => Engine.normalize(v.begriff)));
    const rows = VETEMENTS.filter(([b]) => !have.has(Engine.normalize(b))).map(([b, m]) => ({ begriff: b, bedeutung: m, sprache: col.name, collection_id: col.id, source_language: "fr", target_language: "de", subject_id: col.subject_id || null, level: 0, next: todayISO(), alternatives: [] }));
    if (rows.length) { const r = await Api.insert("vokabeln", rows); (Array.isArray(r) && r.length ? r : rows).forEach(x => STATE.vo.push(normVO(x))); }
    return rows.length + " Vokabeln";
  } },
  { id: "vetements-fix-1", label: "Vokabeln „Les vêtements“ korrigiert", run: async () => {
    // préférer stand mit einer Zusatzbedeutung drin, die nicht auf dem Blatt steht
    const col = ES.collections.find(c => c.name.toLowerCase() === VET_NAME.toLowerCase()); if (!col) return true;
    const v = cardsOf(col.id).find(x => x.begriff === "préférer" && x.bedeutung !== "vorziehen");
    if (v) await dbPatch("vokabeln", v.id, { bedeutung: "vorziehen" });
    return true;
  } },
  { id: "fahrschule-1", label: "Fahrschule: Abfahrtkontrolle", run: async () => {
    const n = await ensureTermCollection(FS_PDF_NAME, "Abfahrtkontrolle Klasse B (PDF) – auswendig für die Praxisprüfung", FAHRSCHULE_PDF)
      + await ensureTermCollection(FS_EXTRA_NAME, "Weitere Technikfragen Klasse B", FAHRSCHULE_EXTRA);
    return n + " Karten";
  } },
  { id: "englisch-archiv", label: "Englisch archiviert", run: async () => {
    if (upcomingExam(/^Englisch$/)) return false;   // solange eine Englisch-Klausur ansteht, bleibt alles
    const en = ES.collections.filter(c => c.source_language === "en" && !isArchived(c.id));
    for (const c of en) await setArchived(c.id, true);
    return en.length ? plural(en.length, "Sammlung", "Sammlungen") : true;
  } },
  { id: "leichte-woerter", label: "Sehr leichte Wörter abgehakt", run: async () => {
    const easy = STATE.vo.filter(v => Engine.isNew(v) && Engine.isTrivial(v));
    easy.forEach(markCardKnown);
    return easy.length ? plural(easy.length, "Wort", "Wörter") : true;
  } },
  { id: "mathe-potenzfunktionen", label: "Mathe: Potenzfunktionen", run: async () => {
    const k = upcomingExam(/^Mathe$/); if (!k) return false;
    // alte Themen (z. B. Graphen, lineare Funktionen) pausieren – nicht löschen
    for (const t of topicsOfExam(k.id)) if (t.title !== "Potenzfunktionen" && t.status === "active") await dbPatch("topics", t.id, { status: "paused" });
    if (!/potenz/i.test(k.thema || "")) await saveKL(k, { thema: "Potenzfunktionen" });
    const t = await ensureTopic(k, "Potenzfunktionen");
    const s1 = await ensureSub(t, "Gerade Exponenten (x², x⁴, x⁶ …)", 0);
    await ensureExercises(s1, [
      mc("Welche Symmetrie hat f(x) = x⁴?", ["Achsensymmetrisch zur y-Achse", "Punktsymmetrisch zum Ursprung", "Keine Symmetrie"], 0, "Gerader Exponent → f(−x) = f(x) → achsensymmetrisch zur y-Achse."),
      mc("Wie verhält sich f(x) = x⁴ für x → +∞ und x → −∞?", ["Beide Male gegen +∞", "−∞ und +∞", "Gegen 0"], 0, "Gerader Exponent: links und rechts geht der Graph nach oben."),
      mc("Durch welche drei Punkte gehen alle Graphen y = xⁿ mit geradem n?", ["(−1|1), (0|0), (1|1)", "(−1|−1), (0|0), (1|1)", "(0|1), (1|1), (2|4)"], 0, "(−1)ⁿ = 1 bei geradem n."),
      open_("Vergleiche die Graphen von x² und x⁴: Was ist bei x⁴ anders?", "Gleiche Punkte (−1|1), (0|0), (1|1). Zwischen −1 und 1 ist x⁴ flacher (näher an der x-Achse), außerhalb steiler.")
    ]);
    const s2 = await ensureSub(t, "Ungerade Exponenten (x³, x⁵ …)", 1);
    await ensureExercises(s2, [
      mc("Welche Symmetrie hat f(x) = x⁵?", ["Punktsymmetrisch zum Ursprung", "Achsensymmetrisch zur y-Achse", "Keine Symmetrie"], 0, "Ungerader Exponent → f(−x) = −f(x) → punktsymmetrisch zum Ursprung."),
      mc("Wie verhält sich f(x) = x⁵ für x → −∞?", ["Gegen −∞", "Gegen +∞", "Gegen 0"], 0, "Ungerader Exponent: von links unten nach rechts oben."),
      mc("Durch welche Punkte gehen alle Graphen y = xⁿ mit ungeradem n?", ["(−1|−1), (0|0), (1|1)", "(−1|1), (0|0), (1|1)", "(0|0), (1|0), (2|8)"], 0, "(−1)ⁿ = −1 bei ungeradem n.")
    ]);
    const s3 = await ensureSub(t, "Negative Exponenten (x⁻¹, x⁻² …)", 2);
    await ensureExercises(s3, [
      open_("Schreib x⁻² als Bruch.", "x⁻² = 1/x²"),
      open_("Schreib 1/x³ als Potenz.", "1/x³ = x⁻³"),
      mc("Welche Definitionsmenge hat f(x) = x⁻¹?", ["ℝ ohne 0", "Alle reellen Zahlen", "Nur positive Zahlen"], 0, "Durch 0 darf man nicht teilen: x ≠ 0."),
      mc("Welche Asymptoten hat f(x) = 1/x²?", ["x-Achse und y-Achse", "Nur die x-Achse", "Keine"], 0, "Für x → ±∞ geht f gegen 0 (x-Achse), bei x → 0 gegen ∞ (y-Achse)."),
      mc("Welche Symmetrie hat f(x) = x⁻²?", ["Achsensymmetrisch zur y-Achse", "Punktsymmetrisch zum Ursprung", "Keine"], 0, "Exponent −2 ist gerade → achsensymmetrisch."),
      mc("Welche Symmetrie hat f(x) = x⁻³?", ["Punktsymmetrisch zum Ursprung", "Achsensymmetrisch zur y-Achse", "Keine"], 0, "Exponent −3 ist ungerade → punktsymmetrisch."),
      open_("Berechne 2⁻³.", "2⁻³ = 1/2³ = 1/8 = 0,125")
    ]);
    const s4 = await ensureSub(t, "Potenzgesetze & Umformen", 3);
    await ensureExercises(s4, [
      open_("Vereinfache x³ · x⁴.", "x³ · x⁴ = x⁷ (Exponenten addieren)"),
      open_("Vereinfache x⁵ : x².", "x⁵ : x² = x³ (Exponenten subtrahieren)"),
      open_("Vereinfache (x²)³.", "(x²)³ = x⁶ (Exponenten multiplizieren)"),
      open_("Vereinfache x⁻² · x⁵.", "x⁻² · x⁵ = x³"),
      mc("Was ist x⁰ (x ≠ 0)?", ["1", "0", "x"], 0, "Jede Zahl (außer 0) hoch 0 ist 1.")
    ]);
    const s5 = await ensureSub(t, "Strecken, Spiegeln, Verschieben", 4);
    await ensureExercises(s5, [
      mc("Was macht das Minus in f(x) = −2x⁴?", ["Spiegelt an der x-Achse (und streckt mit 2)", "Verschiebt nach links", "Spiegelt an der y-Achse"], 0, "Faktor −2: Spiegelung an der x-Achse und Streckung um 2."),
      open_("Wie liegt f(x) = (x − 3)⁴ + 1 im Vergleich zu x⁴?", "3 nach rechts und 1 nach oben verschoben. Der tiefste Punkt liegt bei (3|1)."),
      mc("f(x) = 0,5·x³ – was bewirkt der Faktor 0,5?", ["Stauchung (flacher)", "Streckung (steiler)", "Verschiebung nach unten"], 0, "Faktor zwischen 0 und 1 staucht den Graphen.")
    ]);
    return "Thema Potenzfunktionen";
  } },
  { id: "franz-klausur", label: "Französisch-Klausur vorbereitet", run: async () => {
    const k = upcomingExam(/^Französisch$/); if (!k) return false;
    const col = ES.collections.find(c => c.name.toLowerCase() === VET_NAME.toLowerCase());
    if (col && !(k.vokabel_lektionen || []).some(x => String(x).toLowerCase() === col.name.toLowerCase())) await saveKL(k, { vokabel_lektionen: (k.vokabel_lektionen || []).concat([col.name]) });
    const t = await ensureTopic(k, "Klausur Französisch");
    const s1 = await ensureSub(t, "Texte schreiben (2 Texte)", 0);
    await ensureExercises(s1, [
      open_("Schreib eine kurze Mail (ca. 80 Wörter) an eine Freundin: Du warst shoppen. Was hast du gekauft, wie sieht es aus, was hat es gekostet?", "Salut Léa,\nHier, je suis allé(e) au magasin avec ma mère. J'ai acheté un pull bleu et une casquette noire. Le pull est très confortable et pas cher : il coûte 20 euros. La casquette est cool, mais un peu chère. J'aime beaucoup mon nouveau style décontracté !\nEt toi, tu aimes faire du shopping ?\nBises,\n…\n\nBausteine: Hier, je suis allé(e) … · J'ai acheté … · Il/Elle coûte … · Je préfère … · Et toi ?", "short_writing"),
      open_("Beschreib in 5–6 Sätzen, was eine Person trägt (Kleidung, Farben, Stil).", "Elle porte une robe rouge et des baskets blanches. Elle a aussi une casquette grise. Son style est sportif et moderne. Lui, il porte un jean bleu, une chemise blanche et un manteau noir. Il est très élégant.\n\nAchte auf die Angleichung: une robe verte, des baskets blanches.", "short_writing"),
      open_("Schreib einen Dialog im Geschäft (6–8 Zeilen): Du suchst etwas, probierst es an, fragst nach dem Preis und bezahlst.", "— Bonjour, je cherche un pantalon.\n— Quelle couleur ?\n— Noir, s'il vous plaît.\n— Voilà. Vous voulez l'essayer ?\n— Oui, merci. … Il est parfait. Il coûte combien ?\n— 35 euros.\n— D'accord, je le prends. Je peux payer par carte ?\n— Bien sûr. Merci et au revoir !", "short_writing")
    ]);
    const s2 = await ensureSub(t, "Hörverstehen (Listening)", 1);
    await ensureExercises(s2, [
      open_("Hörtraining: Spiele → „Hören“ mit der Sammlung „Les vêtements“. Die App spricht Französisch, du wählst die Bedeutung. Ziel: 15 Punkte.", "Tipps: Beim ersten Hören nur auf Schlüsselwörter achten (Kleidung, Farbe, Preis). Zahlen und Preise mitschreiben. Unbekanntes Wort? Aus dem Zusammenhang raten, nicht hängen bleiben.")
    ]);
    const s3 = await ensureSub(t, "Grammatik: Adjektive & Verben", 2);
    await ensureExercises(s3, [
      mc("une robe ___ (vert)", ["verte", "vert", "vertes"], 0, "Adjektiv richtet sich nach dem Nomen: la robe → feminin → verte."),
      mc("des chaussures ___ (blanc)", ["blanches", "blancs", "blanche"], 0, "Feminin Plural: blanc → blanches."),
      mc("un manteau ___ (noir)", ["noir", "noire", "noirs"], 0, "Maskulin Singular: noir."),
      mc("Je ___ un pull bleu. (acheter)", ["achète", "achete", "achètes"], 0, "acheter: j'achète (mit accent grave)."),
      mc("Nous ___ le jean. (préférer)", ["préférons", "préfèrons", "préfèrez"], 0, "préférer: nous préférons (é bleibt)."),
      mc("Tu ___ quoi ce soir ? (mettre)", ["mets", "met", "mettes"], 0, "mettre: je mets, tu mets, il met."),
      mc("Ça ___ combien ? (coûter)", ["coûte", "coûtes", "coûtent"], 0, "ça → 3. Person Singular: ça coûte.")
    ]);
    return "Texte, Hörverstehen, Grammatik";
  } }
];

let PACKS_RUNNING = false;
async function runContentPacks() {
  if (PACKS_RUNNING || STATE.engine !== "ready" || STATE.offline) return;
  PACKS_RUNNING = true;
  try {
    const done = Object.assign({}, setting("packs_done", {}) || {}); const news = [];
    for (const p of PACKS) {
      if (done[p.id]) continue;
      try { const r = await p.run(); if (r === false) continue; done[p.id] = todayISO(); if (typeof r === "string") news.push(p.label); }
      catch (e) { console.warn("Paket", p.id, e); }
    }
    if (Object.keys(done).length !== Object.keys(setting("packs_done", {}) || {}).length) { await setSetting("packs_done", done); await Api.idle(); bump(); }
    if (news.length) { toast("Aktualisiert: " + news.join(" · ")); if (ROUTE.name !== "trainer" && !document.getElementById("mbg")) route(); }
  } finally { PACKS_RUNNING = false; }
}
