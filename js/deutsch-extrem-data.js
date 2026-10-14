/* =====================================================================
   LERN-COCKPIT · DEUTSCH EXTREM-MODUS · Inhalte
   Kommunikationsanalyse mit den 5 Axiomen nach Watzlawick (Deutsch GK, EF).
   Wird beim ersten Öffnen als exercises (source "ai") in Supabase angelegt.
   ===================================================================== */
const DX = {};
DX.AXIOME = [
  { n: 1, name: "Man kann nicht nicht kommunizieren", kurz: "Nicht-nicht-kommunizieren",
    bedeutung: "Jedes Verhalten in Anwesenheit anderer ist Kommunikation – auch Schweigen und Wegschauen.",
    beispiel: "Lara schweigt und schaut weg – und sendet damit Wut oder Verletztsein.",
    signal: "„schwieg“, „wendete den Blick ab“, Pausen, Ignorieren" },
  { n: 2, name: "Inhalts- und Beziehungsaspekt", kurz: "Inhalt & Beziehung",
    bedeutung: "Jede Nachricht hat einen Sachinhalt und eine Beziehungsaussage. Der Beziehungsaspekt bestimmt, wie der Inhalt verstanden wird.",
    beispiel: "„Mach die Tür zu!“ – je nach Ton respektvoll oder herablassend.",
    signal: "Ironie, Vorwurf, Beleidigung, Herablassung" },
  { n: 3, name: "Interpunktion von Ereignisfolgen", kurz: "Interpunktion",
    bedeutung: "Jeder setzt den Anfang einer Kette anders. Ursache und Wirkung laufen im Kreis.",
    beispiel: "Er kommt zu spät, weil sie nörgelt – sie nörgelt, weil er zu spät kommt.",
    signal: "„weil du …“, „immer“, „nie“, gegenseitige Schuldzuweisung" },
  { n: 4, name: "Digitale und analoge Kommunikation", kurz: "Digital & analog",
    bedeutung: "Digital = Worte (Inhalt). Analog = Mimik, Gestik, Tonfall (Beziehung). Analoges ist mehrdeutig.",
    beispiel: "Sagt „Mir geht’s gut“, verschränkt aber die Arme und schaut traurig.",
    signal: "„lachte“, „zittrige Stimme“, „hielt sich fest“, Körpersprache" },
  { n: 5, name: "Symmetrische und komplementäre Interaktion", kurz: "Symmetrisch / komplementär",
    bedeutung: "Symmetrisch = auf Augenhöhe. Komplementär = Gefälle (einer oben, einer unten).",
    beispiel: "Zwei Freunde diskutieren (symmetrisch); Lehrer gibt Anweisung, Schüler befolgt sie (komplementär).",
    signal: "Befehle, Siezen, Chef/Kind, Konkurrenz, Gleichheit" }
];
DX.AX_OPTIONS = DX.AXIOME.map(a => "Axiom " + a.n + ": " + a.kurz);

/* Karteikarten (Leitner) */
DX.KARTEN = [].concat(
  ...DX.AXIOME.map(a => [
    { f: "Axiom " + a.n + " – wie heißt es?", b: a.name },
    { f: "Was bedeutet „" + a.name + "“?", b: a.bedeutung },
    { f: "Nenne ein Beispiel für Axiom " + a.n + " (" + a.kurz + ").", b: a.beispiel },
    { f: "Woran erkennst du Axiom " + a.n + " im Text?", b: a.signal }
  ]),
  [
    { f: "Was gehört in die Einleitung einer Gesprächsanalyse?", b: "Textsorte, Titel, Autor, Jahr und das Thema in einem Satz." },
    { f: "Was gehört in die Situationsbeschreibung?", b: "Personen, Gesprächsart, Kontext – die Deutungshypothese erst am Ende." },
    { f: "Drei Regeln für die Inhaltsangabe?", b: "Präsens, keine wörtliche Rede, jede Aussage mit (vgl. Z. x)." },
    { f: "Was untersuchst du im Analyseteil?", b: "Beziehung, Redeanteile, Sprache, Nonverbales, Stimme, Laute, Gefühle – dann 2 bis 3 Axiome anwenden." },
    { f: "Was gehört in den Schluss?", b: "Was hat sich verändert, wer setzt sich durch, Hypothese bestätigen, eigene Meinung." },
    { f: "Die Absatz-Schablone in 3 Schritten?", b: "1) Axiom nennen + Aussage · 2) Beleg: Zitat in „…“ + (Z. x) · 3) Wirkung: „Dadurch …, weil …“" },
    { f: "Wie zitierst du über zwei Zeilen? Über mehr?", b: "(Z. 8 f.) = Zeile 8 und 9 · (Z. 8 ff.) = Zeile 8 und folgende." },
    { f: "Wann schreibst du (vgl. Z. x)?", b: "Bei sinngemäßer Wiedergabe ohne wörtliches Zitat." },
    { f: "Wofür stehen […] und [ ] im Zitat?", b: "[…] = Auslassung · [ ] = eigene Ergänzung oder Anpassung im Zitat." },
    { f: "Was ist ein Redeanteil – und warum ist er wichtig?", b: "Wer wie viel spricht. Zeigt Dominanz oder Unterlegenheit (oft Axiom 5)." }
  ]
);

/* Quiz „Welches Axiom?“ – s = Situation, a = richtiges Axiom (1–5), r = Begründung, auch = weiteres passendes Axiom */
DX.QUIZ = [
  { s: "„Lara! Ich habe das doch nicht mit Absicht getan.“ Lara schweigt und schaut weg.", a: 1, r: "Auch Schweigen und Wegschauen sind eine Botschaft – Lara zeigt damit Verletztsein." },
  { s: "Es ging nur um die Büroeinrichtung, aber die Erzählerin hält seine Vorschläge für „einfach dumm“, weil sie ihn arrogant findet.", a: 2, r: "Die gestörte Beziehung bestimmt, wie der Sachinhalt bewertet wird." },
  { s: "Er: „Ich komme zu spät, weil sie nörgelt.“ Sie: „Ich nörgele, weil er zu spät kommt.“", a: 3, r: "Beide setzen den Anfang der Kette anders – Ursache und Wirkung laufen im Kreis." },
  { s: "Max legt Luis den Arm um die Schulter und fragt, was los ist.", a: 4, r: "Die Geste (analog) zeigt Nähe und Fürsorge zusätzlich zu den Worten." },
  { s: "Zwei Freunde ergänzen gegenseitig ihre Sätze und stellen fest: „Wir sind so gleich.“", a: 5, r: "Gleichrangige Beziehung ohne Gefälle – symmetrisch." },
  { s: "Rita sagt „Ach, ich glaub schon, daß er gesund ist“, drückt aber die Fingerkuppen fest ans Holz (Z. 8 f., 24 f.).", a: 4, r: "Worte (digital) und Körper (analog) widersprechen sich – der Körper verrät die Wut." },
  { s: "Regula lässt das Buch sinken und überlegt lange; Kurt fragt beleidigt: „Musst du da so lange überlegen?“", a: 1, r: "Ihr Zögern ist schon eine Botschaft – Kurt deutet es als Ablehnung." },
  { s: "Ein Mann deutet den flüchtigen Gruß des Nachbarn als Ablehnung und stürmt wütend zu ihm („Hammer-Geschichte“).", a: 4, auch: 2, r: "Der knappe Gruß (analog) ist mehrdeutig; der Mann deutet ihn als Beziehungsaussage (auch Axiom 2)." },
  { s: "Die Chefin sagt: „Bis morgen liegt der Bericht auf meinem Tisch.“ Der Praktikant nickt nur: „Natürlich.“", a: 5, r: "Klares Gefälle: Anweisung und Unterordnung – komplementär." },
  { s: "„Schöne Note“, sagt die Mutter mit hochgezogenen Augenbrauen zur Fünf.", a: 2, r: "Inhalt wirkt neutral, die Ironie macht die Beziehungsaussage (Vorwurf) deutlich." },
  { s: "Tim verdreht die Augen, während seine Schwester ihm von ihrem Tag erzählt.", a: 4, r: "Die Mimik (analog) sendet Desinteresse oder Abwertung." },
  { s: "„Du hörst mir nie zu!“ – „Ich hör dir nicht zu, weil du immer meckerst!“", a: 3, r: "Gegenseitige Schuldzuweisung: Jeder sieht den anderen als Auslöser." },
  { s: "Im Bus setzt sich Jana demonstrativ weit weg von Leon und steckt Kopfhörer ein.", a: 1, r: "Ohne ein Wort sagt ihr Verhalten: „Lass mich in Ruhe.“" },
  { s: "Zwei Bewerber übertrumpfen sich im Gespräch gegenseitig mit ihren Erfolgen.", a: 5, r: "Konkurrenz um die gleiche Position – symmetrische Interaktion (Eskalation möglich)." },
  { s: "Der Vater sagt „Ist schon gut“ mit leiser, zittriger Stimme und wendet sich ab.", a: 4, r: "Stimme und Abwenden (analog) widersprechen dem beruhigenden Satz." },
  { s: "„Kannst du mir das Salz geben?“ – „Sag doch gleich, dass ich dir nie helfe!“", a: 2, r: "Eine Sachbitte wird als Vorwurf auf der Beziehungsebene verstanden." },
  { s: "Die Lehrerin erklärt, die Schüler schreiben mit und stellen keine Fragen.", a: 5, r: "Rollen mit Gefälle (Lehrkraft – Schüler) – komplementär." },
  { s: "Paul antwortet auf die Einladung einfach nicht. Seine Freundin fragt sich, was sie falsch gemacht hat.", a: 1, r: "Keine Antwort ist auch eine Antwort – sie wird als Botschaft gedeutet." },
  { s: "„Ich ziehe mich zurück, weil du mich kritisierst.“ – „Ich kritisiere dich, weil du dich zurückziehst.“", a: 3, r: "Klassischer Kreislauf: Jeder sieht sein Verhalten als Reaktion auf den anderen." },
  { s: "Sie lacht laut über seinen Witz, obwohl sie ihn eigentlich nicht mag.", a: 4, r: "Das Lachen (analog) ist mehrdeutig – Höflichkeit statt echter Freude." },
  { s: "Zwei Geschwister streiten, wer im Haushalt mehr macht; keiner gibt nach.", a: 5, r: "Beide beanspruchen Gleichrangigkeit – symmetrischer Machtkampf." },
  { s: "„Das hast du ja toll hingekriegt“, sagt der Trainer, nachdem der Spieler das leere Tor verfehlt.", a: 2, r: "Ironie: Der Inhalt lobt, die Beziehungsaussage ist Spott." },
  { s: "Mira sitzt im Streitgespräch stumm da und spielt mit ihrem Schlüsselbund.", a: 1, r: "Ihr Schweigen und Nesteln sind Botschaften: Unsicherheit oder Rückzug." },
  { s: "Der Kunde siezt den Verkäufer, der Verkäufer duzt den Kunden – der Kunde wird kühl.", a: 5, r: "Die Anrede verschiebt das Verhältnis; es entsteht ein Gefälle (komplementär)." },
  { s: "„Ich bin gar nicht nervös“, sagt Jonas und knetet ununterbrochen seine Hände.", a: 4, r: "Die Hände (analog) verraten die Nervosität, die Worte (digital) leugnen sie." },
  { s: "„Immer musst du das letzte Wort haben!“ – „Weil du nie nachgibst!“", a: 3, r: "„Immer“ und „nie“ als Signal: Jeder setzt die Ursache beim anderen." }
];

/* Aufbau der Gesprächsanalyse (Puzzle) */
DX.AUFBAU = [
  { t: "Einleitung", inhalt: "Textsorte, Titel, Autor, Jahr und das Thema in einem Satz." },
  { t: "Situation", inhalt: "Personen, Gesprächsart, Kontext – die Hypothese erst am Ende." },
  { t: "Inhaltsangabe", inhalt: "Präsens, keine wörtliche Rede, jede Aussage mit (vgl. Z. x)." },
  { t: "Analyse", inhalt: "Beziehung, Redeanteile, Sprache, Nonverbales, Stimme, Laute, Gefühle – dann 2 bis 3 Axiome." },
  { t: "Schluss", inhalt: "Was hat sich verändert, wer setzt sich durch, Hypothese bestätigen, eigene Meinung." }
];

/* Absatz-Schablone und Musterabsatz */
DX.SCHABLONE = ["Axiom nennen + Aussage", "Beleg: Zitat in „…“ + (Z. x)", "Wirkung: „Dadurch wird die Kommunikation gestört, weil …“"];
DX.MUSTER = "Das vierte Axiom zeigt sich bei Rita. Sie sagt „Ach, ich glaub schon, daß er gesund ist“ (Z. 8 f.), drückt aber „die Fingerkuppen fest ans Holz“ (Z. 24 f.). Der Körper verrät ihre Wut, das Wort bleibt angepasst. Dadurch wird die Kommunikation gestört, weil die anderen nur die freundlichen Worte hören, aber ihre wahren Gefühle nicht ernst nehmen.";

/* Mini-Szenen: Platzhalter – den Originaltext fügst du im Absatz-Trainer ein */
DX.SZENEN = {
  netter: { titel: "„Ein netter Kerl“ (Gabriele Wohmann)", platzhalter: "Platzhalter-Szene (eigene Übungsszene):\nDie Familie sitzt beim Abendessen.\n„Wie war er denn so?“, fragt die Mutter und lacht.\nRita antwortet: „Ach, ganz nett.“\nSie legt die Gabel weg und schaut auf den Teller.\nDie Schwester kichert: „Ganz nett? Der war doch komisch!“\nRita drückt ihre Hände fest an die Tischkante.\nDer Vater sagt: „Lasst sie doch in Ruhe.“\nRita schweigt eine Weile.\nDann sagt sie leise: „Wir haben uns verlobt.“" },
  hammer: { titel: "„Eine Hammer-Geschichte“", platzhalter: "Platzhalter-Szene (eigene Übungsszene):\nEin Mann will ein Bild aufhängen, hat aber keinen Hammer.\nEr denkt an den Nachbarn.\nGestern hat der ihn nur flüchtig gegrüßt.\n„Vielleicht hat er etwas gegen mich“, denkt der Mann.\nJe länger er nachdenkt, desto wütender wird er.\n„Was bildet der sich ein?“\nEr stürmt hinüber und klingelt.\nDer Nachbar öffnet freundlich: „Guten Tag!“\nDer Mann schreit: „Behalten Sie Ihren Hammer!“" }
};

/* Zitier-Trainer: Lückenaufgaben (Lücke = ___) */
DX.ZITIER = [
  { q: "Wörtliches Zitat mit Zeile: Rita sagt, sie glaube schon, dass er gesund sei ___.", opts: ["(Z. 8)", "Z.8", "(Zeile acht)", "[8]"], c: 0, r: "Zeilenangabe in runden Klammern: (Z. 8)." },
  { q: "Das Zitat geht über Zeile 8 und 9: „Ach, ich glaub schon, daß er gesund ist“ ___", opts: ["(Z. 8 f.)", "(Z. 8 ff.)", "(Z. 8-9 f.)", "(vgl. Z. 8)"], c: 0, r: "f. = die folgende Zeile; ff. = mehrere folgende Zeilen." },
  { q: "Eigene Ergänzung im Zitat: Rita meint, „___ sei gesund“ (Z. 9).", opts: ["[er]", "(er)", "…er…", "„er“"], c: 0, r: "Eigene Einfügungen stehen in eckigen Klammern [ ]." },
  { q: "Auslassung im Zitat: „Ach, ___ daß er gesund ist“ (Z. 8 f.).", opts: ["[…]", "(…)", "...", "–"], c: 0, r: "Ausgelassene Wörter markierst du mit […]." },
  { q: "Sinngemäße Wiedergabe ohne Zitat: Rita gibt an, ihr Verlobter sei gesund ___.", opts: ["(vgl. Z. 8 f.)", "(Z. 8 f.)", "„(Z. 8 f.)“", "[vgl. 8]"], c: 0, r: "Bei sinngemäßer Wiedergabe steht „vgl.“ vor der Zeilenangabe." }
];

/* Fachbegriffe (Matching, je 5 Paare pro Runde) */
DX.BEGRIFFE = [
  ["Sender", "Person, die eine Nachricht übermittelt"], ["Empfänger", "Person, die eine Nachricht aufnimmt und deutet"],
  ["Inhaltsaspekt", "Die Sachinformation einer Nachricht"], ["Beziehungsaspekt", "Was die Nachricht über das Verhältnis der Personen aussagt"],
  ["Digitale Kommunikation", "Kommunikation über Worte"], ["Analoge Kommunikation", "Mimik, Gestik, Tonfall, Körperhaltung"],
  ["Interpunktion", "Wie jeder den Anfang einer Ereigniskette setzt"], ["Symmetrisch", "Interaktion auf Augenhöhe"],
  ["Komplementär", "Interaktion mit Gefälle (oben – unten)"], ["Metakommunikation", "Kommunikation über die Kommunikation"],
  ["Redeanteil", "Wie viel jemand im Gespräch spricht"], ["Paraverbal", "Stimme: Lautstärke, Tempo, Tonfall"],
  ["Ironie", "Man sagt das Gegenteil von dem, was man meint"], ["Nonverbal", "Körpersprache ohne Worte"], ["Deutungshypothese", "Erste Vermutung über die Aussage des Textes"]
];

/* Klausur-Fahrplan (90 Minuten) */
DX.FAHRPLAN = [
  { t: "Text lesen und markieren", min: 10, h: "Axiom-Signale farbig, Zeilen notieren" },
  { t: "Einleitung", min: 5, h: "Textsorte, Titel, Autor, Jahr, Thema" },
  { t: "Situation", min: 5, h: "Personen, Gesprächsart, Kontext" },
  { t: "Inhaltsangabe", min: 10, h: "Präsens, (vgl. Z. x)" },
  { t: "Analyse", min: 45, h: "Beziehung, Sprache, Nonverbales – 2 bis 3 Axiome mit Schablone" },
  { t: "Schluss", min: 10, h: "Veränderung, wer setzt sich durch, Hypothese, Meinung" },
  { t: "Zitate prüfen", min: 5, h: "„…“, (Z. x), Präsens, Rechtschreibung" }
];
DX.TAGESZIEL = { karten: 20, quiz: 10, absatz: 1 };
