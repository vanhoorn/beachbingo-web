// ── Typen ─────────────────────────────────────────────────────────────────────

export type WortWelleDifficulty = "leicht" | "mittel" | "schwer" | "experte";
export type LetterStatus = "correct" | "present" | "absent" | "empty" | "typing";
export type GameStatus = "playing" | "won" | "lost";

export interface DifficultyConfig {
  wordLength: number;
  maxGuesses: number;
  hardMode: boolean;
  label: string;
  description: string;
}

export const DIFFICULTY_CONFIG: Record<WortWelleDifficulty, DifficultyConfig> = {
  leicht:  { wordLength: 4, maxGuesses: 7, hardMode: false, label: "Leicht",  description: "4 Buchstaben · 7 Versuche" },
  mittel:  { wordLength: 5, maxGuesses: 6, hardMode: false, label: "Mittel",  description: "5 Buchstaben · 6 Versuche" },
  schwer:  { wordLength: 5, maxGuesses: 5, hardMode: false, label: "Schwer",  description: "5 Buchstaben · 5 Versuche" },
  experte: { wordLength: 6, maxGuesses: 5, hardMode: true,  label: "Experte", description: "6 Buchstaben · 5 Versuche · Hard Mode" },
};

export const DIFFICULTIES: WortWelleDifficulty[] = ["leicht", "mittel", "schwer", "experte"];

export interface WortWelleState {
  guesses: string[];
  currentInput: string;
  gameStatus: GameStatus;
  targetWord: string;
  hardModeViolation: string | null;
}

export interface WortWelleStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  distribution: number[];  // index = guessCount-1
  lastPlayedDate: string;
  lastDailyDate: string;
  dailyPlayed: number;
  dailyWon: number;
  dailyCurrentStreak: number;
  dailyMaxStreak: number;
  dailyDistribution: number[];
}

// ── Wortlisten ─────────────────────────────────────────────────────────────────

// 4-Buchstaben Zielwörter
const WORDS_4_TARGET: string[] = [
  "HAUS","BIER","BUCH","GLAS","BAUM","BOOT","DACH","FELS","FLUT","GRAS",
  "HAHN","HOLZ","HUND","KÄSE","KORB","LOCH","LÖWE","MEER","MOND","MOOS",
  "NETZ","OBST","PFAD","RAND","RING","ROHR","SAAL","SAFT","SAND","SEIL",
  "SOFA","SOHN","TEER","TIER","TUCH","TURM","WAND","WEIN","WELT","WURM",
  "WALD","ZEIT","ZELT","MÖWE","DÜNE","TANG","WATT","STEG","KAHN","GOLD",
  "HORN","KRUG","LAND","LAUB","MAUS","MEHL","NEST","NUSS","RABE","ROSE",
  "ROST","RUND","RUTE","SIEG","TAKT","TANZ","TANK","VASE","WERK","WEHR",
  "ZAHN","ZEUG","ZINK","ZINN","ZOLL","REIF","REIS","RAST","RAUM","MAHL",
  "LIED","KEIL","KERN","KINN","GANG","GARN","GAST","FILM","DUFT","DOSE",
  "DORF","BOCK","ARZT","ALGE","ADER","AFFE","BALL","BAND","BORD","BROT",
  "BURG","DORN","EBBE","ERBE","ERDE","FACH","FARN","FEST","FLOH","FLUG",
  "FORM","GIFT","GLUT","GOLF","GRAB","GURT","HAFF","HARM","HECK","HEMD",
  "HERD","HOSE","HÖHE","HUHN","JADE","JOCH","KALK","LAGE","LÄRM","LAUF",
  "LECK","LEHM","LEID","LEIM","LOHN","LUST","MARK","MAST","MOOR","MORD",
  "NAHT","NARR","OPER","PAAR","PLAN","RANG","RIFF","RIND","ROCK","RUHE",
  "RUNE","SALZ","SANG","SATZ","SOLD","UFER","URNE","VIEH","VIER","VOLK",
  "VOLT","WECK","WEST","KIES","KLEE","KNIE","KOCH","LORE","MATT","GULP",
  "HAUE","ESSE","ELLE","ÄHRE","ATEM","BACH","BISS","CAFE","JADE","SPAT",
];

// 4-Buchstaben Ratepool (erweitert)
const WORDS_4_GUESS_EXTRA: string[] = [
  "ACHT","ALLE","ALSO","AMOK","ANNO","ARME","AUGE","AUTO","BARE","BAFF",
  "EBEN","ECKE","EGAL","ELAN","ELCH","ELFE","EPOS","ERST","EURO","EWIG",
  "FEIN","FETT","FIEL","FIER","FINO","FLOG","FREI","FRON","FUGE","FUNK",
  "GEIL","GIPS","GORE","GROB","GROG","GUSS","GUTE","HAAR","HAFT","HAST",
  "HEHL","HEIL","HEIM","HEIS","HELD","HELL","HERR","HIEB","HIEG","HOCH",
  "HOLD","HORT","HULD","HULK","JAGT","JEDE","JENE","JOCH","KAHL","KALT",
  "KARG","KEHR","KERL","KIES","KIND","KLAR","KLAU","KLUB","KOKS","KOPF",
  "KOST","KRUX","KÜHL","KÜHN","LAST","LAUT","LEER","LEIB","LENZ","LESE",
  "LOCH","LOGE","LORE","LORN","LOST","LUFT","LUGE","LÜMM","LUMP","MADE",
  "MAGE","MAHL","MALE","MALI","MANN","MARL","MAST","MATT","MEIF","MELD",
  "MELF","MESN","MILD","MINN","MIST","MITT","MODE","MOLE","MOPP","MORR",
  "MUNN","MUND","MUTT","NABE","NACH","NADI","NAGN","NASE","NETT","NICE",
  "NORD","NORM","OASE","ODER","OFEN","OHNE","OKEL","OKSE","OPAL","PACK",
  "PAKT","PASS","PEST","PIER","PILS","PLOT","POCH","POSE","PULK","PULS",
  "QUAI","RAPS","RAUB","RAUE","RECK","REDE","REES","REGE","RENTE","REPS",
  "RIES","RISK","RITZ","ROHM","ROLLE","ROMS","ROSS","ROTS","RUBE","RÜCK",
  "RUMP","RUSS","RYSE","SAFE","SAGE","SAME","SARG","SATZ","SAUM","SCAB",
  "SECK","SEHN","SEHR","SEID","SEIN","SEKT","SEND","SENS","SETZ","SICH",
  "SINN","SOLL","SOMA","SPUK","SPUR","STAB","STAR","STEM","STEU","STOB",
  "STUB","SÜSS","TAGE","TAKT","TALE","TALG","TARR","TEST","TIEF","TIPP",
  "TONN","TORF","TRAB","TRAN","TREU","TROG","TRUB","TUCH","TUFT","TÜLL",
  "TYPE","ÜBER","UCHT","ULME","UNKE","UNKT","URBS","URST","VELO","VICE",
  "VIEL","VISA","VOID","WABE","WADE","WAGE","WARM","WART","WEBE","WEFF",
  "WEIS","WELF","WERG","WUST","YARD","ZEHN","ZIEH","ZING","ZIPS","ZORN",
];

// 5-Buchstaben Zielwörter
const WORDS_5_TARGET: string[] = [
  "STEIN","NACHT","LEBEN","LIEBE","JUNGE","KRANK","TISCH","FISCH","STUHL",
  "BRIEF","SCHON","IMMER","TIERE","KRONE","HÄUSE","SCHAU","HEISS","BODEN",
  "ABEND","AHORN","ALARM","ANGEL","ANGST","ANKER","ATLAS","ATOLL","AUTOR",
  "BRAND","BRISE","BUCHT","BUSEN","DEICH","DELTA","DRUCK","DÜNEN","EBENE",
  "EIMER","EISEN","ENGEL","ERNTE","FADEN","FAHNE","FALKE","FARBE","FASER",
  "FEUER","FJORD","FLECK","FLORA","FLUSS","FORST","FROST","FUCHS","GABEL",
  "GASSE","GEIST","GESTE","GLANZ","GLEIS","GLÜCK","GRUBE","GRUND","HAFEN",
  "HAKEN","HARFE","HEIDE","HIRTE","HÖHLE","HÜGEL","HÜTTE","INSEL","JACKE",
  "JÄGER","KABEL","KANAL","KANTE","KARTE","KATZE","KEGEL","KETTE","KLANG",
  "KLIFF","KLOTZ","KNALL","KNOPF","KOBRA","KRAKE","KRÄHE","KREBS","KREUZ",
  "KRISE","KÜSTE","LACHS","LAUNE","LEDER","LEHRE","LICHT","LINIE","LINSE",
  "LISTE","LITER","LOTSE","LUNGE","MAGMA","MÄHNE","MARKT","MATTE","MEILE",
  "MESSE","MILCH","MINZE","MÖBEL","MÖHRE","MOTTE","MULDE","MÜHLE","NABEL",
  "NADEL","NARBE","NEBEL","NEFFE","NIERE","NOTEN","OCHSE","OTTER","PANDA",
  "PAUKE","PERLE","PFAHL","PFEIL","PFERD","PISTE","PLATZ","PREIS","PROBE",
  "QUARK","RACHE","RATTE","REGEN","REIHE","REISE","RIESE","RINDE","RUDER",
  "SAITE","SALAT","SALON","SÄULE","SCHAF","SCHAL","SCHUH","SEGEL","SONDE",
  "SPATZ","SPIEL","SPORT","STAAT","STAHL","STAMM","STAND","STAUB","STERN",
  "STICH","STIEL","STIRN","STOCK","STROM","STUBE","STÜCK","STURM","STUTE",
  "SUPPE","TAFEL","TANNE","TAUBE","TIGER","TINTE","TRAUM","TREUE","TRICK",
  "TRITT","TRUHE","TULPE","ÜBUNG","VATER","VENUS","VOGEL","WAFFE","WALZE",
  "WANNE","WANZE","WARZE","WELLE","WENDE","WITWE","WOLKE","WÜRZE","WURST",
  "ZANGE","ZEILE","ZINNE","ZUCHT","ZWECK","BRUCH","DRAHT","DRANG","GROLL",
  "GRIFF","HAUCH","HEFTE","KEHLE","KEULE","KIEME","KOGGE","KRÖTE","LAICH",
  "LERCH","LUCHS","SÄBEL","SPREU","SPALT","STANK","STARK","STOPP","STEIL",
  "UMZUG","UNRAT","BÜHNE","TRUPP","TÜPFE","MÄHRE","EMMER","FINTE","HARFE",
  "HOLME","MALVE","ASSEL","LEMUR","TAPIR","VIOLA","VISUM","OCKER","SPORE",
];

// 5-Buchstaben Ratepool (extra)
const WORDS_5_GUESS_EXTRA: string[] = [
  "ABGAS","ADLER","AHNEN","AHNTE","ALAND","ALPEN","AMSEL","AMUSE","ANFUG",
  "ANMUT","ANTIK","APFEL","ARTEN","ASTER","ATMEN","AUFZUG","BARKE","BASALT",
  "BASAR","BELEG","BETON","BIRKE","BLÄUE","BLECH","BLICK","BLOCK","BLUME",
  "BLUSE","BODEN","BOLZE","BORKE","BOXER","BULLE","BUSSE","CLOWN","COURT",
  "CRANE","DATEI","DATUM","DECKE","DEKAN","DEPOT","DEICH","DOLCH","DONAU",
  "DRECK","DROGE","EICHE","EILIG","EINST","EISEN","ELEND","ELFIN","ELFEN",
  "ELOGE","EPOCH","FALTE","FARCE","FEIND","FENIX","FIBEL","FLAIR","FLARE",
  "FLAUE","FLEXI","FLIRT","FLOSS","FOHLE","FORKE","FOYER","FRAGE","FRANK",
  "FRECH","FREMD","FRITZ","FROHE","FUGEN","FÜNFT","FÜRST","FUSST","GAFFE",
  "GAMMA","GARDE","GAUGE","GEBOT","GEIER","GEISL","GELEE","GELTE","GEMSE",
  "GENUG","GERÜT","GIESS","GLASE","GLATT","GLEIF","GLITT","GNADE","GOLEM",
  "GONGE","GORGE","GRAZE","GREIS","GRIFF","GRIMM","GRIND","GROBE","GROSS",
  "GRUFT","GÜLLE","GÜLTE","GUMMI","GUSTO","GUTST","HAFER","HALME","HAMME",
  "HANFE","HARMO","HASEL","HEIST","HELGE","HELME","HERTZ","HIEBE","HIERB",
  "HINZU","HIRSE","HOLME","HONIG","HUMUS","HÜPFE","HURRA","HÜTEN","HYDRA",
  "IDIOT","IGLER","IKONE","IMPFE","INGEB","INTUS","IRREN","IRRIG","IRRSN",
  "JAMES","JAULB","JAWOR","JOKER","JOLLE","JULBE","JUNGS","KABUL","KADETT",
  "KAFFE","KAFKA","KALTE","KAMIN","KAPOK","KARGO","KARST","KARUE","KASSE",
  "KAUEN","KAZOO","KEHRT","KEILE","KEINS","KELCH","KELPF","KEMPE","KENNT",
  "KERNE","KERZE","KIEPE","KIPPE","KIWIS","KLAGE","KLAPS","KLARE","KLEBE",
  "KLEID","KLEIN","KLOBE","KLOPS","KLUFT","KNABE","KNAST","KNIFF","KNOKE",
  "KNURR","KOBER","KOBZE","KOMBI","KOPIE","KOPPE","KORSO","KRAUL","KRAWL",
  "KREIS","KREML","KRIEGS","KRILL","KRIMI","KRONE","KULTE","KUPFE","KUREN",
  "LACHE","LACKE","LAHME","LAMPE","LAPPE","LARVE","LATTE","LAUFE","LAUFT",
  "LAUNE","LAURE","LAUST","LEBER","LECKT","LEHRB","LEHRS","LEIBS","LENZE",
  "LETZE","LEUTE","LIANE","LICHT","LINDE","LIPPE","LISZT","LKWES","LOCKE",
  "LODGE","LODEN","LÜCKE","LUGER","LUMPE","LUPFE","LUSTN","MACHE","MAHLE",
  "MAIRE","MALER","MALZE","MANGE","MARKE","MARME","MASUR","MÄUSE","MECKE",
  "MEERE","MELDE","MENGE","MEUTE","MIETE","MOHRE","MOLCH","MORGE","MÜCKE",
  "MUHME","MUMIE","MÜNZE","MUSKE","MÜTZE","MYLNE","NACHT","NAHME","NARBS",
  "NASEN","NATUR","NEIGT","NIXIE","NIXLN","NORDN","NOTKE","NUTZE","NYMPHE",
  "OCKER","ORGEL","OZEAN","PAPPE","PASST","PATER","PAUSE","PELZE","PENIS",
  "PETER","PFOTE","PILZE","PINIE","PINSE","PLANE","PLAZA","PLOME","PLOTZ",
  "POKAL","POLKA","POLLE","PONZE","POSSE","PRAGE","PRELL","PRIMA","PROSE",
  "PULPE","PUMPE","PUNZE","PUPPE","PURZE","PUSHE","QUELL","QUALE","RACHEN",
  "RASTE","RAUME","RECHEN","RECKE","REGEN","REIBE","REMIS","RENNE","RESTE",
  "RETTE","RIECHE","RIEBE","RILKE","RINNE","RIPPE","RITZE","ROBBEN","ROBBE",
  "ROLLE","ROSEN","ROSTE","RÜBEN","RÜCKE","RUFER","RÜPEL","RUPFE","SAMEN",
  "SARGE","SAUGE","SÄUGE","SCHAL","SCHAM","SCHAN","SCHAR","SEHNE","SEIFE",
  "SENSE","SERVE","SETZE","SIEBE","SINNE","SKALA","SKIZZ","SKUNK","SOHLE",
  "SORGE","SPANN","SPARE","SPÄTE","SPAZE","SPECK","SPEER","SPEIS","SPORE",
  "SPOTT","SPUND","STAUE","STECK","STEGE","STEIN","STELLE","STICH","STIFT",
  "STIVE","STOPP","STORE","STRAB","STRAF","STREU","STUNK","STUMM","STUND",
  "TABAK","TAGES","TAUFE","TAUGL","TAUPE","TEMPO","TERME","TISCH","TOBEN",
  "TOPFE","TORFE","TRÄNE","TRECK","TRETE","TRIFF","TRINK","TROSS","TRUBE",
  "TRUSE","TULIP","TÜLLE","TULPE","TURNE","ÜBELN","ÜBRIG","ULMER","UNBILL",
  "UNGUT","UNKE","UNSRE","VARAN","VEILE","VERSE","VIELE","VIPER","VLIES",
  "WACHT","WAGST","WAHLE","WÄHRE","WAPPE","WARFT","WEBEN","WEDEL","WEGEN",
  "WEIDE","WEILE","WENIG","WERBE","WERFT","WICHTE","WILDE","WINKE","WIPPE",
  "WISSE","WOLLE","WORTE","WÜHLE","WÜSTE","ZÄHNE","ZANKE","ZECHE","ZEDER",
  "ZIELE","ZIMTE","ZIPFE","ZOPFE","ZÜGLE","ZUNGE","ZWANG","ZWECK","ZWEIG",
];

// 6-Buchstaben Zielwörter
const WORDS_6_TARGET: string[] = [
  "ARBEIT","BAMBUS","BRONZE","BRUDER","BRÜCKE","BÜFFEL","BUNKER","BÜRSTE",
  "DELFIN","ELSTER","FALTER","FELSEN","FICHTE","FISCHE","FLAUTE","FLIEGE",
  "FLOSSE","FROSCH","GARTEN","GESANG","GESETZ","GEWEHR","GIPFEL","GROTTE",
  "HAMMER","HELFER","HERZEN","HIRSCH","HÖCKER","HUMMEL","HUNGER","INSELN",
  "KATZEN","KESSEL","KIEFER","KLIPPE","KNECHT","KNOLLE","KOBOLD","KOFFER",
  "KÖRPER","KRABBE","KRÄFTE","KRIPPE","KUTTER","LAGUNE","LERCHE","LÖCHER",
  "MANDEL","MANGEL","MARDER","MISTEL","MÖHREN","MOLCHE","MÖRSER","MÜCKEN",
  "MÜHLEN","MUSCHEL","MUSTER","NATTER","OCHSEN","OSTERN","PALMEN","PANZER",
  "PAPIER","PERLEN","PINSEL","PLATTE","PRANKE","RACHEN","RECHEN","REIHER",
  "RIEMEN","ROBBEN","RÜCKEN","SEUCHE","SILBER","SOMMER","SPEISE","SPOREN",
  "SPROSS","STÄMME","STRAND","STRICH","STUNDE","TAIFUN","TEMPEL","TEUFEL",
  "TRÄGER","TRESOR","URLAUB","VESPER","WAPPEN","WASSER","WEIZEN","WELLEN",
  "WIESEN","WIRBEL","WUNDER","WURZEL","WÜSTEN","ZEIGER","ZIRKEL","ZITHER",
  "ZUCKER","ZUNDER","SALBEI","SCHIFF","SCHNEE","SCHLAF","SCHELM","WALZER",
  "VÖLKER","SATURN","ZOMBIE","PRIMEL","NIMBUS","TAUBEN","TINTEN","FLUTEN",
  "LÜFTEN","BARSCH","ADVENT","AMBOSS","DEHNEN","DROGEN","BRIEFE","ARKADE",
  "DAHLIE","DICHTE","DÜNUNG","EISBÄR","FLAUTE","FLÖSSE","FORMEL","FRAUEN",
  "FRISCH","BLÜTEN","KAHLER","MATTEN","BÜRSTE","MASERN","GELEES","BACKEN",
];

// 6-Buchstaben Ratepool (extra)
const WORDS_6_GUESS_EXTRA: string[] = [
  "ABFALL","AKTION","ALLRAD","ANKERN","ANTEIL","ANTLER","APFELN","ARMBAD",
  "BASTEL","BÄCKER","BAGGER","BALKON","BASTEI","BAUTEN","BECKEN","BEEREN",
  "BEHÜTE","BEIBOOT","BELLEN","BELTEN","BERBER","BEREIT","BERSTE","BIETEN",
  "BIRKEN","BITTER","BLASER","BLAUER","BLÜMEL","BOCKIG","BÖDELN","BORDEN",
  "BORGEN","BORSTE","BRATEN","BRECHE","BREITE","BRIESE","BRODEL","BUHNEN",
  "BÜSCHE","CHILLEN","DAMMEN","DANGEN","DARBEN","DAUERN","DECKEL","DENKEN",
  "DIESEL","DIENEN","DONNER","DORNEN","DÖRFER","DRÜCKE","DUNKEL","DÜSTER",
  "EBENEN","EICHEN","EILAND","EINZEL","ELENDE","ENGELN","ENTEIL","ERDING",
  "FAKTOR","FÄUSTE","FÄHREN","FALLEN","FALTEN","FANGER","FARBEN","FASERN",
  "FASSES","FEDRIG","FEIGEN","FELDER","FERSEN","FEUERN","FIESER","FINGER",
  "FIRNIS","FLADEN","FLASCH","FLÄCHE","FLIEEN","FLUCHT","FLURRT","FOLGEN",
  "FORSTE","FRÖSTE","FRUCHT","FUHREN","FÜLLEN","FUNKEN","FUTTER","GÄNGEN",
  "GARBEN","GARDER","GARNEN","GATTER","GEBÄCK","GEBIET","GEBIRG","GEBÜHR",
  "GEGNER","GEHEUL","GEHWEG","GEIFER","GEISSEL","GELTEN","GENUSS","GEPÄCK",
  "GERÖLL","GERSTE","GERUCH","GESELL","GESIMS","GEWALT","GEWAND","GIEMEN",
  "GIRLND","GLASER","GLEISE","GLÜHEN","GNADEN","GÖTTER","GRÄSER","GRAUEN",
  "GREIFEN","GRENZE","GRIFFE","GRÜBEL","GRUNDS","GULDEN","GÜRTEL","GUTTEN",
  "HAFTER","HALLEN","HALSER","HALTEN","HANDDE","HÄNGEN","HARKEN","HARREN",
  "HASSEN","HÄUTEN","HAUSEN","HECHEL","HECKEN","HELDEN","HELFEN","HEMMEN",
  "HENKEL","HERDEN","HEREIN","HERREN","HERZEN","HESSEN","HINTEN","HOCKER",
  "HOFFEN","HOLLEN","HORTEN","HOSERN","HÜLSEN","IMPFEN","IRLAND","JUNGEN",
  "KAFFER","KÄHNEN","KALDAU","KAPPEN","KÄSTEN","KAUFEN","KELCHE","KESSEN",
  "KETTEN","KILLEN","KINDER","KISTEN","KLÄGER","KLÄREN","KLINIK","KLOPFE",
  "KNACKE","KNARRE","KNOTEN","KOCHEN","KOSTEN","KRALLE","KRONEN","KÜBLER",
  "KÜHLEN","KÜHNEN","KUNDEN","LÄNDLER","LAPPEN","LASERN","LAUFEN","LAUGEN",
  "LAUBEN","LAUTEN","LEEREM","LEEREN","LEIERN","LEINEN","LEITERN","LENDEN",
  "LESSEN","LEUCHTE","LICHTEN","LIEBEN","LIEFERN","LINIEN","LÖSUNG","LUGERN",
  "LÜTTEN","MACHEN","MÄHREN","MAHNEN","MALERN","MÄRTEN","MASSEN","MEEREN",
  "MENGEN","MESSEN","MIETEN","MILDEN","MOHREN","MORGEN","MÜNZEN","MUSTER",
  "NAHRUNG","NARBEN","NETZEN","NIETEN","NORDEN","NUTZER","ÖFFNEN","ORDNEN",
  "PECHEN","PELZEN","PENNER","PFERDS","PFLEGE","PFUNDE","PILGER","PINNEN",
  "PLANEN","PLATTEN","POSERN","POTZEN","PUTZEN","RANGEN","RANKEN","RASTEN",
  "RATTEN","RAUMEN","RECHTE","REGELN","RENNEN","RENTEN","RINNEN","RÖSTEN",
  "RUDERN","RÜHREN","SALBEN","SANKEN","SAUGEN","SÄUMEN","SCHAFE","SCHÄME",
  "SCHERZ","SCHIFF","SCHIRM","SCHLAF","SCHLANGE","SCHORLE","SELTEN","SENKEN",
  "SINKEN","SIPPEN","SITZEN","SÖHNEN","SONNEN","SPALTE","SPANNE","SPAREN",
  "SPERREN","SPIELE","SPINNE","STAKEN","STAUNEN","STEGEN","STEILE","STEINE",
  "STELLT","STEMME","STENGT","STIEVE","STOCHS","STOFFE","STRASSE","STRECK",
  "STRENG","STRICH","STÜCKE","STUFEN","STÜRME","SUCHEN","SUMPFE","SURFEN",
  "TAKTIK","TANKEN","TANNEN","TAUCHE","TAUGEN","TESTEN","THEMEN","TIPPEN",
  "TÖPFER","TRAGEN","TRAUFE","TREFFEN","TREIBEN","TRETEN","TRINKEN","TRUPPE",
  "TÜRMEN","TURNEN","URFORM","URZEIT","VÖLLIG","VORRAT","WACHEN","WÄHLEN",
  "WANDEL","WARTEN","WASCHEN","WEDELN","WEIGERN","WEINEN","WEISEN","WENDEN",
  "WERFEN","WICHTE","WINDEN","WISSEN","WOHNEN","WÖLBEN","WOLKEN","ZÄHLEN",
  "ZEIGEN","ZIEHEN","ZIELEN","ZIMMER","ZITTERN","ZÖGERN","ZOLLEN","ZÜCHTEN",
];

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function getWordList(length: number, type: "target" | "guess"): string[] {
  if (length === 4) return type === "target" ? WORDS_4_TARGET : [...WORDS_4_TARGET, ...WORDS_4_GUESS_EXTRA];
  if (length === 5) return type === "target" ? WORDS_5_TARGET : [...WORDS_5_TARGET, ...WORDS_5_GUESS_EXTRA];
  return type === "target" ? WORDS_6_TARGET : [...WORDS_6_TARGET, ...WORDS_6_GUESS_EXTRA];
}

// Tageswort: deterministisch aus Datum + Wortliste
export function getDailyWord(difficulty: WortWelleDifficulty): { word: string; dateStr: string } {
  const { wordLength } = DIFFICULTY_CONFIG[difficulty];
  const targets = getWordList(wordLength, "target");
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  // einfacher deterministischer Hash aus Datum
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  // difficulty-Offset, damit jede Schwierigkeit ein anderes Wort hat
  const offsets: Record<WortWelleDifficulty, number> = { leicht: 0, mittel: 1000, schwer: 2000, experte: 3000 };
  const idx = Math.abs(h + offsets[difficulty]) % targets.length;
  return { word: targets[idx], dateStr };
}

// Zufälliges Wort
export function getRandomWord(difficulty: WortWelleDifficulty): string {
  const { wordLength } = DIFFICULTY_CONFIG[difficulty];
  const targets = getWordList(wordLength, "target");
  return targets[Math.floor(Math.random() * targets.length)];
}

// Prüft ob das Ratewort im Wörterbuch ist
export function isValidGuess(word: string, difficulty: WortWelleDifficulty): boolean {
  const { wordLength } = DIFFICULTY_CONFIG[difficulty];
  const pool = getWordList(wordLength, "guess");
  return pool.includes(word.toUpperCase());
}

// Farbgebungsalgorithmus (behandelt Doppelbuchstaben korrekt)
export function computeStatuses(guess: string, target: string): LetterStatus[] {
  const g = guess.toUpperCase();
  const t = target.toUpperCase();
  const result: LetterStatus[] = new Array(g.length).fill("absent");

  // Zähle nicht-gematchte Ziel-Buchstaben
  const remaining: Record<string, number> = {};
  for (let i = 0; i < t.length; i++) {
    if (g[i] !== t[i]) remaining[t[i]] = (remaining[t[i]] || 0) + 1;
  }

  // Erster Durchlauf: Grün
  for (let i = 0; i < g.length; i++) {
    if (g[i] === t[i]) result[i] = "correct";
  }

  // Zweiter Durchlauf: Gelb
  for (let i = 0; i < g.length; i++) {
    if (result[i] === "correct") continue;
    if (remaining[g[i]] && remaining[g[i]] > 0) {
      result[i] = "present";
      remaining[g[i]]--;
    }
  }

  return result;
}

// Tastatur-Status: bestes bekanntes Ergebnis pro Buchstabe
export function computeKeyStatuses(
  guesses: string[],
  target: string
): Record<string, LetterStatus> {
  const priority: Record<LetterStatus, number> = { correct: 3, present: 2, absent: 1, empty: 0, typing: 0 };
  const result: Record<string, LetterStatus> = {};

  for (const guess of guesses) {
    const statuses = computeStatuses(guess, target);
    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i];
      const st = statuses[i];
      if (!result[ch] || priority[st] > priority[result[ch]]) result[ch] = st;
    }
  }
  return result;
}

// Hard Mode: prüft ob bestätigte Grün/Gelb-Buchstaben im neuen Rateversuch benutzt werden
export function validateHardMode(
  newGuess: string,
  previousGuesses: string[],
  target: string
): string | null {
  if (previousGuesses.length === 0) return null;
  const g = newGuess.toUpperCase();

  for (const prev of previousGuesses) {
    const statuses = computeStatuses(prev, target);
    for (let i = 0; i < prev.length; i++) {
      if (statuses[i] === "correct" && g[i] !== prev[i]) {
        return `Position ${i + 1} muss "${prev[i]}" sein (grüner Buchstabe).`;
      }
    }
    // Gelbe Buchstaben müssen irgendwo vorkommen
    for (let i = 0; i < prev.length; i++) {
      if (statuses[i] === "present") {
        if (!g.includes(prev[i])) {
          return `Das Wort muss den Buchstaben "${prev[i]}" enthalten.`;
        }
      }
    }
  }
  return null;
}

// ── Spielzustand ───────────────────────────────────────────────────────────────

export function createInitialState(targetWord: string): WortWelleState {
  return {
    guesses: [],
    currentInput: "",
    gameStatus: "playing",
    targetWord,
    hardModeViolation: null,
  };
}

export function serializeState(state: WortWelleState): string {
  return JSON.stringify({
    guesses: state.guesses,
    currentInput: state.currentInput,
    gameStatus: state.gameStatus,
    targetWord: state.targetWord,
  });
}

export function deserializeState(raw: string): WortWelleState {
  const parsed = JSON.parse(raw);
  return { ...parsed, hardModeViolation: null };
}

// ── Statistiken ────────────────────────────────────────────────────────────────

function makeEmptyStats(maxGuesses: number): WortWelleStats {
  return {
    played: 0, won: 0, currentStreak: 0, maxStreak: 0,
    distribution: new Array(maxGuesses).fill(0),
    lastPlayedDate: "",
    lastDailyDate: "",
    dailyPlayed: 0, dailyWon: 0, dailyCurrentStreak: 0, dailyMaxStreak: 0,
    dailyDistribution: new Array(maxGuesses).fill(0),
  };
}

const STATS_KEY_PREFIX = "wortwelle_stats_";

export function getStats(difficulty: WortWelleDifficulty): WortWelleStats {
  const { maxGuesses } = DIFFICULTY_CONFIG[difficulty];
  try {
    const raw = localStorage.getItem(STATS_KEY_PREFIX + difficulty);
    if (!raw) return makeEmptyStats(maxGuesses);
    const s = JSON.parse(raw) as WortWelleStats;
    // Sicherstellen dass distribution richtige Länge hat
    while (s.distribution.length < maxGuesses) s.distribution.push(0);
    while (s.dailyDistribution.length < maxGuesses) s.dailyDistribution.push(0);
    return s;
  } catch {
    return makeEmptyStats(maxGuesses);
  }
}

export function saveStats(difficulty: WortWelleDifficulty, stats: WortWelleStats): void {
  try {
    localStorage.setItem(STATS_KEY_PREFIX + difficulty, JSON.stringify(stats));
  } catch { /* ignore */ }
}

export function recordResult(
  difficulty: WortWelleDifficulty,
  won: boolean,
  guessCount: number,
  isDaily: boolean,
  dateStr?: string
): void {
  const stats = getStats(difficulty);
  const today = dateStr ?? new Date().toISOString().slice(0, 10);

  // Normale Statistik
  stats.played++;
  if (won) {
    stats.won++;
    const idx = Math.min(guessCount - 1, stats.distribution.length - 1);
    stats.distribution[idx]++;
    // Streak: nur wenn nicht bereits heute gespielt
    if (stats.lastPlayedDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (stats.lastPlayedDate === yesterday) {
        stats.currentStreak++;
      } else {
        stats.currentStreak = 1;
      }
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    }
  } else {
    stats.currentStreak = 0;
  }
  stats.lastPlayedDate = today;

  // Tageswort-Statistik
  if (isDaily && dateStr) {
    stats.dailyPlayed++;
    if (won) {
      stats.dailyWon++;
      const idx = Math.min(guessCount - 1, stats.dailyDistribution.length - 1);
      stats.dailyDistribution[idx]++;
      if (stats.lastDailyDate !== dateStr) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (stats.lastDailyDate === yesterday) {
          stats.dailyCurrentStreak++;
        } else {
          stats.dailyCurrentStreak = 1;
        }
        stats.dailyMaxStreak = Math.max(stats.dailyMaxStreak, stats.dailyCurrentStreak);
      }
    } else {
      stats.dailyCurrentStreak = 0;
    }
    stats.lastDailyDate = dateStr;
  }

  saveStats(difficulty, stats);
}

// Prüft ob das heutige Tageswort bereits gespielt wurde
export function hasDailyBeenPlayed(difficulty: WortWelleDifficulty, dateStr: string): boolean {
  const stats = getStats(difficulty);
  return stats.lastDailyDate === dateStr;
}
